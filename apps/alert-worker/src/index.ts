/**
 * Srevox Alert Worker v2
 * Pipeline: Redis crash event → rule match → noise filter →
 *           service owner routing → user preference filter → send alerts
 */
import "dotenv/config";
import Redis from "ioredis";
import { Pool } from "pg";
import Fastify from "fastify";
import { createDecipheriv, createHash } from "crypto";
import type { CrashEvent, ChannelConfig } from "./types.js";
import { sendEmail }                        from "./senders/email.js";
import { sendTeams, sendWhatsApp, sendWebhook, sendClusterAlert } from "./senders/channels.js";

const db = new Pool({
  host:     process.env.POSTGRES_HOST || "localhost",
  port:     Number(process.env.POSTGRES_PORT || 5432),
  database: process.env.POSTGRES_DB   || "srevox",
  user:     process.env.POSTGRES_USER || "srevox",
  password: process.env.POSTGRES_PASSWORD,
});

const subscriber = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
const cache      = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

// ── Test HTTP server ──────────────────────────────────────────────────────────
const server = Fastify({ logger: false });

server.post("/test", async (req, reply) => {
  const { type, config, test_message } = req.body as {
    type: string;
    config: Record<string, string>;
    test_message: Partial<CrashEvent>;
  };
  const testEvent: CrashEvent = {
    cluster_id:     "test-cluster",
    pod_name:       test_message.pod_name    || "test-pod-srevox",
    namespace:      test_message.namespace   || "production",
    container_name: test_message.container_name || "app",
    crash_reason:   test_message.crash_reason   || "OOMKilled",
    restart_count:  test_message.restart_count  || 5,
    pod_labels:     {},
    raw_event:      {},
    detected_at:    new Date().toISOString(),
  };
  try {
    await dispatchAlert({ id: "test", type: type as any, config }, testEvent, "test-incident", "critical", "test-cluster");
    return { success: true, message: "Test alert sent" };
  } catch (err: any) {
    let msg = err.message || "Failed";
    if (err.response?.data) {
      msg = typeof err.response.data === "string" 
        ? err.response.data 
        : (err.response.data.detail || err.response.data.error || JSON.stringify(err.response.data));
    }
    return reply.status(500).send({ success: false, error: msg });
  }
});

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("[alert-worker] 🚀 Starting Srevox alert worker...");
  await server.listen({ port: 3001, host: "0.0.0.0" });
  console.log("[alert-worker] Test server on http://localhost:3002");

  subscriber.on("ready", () => {
    console.log("[alert-worker] Redis subscriber connection ready. Subscribing...");
    subscriber.subscribe("srevox:crashes", "srevox:system_alerts", (err) => {
      if (err) {
        console.error("[alert-worker] Redis subscribe error:", err);
      } else {
        console.log("[alert-worker] Successfully subscribed to srevox:crashes and srevox:system_alerts");
      }
    });
  });

  subscriber.on("message", async (channel: string, message: string) => {
    try {
      if (channel === "srevox:crashes") {
        const event: CrashEvent = JSON.parse(message);
        await processEvent(event);
      } else if (channel === "srevox:system_alerts") {
        const event = JSON.parse(message);
        await processSystemAlert(event);
      }
    } catch (err) {
      console.error(`[alert-worker] Error processing message on channel ${channel}:`, err);
    }
  });

  console.log("[alert-worker] 👂 Waiting for events on srevox:crashes and srevox:system_alerts...");

  // Check cluster heartbeats every 30 seconds
  setInterval(async () => {
    try {
      await checkClusterHeartbeats();
    } catch (err) {
      console.error("[alert-worker] Heartbeat check failed:", err);
    }
  }, 30000);

  // Check and run retention purges dynamically every 10 minutes
  checkAndRunRetentionPurges().catch((err) => {
    console.error("[alert-worker] Initial retention check failed:", err);
  });
  setInterval(async () => {
    try {
      await checkAndRunRetentionPurges();
    } catch (err) {
      console.error("[alert-worker] Retention purge sweep failed:", err);
    }
  }, 10 * 60 * 1000);
}

// ── Event pipeline ────────────────────────────────────────────────────────────
async function processEvent(event: CrashEvent): Promise<void> {
  console.log(`[alert-worker] 🔔 ${event.pod_name} (${event.namespace}) — ${event.crash_reason} [${event.restart_count} restarts]`);

  let clusterName = event.cluster_id;
  try {
    const { rows } = await db.query(
      `UPDATE clusters SET status = 'connected', last_seen_at = now() WHERE cluster_id = $1 RETURNING name`,
      [event.cluster_id]
    );
    if (rows[0]?.name) {
      clusterName = rows[0].name;
    }
  } catch (err) {
    console.error("[alert-worker] Failed to update cluster status / fetch name:", err);
  }

  const rules = await getMatchingRules(event);
  if (!rules.length) {
    console.log("[alert-worker] No matching rules — skipping");
    return;
  }

  for (const rule of rules) {
    try {
      const ruleMuteKey = `mute:rule:${rule.rule_id || rule.id}`;
      if (await cache.get(ruleMuteKey)) {
        console.log(`[alert-worker] Rule ${rule.name || rule.rule_id || rule.id} is currently muted. Skipping alert.`);
        continue;
      }

      const imagePullErrors = ["ImagePullBackOff", "ErrImagePull", "InvalidImageName"];
      const skipThreshold = imagePullErrors.includes(event.crash_reason);
      if (!skipThreshold && event.restart_count < rule.min_restarts) {
        console.log(`[alert-worker] Below restart threshold (${event.restart_count} < ${rule.min_restarts})`);
        continue;
      }

      const lastRestartsKey = `last_restarts:${rule.rule_id || rule.id}:${event.cluster_id}:${event.namespace}:${event.pod_name}`;
      if (rule.only_increase_restarts !== false) {
        const lastRestartsVal = await cache.get(lastRestartsKey);
        if (lastRestartsVal !== null) {
          const lastRestarts = parseInt(lastRestartsVal, 10);
          if (event.restart_count <= lastRestarts) {
            if (event.restart_count < lastRestarts) {
              console.log(`[alert-worker] Restart count reset from ${lastRestarts} to ${event.restart_count}. Clearing cache key.`);
              await cache.del(lastRestartsKey);
            } else {
              console.log(`[alert-worker] Restart count has not increased (${event.restart_count} <= ${lastRestarts}). Skipping alert.`);
              continue;
            }
          }
        }
      }

      const cooldownKey = `cooldown:${rule.rule_id || rule.id}:${event.cluster_id}:${event.namespace}:${event.pod_name}`;
      if (await cache.get(cooldownKey)) {
        console.log(`[alert-worker] Cooldown active for ${event.pod_name}`);
        continue;
      }

      const incidentId = await upsertIncident(event, rule);
      if (!incidentId) continue;

      // Insert crash notifications for all active non-muted users
      try {
        const title = `${event.pod_name} crashed`;
        const subText = `${event.crash_reason} · ${event.namespace} · ${event.restart_count} restarts`;
        const severity = rule.severity || 'warning';

        const { rows: insertedNotifs } = await db.query(
          `INSERT INTO user_notifications (org_id, user_id, incident_id, cluster_id, title, sub, severity, type)
           SELECT 
             $1, 
             u.user_id, 
             $2, 
             $6,
             $3, 
             $4, 
             $5, 
             'crash'
           FROM users u
           LEFT JOIN user_alert_preferences p ON u.user_id = p.user_id
           WHERE u.org_id = $1 
             AND u.is_active = true
             AND (p.notifications_muted IS DISTINCT FROM true)
             AND (p.notifications_muted_until IS NULL OR p.notifications_muted_until < now())
           RETURNING user_id, notification_id, cluster_id, title, sub, severity, type, is_read, created_at`,
          [rule.org_id, incidentId, title, subText, severity, event.cluster_id]
        );

        // Publish to Redis for each active user to push SSE live updates
        for (const notif of insertedNotifs) {
          const payload = {
            id: notif.notification_id,
            incident_id: incidentId,
            cluster_id: notif.cluster_id,
            title: notif.title,
            sub: notif.sub,
            severity: notif.severity,
            type: notif.type,
            read: notif.is_read,
            time: notif.created_at
          };
          await cache.publish(`srevox:notifications:${notif.user_id}`, JSON.stringify({ type: "notification", notification: payload }));
        }
      } catch (err) {
        console.error("[alert-worker] Failed to save crash notifications:", err);
      }

      // Rule channels (org-level)
      const ruleChannels = await getChannels(rule.channel_ids);

      // Service owner channels (user-specific routing)
      const { channels: ownerChannels, ownerUserIds } = await getServiceOwnerChannels(
        event.cluster_id, event.namespace, event.pod_name, rule.org_id, event.crash_reason
      );

      // Merge + deduplicate
      const allChannelMap = new Map<string, ChannelConfig>();
      [...ruleChannels, ...ownerChannels].forEach((ch) => allChannelMap.set(ch.id, ch));

      // Filter by user preferences for owner channels
      const filteredChannels: ChannelConfig[] = [];

      for (const [id, ch] of allChannelMap) {
        // For owner channels — check their personal preferences
        if (ownerChannels.find((oc) => oc.id === id) && ownerUserIds.size > 0) {
          const ownerUserId = ownerChannels.find((oc) => oc.id === id)?.userId;
          if (ownerUserId) {
            const allowed = await checkUserPreferences(ownerUserId, event, rule.severity);
            if (!allowed) {
              console.log(`[alert-worker] User preference filter blocked alert for channel ${ch.type}`);
              continue;
            }
          }
        }
        filteredChannels.push(ch);
      }

      if (!filteredChannels.length) {
        console.log(`[alert-worker] All channels filtered — no alerts sent`);
      }

      const results = await Promise.allSettled(
        filteredChannels.map((ch) => dispatchAlert(ch, event, incidentId, rule.severity, clusterName))
      );

      await logResults(results, filteredChannels, incidentId);
      await cache.set(cooldownKey, "1", "EX", rule.cooldown_minutes * 60);
      if (rule.only_increase_restarts !== false) {
        await cache.set(lastRestartsKey, String(event.restart_count), "EX", 7 * 24 * 3600);
      }

      const sent = results.filter((r) => r.status === "fulfilled").length;
      console.log(`[alert-worker] ✅ Incident ${incidentId.slice(0, 8)} — ${sent}/${filteredChannels.length} channels notified`);
    } catch (ruleErr: any) {
      console.error(`[alert-worker] Error processing rule ${rule.name || rule.rule_id || rule.id}:`, ruleErr);
    }
  }
}

// ── User preference check ─────────────────────────────────────────────────────
async function checkUserPreferences(
  userId: string,
  event: CrashEvent,
  severity: string
): Promise<boolean> {
  try {
    const { rows } = await db.query(
      `SELECT * FROM user_alert_preferences WHERE user_id = $1 AND enabled = true`,
      [userId]
    );
    if (!rows.length) return true; // No preferences = receive all

    const pref = rows[0];
    const severities:    string[] = parseJsonArr(pref.severities);
    const crash_reasons: string[] = parseJsonArr(pref.crash_reasons);
    const namespaces:    string[] = parseJsonArr(pref.namespaces);

    // Check severity filter
    if (severities.length && !severities.includes(severity)) {
      console.log(`[alert-worker] User ${userId} filters out severity: ${severity}`);
      return false;
    }

    // Check crash reason filter (empty = all)
    if (crash_reasons.length && !crash_reasons.includes(event.crash_reason)) {
      console.log(`[alert-worker] User ${userId} filters out crash reason: ${event.crash_reason}`);
      return false;
    }

    // Check namespace filter (empty = all)
    if (namespaces.length && !namespaces.includes(event.namespace)) {
      console.log(`[alert-worker] User ${userId} filters out namespace: ${event.namespace}`);
      return false;
    }

    // Check quiet hours (UTC hour)
    if (pref.quiet_hours_start != null && pref.quiet_hours_end != null) {
      const currentHour = new Date().getUTCHours();
      const start = Number(pref.quiet_hours_start);
      const end   = Number(pref.quiet_hours_end);
      if (!isNaN(start) && !isNaN(end)) {
        const inQuietHours = start <= end
          ? currentHour >= start && currentHour < end
          : currentHour >= start || currentHour < end; // overnight window

        if (inQuietHours) {
          console.log(`[alert-worker] User ${userId} in quiet hours (${start}:00–${end}:00 UTC)`);
          return false;
        }
      }
    }

    return true;
  } catch (err) {
    console.error("[alert-worker] Preference check error:", err);
    return true; // Fail open
  }
}

function sanitizeConfig(config: Record<string, string>): Record<string, string> {
  const cleaned: Record<string, string> = {};
  if (!config) return cleaned;
  for (const [key, value] of Object.entries(config)) {
    if (typeof value === "string") {
      let val = value.trim();
      val = val.replace(/^['"]|['"]$/g, "").trim();
      val = val.replace(/^(%27|%22)|(%27|%22)$/gi, "").trim();
      cleaned[key] = val;
    } else {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

// ── Dispatch ──────────────────────────────────────────────────────────────────
async function dispatchAlert(
  channel: ChannelConfig,
  event: CrashEvent,
  incidentId: string,
  severity: string,
  clusterName: string
): Promise<void> {
  const config = sanitizeConfig(channel.config);
  switch (channel.type) {
    case "email":    return sendEmail(config, event, incidentId, severity, clusterName);
    case "teams":    return sendTeams(config, event, incidentId, severity, clusterName);
    case "whatsapp": return sendWhatsApp(config, event, incidentId, severity, clusterName);
    case "webhook":
    case "slack":    return sendWebhook(config, event, incidentId, severity, clusterName);
    default:
      console.warn(`[alert-worker] Unknown channel type: ${channel.type}`);
  }
}

// ── DB helpers ────────────────────────────────────────────────────────────────
async function getMatchingRules(event: CrashEvent) {
  const { rows } = await db.query(
    `SELECT ar.*, o.org_id
     FROM alert_rules ar
     JOIN clusters c ON ar.cluster_id = c.cluster_id
     JOIN organizations o ON ar.org_id = o.org_id
     WHERE ar.enabled = true
       AND (ar.cluster_id = $1 OR ar.cluster_id IS NULL)`,
    [event.cluster_id]
  );
  return rows.filter((rule) => {
    const reasons:    string[] = parseJsonArr(rule.crash_reasons);
    const namespaces: string[] = parseJsonArr(rule.namespaces);
    const channelIds: string[] = parseJsonArr(rule.channel_ids);
    rule.channel_ids = channelIds;
    return (!reasons.length    || reasons.includes(event.crash_reason)) &&
           (!namespaces.length  || namespaces.includes(event.namespace));
  });
}

async function resolveRecipients(orgId: string, input: string | any[] | null | undefined): Promise<string[]> {
  if (!input) return [];
  
  let items: string[] = [];
  if (Array.isArray(input)) {
    items = input.map(String);
  } else if (typeof input === "string") {
    const trimmed = input.trim();
    if (trimmed.startsWith("[")) {
      try {
        items = JSON.parse(trimmed);
      } catch {
        items = trimmed.split(",").map(s => s.trim()).filter(Boolean);
      }
    } else {
      items = trimmed.split(",").map(s => s.trim()).filter(Boolean);
    }
  }

  const emails = new Set<string>();

  for (const item of items) {
    if (!item) continue;
    const trimmedItem = item.trim();
    if (trimmedItem.includes("@")) {
      emails.add(trimmedItem);
    } else if (trimmedItem.startsWith("ngp")) {
      try {
        const { rows } = await db.query(
          `SELECT emails FROM notification_groups WHERE group_id = $1 AND org_id = $2`,
          [trimmedItem, orgId]
        );
        if (rows[0]?.emails) {
          const groupEmails = Array.isArray(rows[0].emails) 
            ? rows[0].emails 
            : JSON.parse(rows[0].emails);
          groupEmails.forEach((email: string) => emails.add(email));
        }
      } catch (err) {
        console.error(`[alert-worker] Failed to resolve notification group ${trimmedItem}:`, err);
      }
    } else if (trimmedItem.startsWith("usr")) {
      try {
        const { rows } = await db.query(
          `SELECT email FROM users WHERE user_id = $1 AND org_id = $2`,
          [trimmedItem, orgId]
        );
        if (rows[0]?.email) emails.add(rows[0].email);
      } catch (err) {
        console.error(`[alert-worker] Failed to resolve user email for ${trimmedItem}:`, err);
      }
    } else {
      try {
        const { rows } = await db.query(
          `SELECT u.email FROM group_members gm
           JOIN users u ON gm.user_id = u.user_id
           WHERE gm.group_id = $1`,
          [trimmedItem]
        );
        rows.forEach((r: any) => {
          if (r.email) emails.add(r.email);
        });
      } catch (err) {
        console.error(`[alert-worker] Failed to resolve group ${trimmedItem}:`, err);
      }
    }
  }

  return Array.from(emails);
}

async function getServiceOwnerChannels(
  clusterId: string, namespace: string, podName: string, orgId: string, crashReason: string
): Promise<{ channels: (ChannelConfig & { userId?: string })[]; ownerUserIds: Set<string> }> {
  const ownerUserIds = new Set<string>();
  try {
    const globalMuteKey = `mute:service:global`;
    if (await cache.get(globalMuteKey)) {
      console.log(`[alert-worker] Service Owner alerts are globally muted.`);
      return { channels: [], ownerUserIds };
    }

    const { rows: owners } = await db.query(
      `SELECT so.service_owner_id, so.channel_ids, so.channel_id, so.user_id, so.user_ids, so.group_ids,
              so.alert_recipients, so.alert_source_channel_id, so.alert_cc, so.alert_bcc,
              so.alert_crash_reasons,
              u.personal_channel_id, u.full_name, u.email
       FROM service_owners so
       LEFT JOIN users u ON so.user_id = u.user_id
       WHERE so.cluster_id = $1 AND so.org_id = $2
         AND (so.namespace IS NULL OR so.namespace = $3)
         AND (so.pod_prefix IS NULL OR $4 LIKE so.pod_prefix || '%')
       ORDER BY
         (CASE WHEN so.pod_prefix IS NOT NULL THEN 2 ELSE 0 END) +
         (CASE WHEN so.namespace  IS NOT NULL THEN 1 ELSE 0 END) DESC
       LIMIT 3`,
      [clusterId, orgId, namespace, podName]
    );

    if (!owners.length) return { channels: [], ownerUserIds };

    const { rows: orgRows } = await db.query(
      `SELECT default_alert_source_channel_id, default_alert_cc, default_alert_bcc FROM service_owner_settings WHERE org_id = $1`,
      [orgId]
    );
    const orgDefaults = orgRows[0] || {};

    const allUserIds = new Set<string>();
    for (const o of owners) {
      if (o.user_id) allUserIds.add(o.user_id);
      parseJsonArr(o.user_ids).forEach((uid: string) => allUserIds.add(uid));
      
      const gids = parseJsonArr(o.group_ids);
      if (gids.length > 0) {
        const { rows: members } = await db.query(
          `SELECT user_id FROM group_members WHERE group_id = ANY($1)`,
          [gids]
        );
        members.forEach((m: any) => {
          allUserIds.add(m.user_id);
        });
      }
    }

    const usersMap = new Map<string, { email: string; full_name: string; personal_channel_id: string }>();
    if (allUserIds.size > 0) {
      const { rows: users } = await db.query(
        `SELECT user_id, email, full_name, personal_channel_id FROM users WHERE user_id = ANY($1)`,
        [Array.from(allUserIds)]
      );
      users.forEach(u => {
        usersMap.set(u.user_id, u);
      });
    }

    const channelIds = new Set<string>();
    const channelUserMap = new Map<string, string>();
    const emailRoutings = new Map<string, { recipientEmails: string[], cc: string, bcc: string }>();

    for (const owner of owners) {
      const serviceMuteKey = `mute:service:${owner.service_owner_id}`;
      if (await cache.get(serviceMuteKey)) {
        console.log(`[alert-worker] Service mapping ${owner.service_owner_id} is currently muted. Skipping alerts.`);
        continue;
      }

      const reasons = parseJsonArr(owner.alert_crash_reasons);
      if (reasons.length > 0 && !reasons.includes(crashReason)) {
        console.log(`[alert-worker] Service owner filters out crash reason: ${crashReason} (allowed: ${reasons.join(", ")})`);
        continue;
      }

      if (owner.user_id) ownerUserIds.add(owner.user_id);
      parseJsonArr(owner.user_ids).forEach((uid: string) => {
        ownerUserIds.add(uid);
      });

      const gids = parseJsonArr(owner.group_ids);
      if (gids.length > 0) {
        const { rows: members } = await db.query(
          `SELECT user_id FROM group_members WHERE group_id = ANY($1)`,
          [gids]
        );
        members.forEach((m: any) => {
          ownerUserIds.add(m.user_id);
        });
      }

      // Load legacy/rule channels
      parseJsonArr(owner.channel_ids).forEach((id: string) => {
        channelIds.add(id);
        channelUserMap.set(id, owner.user_id);
      });
      if (owner.channel_id) {
        channelIds.add(owner.channel_id);
        channelUserMap.set(owner.channel_id, owner.user_id);
      }
      if (owner.personal_channel_id) {
        channelIds.add(owner.personal_channel_id);
        channelUserMap.set(owner.personal_channel_id, owner.user_id);
      }

      // Resolve dynamic source channel (falling back to global defaults)
      const hasAssignedOwners = !!owner.user_id || parseJsonArr(owner.user_ids).length > 0 || parseJsonArr(owner.group_ids).length > 0 || parseJsonArr(owner.alert_recipients).length > 0;
      
      let sourceChannelId = owner.alert_source_channel_id;
      if (!sourceChannelId) {
        if (!hasAssignedOwners) {
          console.log(`[alert-worker] Service mapping ${owner.service_owner_id} is Unassigned with no explicit channel assigned. Skipping fallback notification.`);
          continue;
        }
        const { rows: defCh } = await db.query(
          `SELECT channel_id FROM channels WHERE org_id = $1 AND channel_type = 'service_owner' AND is_global_default = true LIMIT 1`,
          [orgId]
        );
        if (defCh[0]?.channel_id) {
          sourceChannelId = defCh[0].channel_id;
        } else {
          sourceChannelId = orgDefaults.default_alert_source_channel_id;
        }
      }

      if (sourceChannelId) {
        // Resolve recipients
        const toItems: string[] = [];
        if (owner.user_id) toItems.push(owner.user_id);
        parseJsonArr(owner.user_ids).forEach((item: string) => toItems.push(item));
        parseJsonArr(owner.group_ids).forEach((item: string) => toItems.push(item));
        parseJsonArr(owner.alert_recipients).forEach((item: string) => toItems.push(item));

        let resolvedTo = await resolveRecipients(orgId, toItems);
        if (resolvedTo.length === 0) {
          if (!hasAssignedOwners && !owner.alert_source_channel_id) {
            console.log(`[alert-worker] Service mapping ${owner.service_owner_id} is Unassigned and has no resolved recipients. Skipping notification.`);
            continue;
          }
          const { rows: orgOwners } = await db.query(
            `SELECT email FROM users WHERE org_id = $1 AND role = 'owner'`,
            [orgId]
          );
          resolvedTo = orgOwners.map((u: any) => u.email).filter(Boolean);
        }

        if (resolvedTo.length === 0) {
          console.log(`[alert-worker] No valid recipient emails found for service mapping ${owner.service_owner_id}. Skipping.`);
          continue;
        }

        channelIds.add(sourceChannelId);
        channelUserMap.set(sourceChannelId, owner.user_id);

        let resolvedCc: string[] = [];
        if (owner.alert_cc && owner.alert_cc.trim()) {
          resolvedCc = await resolveRecipients(orgId, owner.alert_cc);
        } else if (orgDefaults.default_alert_cc && orgDefaults.default_alert_cc.trim()) {
          resolvedCc = await resolveRecipients(orgId, orgDefaults.default_alert_cc);
        }

        let resolvedBcc: string[] = [];
        if (owner.alert_bcc && owner.alert_bcc.trim()) {
          resolvedBcc = await resolveRecipients(orgId, owner.alert_bcc);
        } else if (orgDefaults.default_alert_bcc && orgDefaults.default_alert_bcc.trim()) {
          resolvedBcc = await resolveRecipients(orgId, orgDefaults.default_alert_bcc);
        }

        const existingRouting = emailRoutings.get(sourceChannelId);
        if (existingRouting) {
          resolvedTo.forEach(email => {
            if (!existingRouting.recipientEmails.includes(email)) {
              existingRouting.recipientEmails.push(email);
            }
          });
        } else {
          emailRoutings.set(sourceChannelId, {
            recipientEmails: resolvedTo,
            cc: resolvedCc.join(", "),
            bcc: resolvedBcc.join(", ")
          });
        }
      }

      const names = Array.from(ownerUserIds).map(uid => usersMap.get(uid)?.full_name || usersMap.get(uid)?.email || uid).join(", ");
      console.log(`[alert-worker] 👤 Matched service owner(s): ${names}`);
    }

    // 3. Notify admins
    const { rows: admins } = await db.query(
      `SELECT personal_channel_id, user_id AS id FROM users
       WHERE org_id = $1 AND role = 'admin' AND personal_channel_id IS NOT NULL`,
      [orgId]
    );
    admins.forEach((a) => {
      channelIds.add(a.personal_channel_id);
      channelUserMap.set(a.personal_channel_id, a.id);
    });

    const rawChannels = await getChannels(Array.from(channelIds));
    const channels = rawChannels.map((ch) => {
      const routing = emailRoutings.get(ch.id);
      if (ch.type === "email" && ch.channel_type === "service_owner" && routing) {
        return {
          ...ch,
          config: {
            ...ch.config,
            to: routing.recipientEmails.join(", "),
            cc: routing.cc,
            bcc: routing.bcc
          },
          userId: channelUserMap.get(ch.id)
        };
      }
      return {
        ...ch,
        userId: channelUserMap.get(ch.id)
      };
    });

    return { channels, ownerUserIds };
  } catch (err) {
    console.error("[alert-worker] Service owner lookup error:", err);
    return { channels: [], ownerUserIds };
  }
}

const ALGORITHM = "aes-256-cbc";

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY || "dev_key_replace_in_production_32c";
  return Buffer.from(createHash("sha256").update(raw).digest());
}

function decrypt(stored: string): string {
  const [ivHex, encHex] = stored.split(":");
  if (!ivHex || !encHex) throw new Error("Invalid encrypted value");
  const iv = Buffer.from(ivHex, "hex");
  const encrypted = Buffer.from(encHex, "hex");
  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

async function getChannels(channelIds: string[]): Promise<ChannelConfig[]> {
  if (!channelIds?.length) return [];
  const { rows } = await db.query(
    "SELECT channel_id AS id, type, config_encrypted, enabled, channel_type, is_global_default FROM channels WHERE channel_id = ANY($1)",
    [channelIds]
  );
  return rows.map((r) => {
    let config: Record<string, string> = {};
    try {
      config = JSON.parse(r.config_encrypted);
    } catch {
      try {
        config = JSON.parse(decrypt(r.config_encrypted));
      } catch (err) {
        console.error(`[alert-worker] Failed to decrypt config for channel ${r.id}:`, err);
        config = {};
      }
    }
    return { 
      id: r.id, 
      type: r.type, 
      config, 
      enabled: r.enabled !== false,
      channel_type: r.channel_type || "normal",
      is_global_default: !!r.is_global_default
    };
  });
}

function genId(prefix: string): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let randomPart = "";
  for (let i = 0; i < 11; i++) {
    randomPart += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${prefix}${randomPart}`;
}

async function upsertIncident(event: CrashEvent, rule: any): Promise<string | null> {
  try {
    const id = genId("inc");
    const { rows } = await db.query(
      `INSERT INTO incidents
         (incident_id, org_id, cluster_id, rule_id, pod_name, namespace, container_name,
          crash_reason, restart_count, exit_code, pod_labels, raw_event, severity)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING incident_id AS id`,
      [
        id,
        rule.org_id, event.cluster_id, rule.rule_id || rule.id,
        event.pod_name, event.namespace, event.container_name,
        event.crash_reason, event.restart_count, event.exit_code || null,
        JSON.stringify(event.pod_labels),
        JSON.stringify(event),
        rule.severity,
      ]
    );
    return rows[0]?.id || null;
  } catch (err) {
    console.error("[alert-worker] Failed to save incident:", err);
    return null;
  }
}

async function logResults(
  results: PromiseSettledResult<void>[],
  channels: ChannelConfig[],
  incidentId: string
) {
  for (let i = 0; i < results.length; i++) {
    const r  = results[i];
    const ch = channels[i];
    const status = r.status === "fulfilled" ? "sent" : "failed";
    const error  = r.status === "rejected"  ? String(r.reason) : null;
    console.log(`[alert-worker] ${ch.type}: ${status}${error ? " — " + error : ""}`);
    try {
      await db.query(
        `INSERT INTO alerts_sent (alert_sent_id, incident_id, channel_id, channel_type, status, error_message)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)`,
        [incidentId, ch.id, ch.type, status, error]
      );
      if (status === "sent")
        await db.query(`UPDATE channels SET last_success_at = now() WHERE channel_id = $1`, [ch.id]);
      else
        await db.query(`UPDATE channels SET last_error = $1 WHERE channel_id = $2`, [error, ch.id]);
    } catch {}
  }
}

function parseJsonArr(v: unknown): string[] {
  if (Array.isArray(v)) return v;
  if (typeof v === "string") { try { return JSON.parse(v); } catch { return []; } }
  return [];
}

interface SystemAlertEvent {
  event_type: string;
  org_id: string;
  cluster_id: string;
  cluster_name: string;
  title?: string;
  details?: string;
  channel_ids?: any;
}

function parseWorkerChannelIds(input: any): string[] {
  if (!input) return [];
  let current = input;
  while (typeof current === "string") {
    try {
      const parsed = JSON.parse(current);
      if (parsed === current) break;
      current = parsed;
    } catch {
      break;
    }
  }
  if (Array.isArray(current)) {
    return current.map(id => String(id).trim()).filter(Boolean);
  }
  if (typeof current === "string" && current.trim()) {
    return [current.trim()];
  }
  return [];
}

async function processSystemAlert(event: SystemAlertEvent): Promise<void> {
  console.log(`[alert-worker] [system-alert] ${event.event_type} on cluster/host '${event.cluster_name || "N/A"}'`);

  if (!event.org_id) {
    try {
      const { rows: orgRows } = await db.query("SELECT org_id FROM organizations LIMIT 1");
      if (orgRows[0]?.org_id) {
        event.org_id = orgRows[0].org_id;
      }
    } catch {}
  }

  const title = event.title || getSystemAlertTitle(event.event_type, event.cluster_name);
  let allowedEvents = ["cluster_connected", "cluster_disconnected", "cluster_deleted", "cluster_error"];
  let targetChannelIds: string[] = [];

  const isCustomResourceAlert = event.event_type === "resource_threshold_exceeded" || event.channel_ids !== undefined;

  if (isCustomResourceAlert) {
    // Custom Resource Alerts (Machine, Cluster Node, Pod) ALWAYS fire to their designated channels,
    // completely independent of the System Alerts ON/OFF toggle or System Alert Settings.
    targetChannelIds = parseWorkerChannelIds(event.channel_ids);
  } else {
    // Platform System Alerts (Cluster Disconnected, Reconnected, Connection Error, Configuration Deleted)
    // are controlled by the System Alerts configuration toggle & channel selection.
    if (event.org_id) {
      const { rows: settingsRows } = await db.query(
        "SELECT enabled, enabled_events, channel_ids FROM system_alert_settings WHERE org_id = $1",
        [event.org_id]
      );

      if (settingsRows.length > 0) {
        const settings = settingsRows[0];
        if (settings.enabled === false) {
          console.log(`[alert-worker] [system-alert] System alerts globally disabled for org ${event.org_id} — skipping platform alert`);
          return;
        }
        try {
          allowedEvents = typeof settings.enabled_events === "string" ? JSON.parse(settings.enabled_events) : (settings.enabled_events || []);
        } catch {}
        try {
          targetChannelIds = parseWorkerChannelIds(settings.channel_ids);
        } catch {}
      }
    }

    // Check if this platform event type is enabled
    if (!allowedEvents.includes(event.event_type)) {
      console.log(`[alert-worker] [system-alert] Platform event type ${event.event_type} is disabled in settings — skipping`);
      return;
    }
  }

  if (targetChannelIds.length === 0) {
    console.log(`[alert-worker] [system-alert] No target channels selected for system alert — skipping external dispatch`);
  } else {
    // Fetch channels for system alerts (ONLY the selected & enabled channel IDs)
    const query = "SELECT channel_id AS id, type, config_encrypted, enabled FROM channels WHERE channel_id = ANY($1)";
    const params: any[] = [targetChannelIds];

    const { rows: channels } = await db.query(query, params);
    const activeChannels = channels.filter(r => r.enabled !== false);
    if (activeChannels.length === 0 && channels.length > 0) {
      console.log(`[alert-worker] [system-alert] Target channels are disabled on Alert Channels page — skipping external dispatch`);
    } else if (activeChannels.length > 0) {
      const channelConfigs = activeChannels.map((r) => {
        let config: Record<string, string> = {};
        try {
          config = JSON.parse(r.config_encrypted);
        } catch {
          try {
            config = JSON.parse(decrypt(r.config_encrypted));
          } catch (err) {
            console.error(`[alert-worker] Failed to decrypt config for channel ${r.id}:`, err);
            config = {};
          }
        }
        return { id: r.id, type: r.type, config };
      });

      const results = await Promise.allSettled(
        channelConfigs.map((ch) => {
          const sanitizedCh = { ...ch, config: sanitizeConfig(ch.config) };
          return sendClusterAlert(sanitizedCh, {
            event_type: event.event_type,
            title,
            cluster_name: event.cluster_name,
            details: event.details,
          });
        })
      );

      results.forEach((r, idx) => {
        const ch = channelConfigs[idx];
        if (r.status === "rejected") {
          console.error(`[alert-worker] [system-alert] Failed to notify ${ch.type}:`, r.reason);
        } else {
          console.log(`[alert-worker] [system-alert] Notified ${ch.type} successfully`);
        }
      });
    }
  }

  // Insert system notification for all active non-muted users
  try {
    const details = event.details || "";
    const severity = "warning";

    const { rows: insertedNotifs } = await db.query(
      `INSERT INTO user_notifications (org_id, user_id, cluster_id, title, sub, severity, type)
       SELECT 
         $1, 
         u.user_id, 
         $5,
         $2, 
         $3, 
         $4, 
         'system'
       FROM users u
       LEFT JOIN user_alert_preferences p ON u.user_id = p.user_id
       WHERE u.org_id = $1 
         AND u.is_active = true
         AND (p.notifications_muted IS DISTINCT FROM true)
         AND (p.notifications_muted_until IS NULL OR p.notifications_muted_until < now())
       RETURNING user_id, notification_id, cluster_id, title, sub, severity, type, is_read, created_at`,
      [event.org_id, title, details, severity, event.cluster_id]
    );

    // Publish to Redis
    for (const notif of insertedNotifs) {
      const payload = {
        id: notif.notification_id,
        incident_id: null,
        cluster_id: notif.cluster_id,
        title: notif.title,
        sub: notif.sub,
        severity: notif.severity,
        type: notif.type,
        read: notif.is_read,
        time: notif.created_at
      };
      await cache.publish(`srevox:notifications:${notif.user_id}`, JSON.stringify({ type: "notification", notification: payload }));
    }
  } catch (err) {
    console.error("[alert-worker] Failed to save system notification:", err);
  }
}

function getSystemAlertTitle(eventType: string, clusterName: string): string {
  switch (eventType) {
    case "resource_threshold_exceeded":
      return `Resource Alert on '${clusterName}'`;
    case "cluster_deleted":
      return `Cluster '${clusterName}' Deleted`;
    case "cluster_error":
      return `Cluster '${clusterName}' Connection Error`;
    case "cluster_disconnected":
      return `Cluster '${clusterName}' Disconnected`;
    case "cluster_connected":
      return `Cluster '${clusterName}' Reconnected`;
    default:
      return `Cluster Alert on '${clusterName}'`;
  }
}

async function checkClusterHeartbeats(): Promise<void> {
  // Find clusters of type 'agent' that haven't sent a heartbeat for > 3 minutes (or pending clusters > 15 mins old)
  const { rows: timedOutClusters } = await db.query(
    `SELECT cluster_id, org_id, name, status, last_seen_at
     FROM clusters
     WHERE connection_type = 'agent'
       AND (
         (status = 'connected' AND last_seen_at < now() - interval '3 minutes') OR
         (status = 'pending' AND created_at < now() - interval '15 minutes' AND (last_seen_at IS NULL OR last_seen_at < now() - interval '3 minutes'))
       )`
  );

  for (const cluster of timedOutClusters) {
    console.log(`[heartbeat-check] Cluster '${cluster.name}' (${cluster.cluster_id}) timed out (last seen: ${cluster.last_seen_at})`);
    
    // Update status to 'disconnected'
    await db.query(
      `UPDATE clusters SET status = 'disconnected' WHERE cluster_id = $1`,
      [cluster.cluster_id]
    );

    // Enforce 15-minute cooldown to prevent spamming disconnect email alerts
    const cooldownKey = `cooldown:alert:cluster_disconnected:${cluster.cluster_id}`;
    const activeCooldown = await cache.get(cooldownKey);
    if (!activeCooldown) {
      await cache.setex(cooldownKey, 900, "1"); // 15 mins cooldown
      await processSystemAlert({
        event_type: "cluster_disconnected",
        org_id: cluster.org_id,
        cluster_id: cluster.cluster_id,
        cluster_name: cluster.name,
        details: `No heartbeat received since ${cluster.last_seen_at ? new Date(cluster.last_seen_at).toUTCString() : "never"}. Agent is likely down or disconnected.`,
      });
    }
  }
}

async function checkAndRunRetentionPurges(): Promise<void> {
  console.log("[alert-worker] 🧹 Checking dynamic retention policy sweeps...");

  try {
    const { rows: policies } = await db.query(
      `SELECT org_id, activity_days, incident_days, COALESCE(purge_interval_hours, 4) as interval_hours, last_logs_purge_at, last_incidents_purge_at 
       FROM retention_policies`
    );

    for (const policy of policies) {
      const { org_id, activity_days, incident_days, interval_hours, last_logs_purge_at, last_incidents_purge_at } = policy;

      // 1. Logs sweep
      if (activity_days && activity_days > 0) {
        let lastLogTime = last_logs_purge_at ? new Date(last_logs_purge_at).getTime() : 0;
        if (!lastLogTime) {
          const { rows: lastLogRuns } = await db.query(
            `SELECT completed_at FROM retention_runs 
             WHERE org_id = $1 AND run_type = 'logs' 
             ORDER BY completed_at DESC LIMIT 1`,
            [org_id]
          );
          lastLogTime = lastLogRuns[0]?.completed_at ? new Date(lastLogRuns[0].completed_at).getTime() : Date.now();
        }

        const hoursSinceLog = (Date.now() - lastLogTime) / (60 * 60 * 1000);

        if (hoursSinceLog >= interval_hours) {
          const { rows: deletedLogs } = await db.query(
            `DELETE FROM activity_log 
             WHERE org_id = $1 
               AND created_at < now() - ($2 * interval '1 day')
             RETURNING action, resource, resource_id, created_at`,
            [org_id, activity_days]
          );
          const logsDetails = JSON.stringify(deletedLogs || []);

          await db.query(
            `UPDATE retention_policies SET last_logs_purge_at = now() WHERE org_id = $1`,
            [org_id]
          );

          await db.query(
            `INSERT INTO retention_runs (org_id, run_type, items_purged, purged_details) VALUES ($1, $2, $3, $4)`,
            [org_id, 'logs', deletedLogs.length || 0, logsDetails]
          );

          if (deletedLogs.length > 0) {
            console.log(`[alert-worker] 🧹 Purged ${deletedLogs.length} activity logs for org ${org_id}`);
          }
        }
      }

      // 2. Incidents sweep
      if (incident_days && incident_days > 0) {
        let lastIncTime = last_incidents_purge_at ? new Date(last_incidents_purge_at).getTime() : 0;
        if (!lastIncTime) {
          const { rows: lastIncRuns } = await db.query(
            `SELECT completed_at FROM retention_runs 
             WHERE org_id = $1 AND run_type = 'incidents' 
             ORDER BY completed_at DESC LIMIT 1`,
            [org_id]
          );
          lastIncTime = lastIncRuns[0]?.completed_at ? new Date(lastIncRuns[0].completed_at).getTime() : Date.now();
        }

        const hoursSinceInc = (Date.now() - lastIncTime) / (60 * 60 * 1000);

        if (hoursSinceInc >= interval_hours) {
          const { rows: deletedIncs } = await db.query(
            `DELETE FROM incidents 
             WHERE org_id = $1 
               AND first_seen_at < now() - ($2 * interval '1 day')
             RETURNING pod_name, namespace, crash_reason, first_seen_at`,
            [org_id, incident_days]
          );
          const incDetails = JSON.stringify(deletedIncs || []);

          await db.query(
            `UPDATE retention_policies SET last_incidents_purge_at = now() WHERE org_id = $1`,
            [org_id]
          );

          await db.query(
            `INSERT INTO retention_runs (org_id, run_type, items_purged, purged_details) VALUES ($1, $2, $3, $4)`,
            [org_id, 'incidents', deletedIncs.length || 0, incDetails]
          );

          if (deletedIncs.length > 0) {
            console.log(`[alert-worker] 🧹 Purged ${deletedIncs.length} incidents for org ${org_id}`);
          }
        }
      }
    }
  } catch (err) {
    console.error("[alert-worker] Error in dynamic retention purge sweep:", err);
  }
}


process.on("SIGTERM", async () => {
  console.log("[alert-worker] Shutting down...");
  await subscriber.quit();
  await cache.quit();
  await db.end();
  process.exit(0);
});

main().catch((err) => {
  console.error("[alert-worker] Fatal:", err);
  process.exit(1);
});