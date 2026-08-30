import { FastifyInstance } from "fastify";
import { genId } from "../utils/id.js";
import sql from "../db/sql.js";
import { getUser, requirePermission } from "../middleware/rbac.js";
import { sendEmail } from "../services/email.js";
import { decrypt } from "../services/crypto.js";
import { logActivity } from "../services/activity.js";
import axios from "axios";

const parseArr = (v: unknown): string[] =>
  typeof v === "string" ? JSON.parse(v) : (Array.isArray(v) ? v : []);

export default async function serviceOwnerRoutes(app: FastifyInstance) {

  // GET /api/service-owners — list all services
  app.get("/", { onRequest: [(app as any).authenticate, requirePermission("viewServiceOwners")] }, async (req) => {
    const { org_id } = getUser(req);
    const owners = await sql`
      SELECT
        so.*,
        c.name       as cluster_name,
        CASE
          WHEN ch.channel_id IS NOT NULL THEN so.alert_source_channel_id
          ELSE NULL
        END as alert_source_channel_id
      FROM service_owners so
      LEFT JOIN clusters c ON so.cluster_id    = c.cluster_id
      LEFT JOIN channels ch ON so.alert_source_channel_id = ch.channel_id
      WHERE so.org_id = ${org_id}
      ORDER BY so.created_at DESC
    `;
    const users = await sql`SELECT user_id, email, full_name, role FROM users WHERE org_id = ${org_id}`;
    const userMap = new Map(users.map(u => [u.user_id, u]));

    const groups = await sql`SELECT group_id, name, description FROM groups WHERE org_id = ${org_id}`;
    const groupMap = new Map(groups.map(g => [g.group_id, g]));

    const allChs = await sql`SELECT channel_id, name, type FROM channels WHERE org_id = ${org_id}`;
    const [settings] = await sql`
      SELECT s.default_alert_source_channel_id
      FROM service_owner_settings s
      LEFT JOIN channels ch ON s.default_alert_source_channel_id = ch.channel_id
      WHERE s.org_id = ${org_id}
    `;
    const defaultChannelId = settings?.default_alert_source_channel_id || null;

    const redis = (await import("../db/redis.js")).default;
    const serviceOwnersMapped = await Promise.all(owners.map(async (o) => {
      const userIds = parseArr(o.user_ids);
      if (userIds.length === 0 && o.user_id) {
        userIds.push(o.user_id);
      }
      const assignedUsers = userIds.map(uid => userMap.get(uid)).filter(Boolean);
      const groupIds = parseArr(o.group_ids);
      const assignedGroups = groupIds.map(gid => groupMap.get(gid)).filter(Boolean);

      const ttl = await redis.ttl(`mute:service:${o.service_owner_id}`);
      const isMuted = ttl !== -2;
      const mutedTtl = isMuted ? (ttl > 0 ? ttl : null) : null;

      let sourceChannel = null;
      const targetChannelId = o.alert_source_channel_id || defaultChannelId;
      if (targetChannelId) {
        const found = allChs.find(c => c.channel_id === targetChannelId);
        if (found) {
          sourceChannel = {
            channel_id: found.channel_id,
            name: found.name,
            type: found.type
          };
        }
      }

      return {
        ...o,
        user_ids: userIds,
        owners: assignedUsers,
        owner_name: assignedUsers[0]?.full_name || "",
        owner_email: assignedUsers[0]?.email || "",
        group_ids: groupIds,
        groups: assignedGroups,
        channel_ids: parseArr(o.channel_ids),
        alert_crash_reasons: parseArr(o.alert_crash_reasons),
        muted: isMuted,
        muted_ttl: mutedTtl,
        alert_source_channel: sourceChannel,
      };
    }));

    return {
      service_owners: serviceOwnersMapped,
    };
  });

  // POST /api/service-owners — admin only (add service)
  app.post("/", {
    onRequest: [(app as any).authenticate, requirePermission("addServiceOwner")],
  }, async (req, reply) => {
    const { org_id, sub: requestUserId } = getUser(req);
    const {
      cluster_id, namespace, pod_prefix,
      user_ids = [], group_ids = [], channel_ids = [], channel_id,
      alert_source_channel_id, alert_cc, alert_bcc
    } = req.body as {
      cluster_id: string;
      namespace?: string;
      pod_prefix?: string;
      user_ids?: string[];
      group_ids?: string[];
      channel_ids?: string[];
      channel_id?: string | null;
      alert_source_channel_id?: string | null;
      alert_cc?: string | null;
      alert_bcc?: string | null;
    };

    if (!cluster_id)
      return reply.status(400).send({ detail: "cluster_id is required" });

    // Verify cluster belongs to this org
    const [cluster] = await sql`SELECT cluster_id AS id FROM clusters WHERE cluster_id = ${cluster_id} AND org_id = ${org_id}`;
    if (!cluster) return reply.status(404).send({ detail: "Cluster not in your org" });

    if (user_ids && user_ids.length > 0) {
      const users = await sql`SELECT user_id FROM users WHERE user_id = ANY(${user_ids}) AND org_id = ${org_id}`;
      if (users.length !== user_ids.length) {
        return reply.status(404).send({ detail: "One or more users not found in your org" });
      }
    }

    if (group_ids && group_ids.length > 0) {
      const groups = await sql`SELECT group_id FROM groups WHERE group_id = ANY(${group_ids}) AND org_id = ${org_id}`;
      if (groups.length !== group_ids.length) {
        return reply.status(404).send({ detail: "One or more groups not found in your org" });
      }
    }

    if (alert_source_channel_id) {
      const [channel] = await sql`
        SELECT channel_id, channel_type FROM channels 
        WHERE channel_id = ${alert_source_channel_id} AND org_id = ${org_id}
      `;
      if (!channel) return reply.status(404).send({ detail: "Alert channel not found" });
      if (channel.channel_type !== "service_owner") {
        return reply.status(400).send({ detail: "Channel must be of type 'Service Owner'" });
      }
    }

    const id = genId("srv");
    const legacyUserId = user_ids[0] || null;

    await sql`
      INSERT INTO service_owners
        (service_owner_id, org_id, cluster_id, namespace, pod_prefix, user_id, user_ids, group_ids, channel_ids, channel_id, alert_source_channel_id, alert_cc, alert_bcc)
      VALUES
        (${id}, ${org_id}, ${cluster_id},
         ${namespace || null}, ${pod_prefix || null},
         ${legacyUserId}, ${JSON.stringify(user_ids)}, ${JSON.stringify(group_ids)}, ${JSON.stringify(channel_ids)}, ${channel_id || null},
         ${alert_source_channel_id || null}, ${alert_cc || null}, ${alert_bcc || null})
    `;

    // Log activity
    await logActivity({
      org_id,
      user_id: requestUserId,
      action: "service_created",
      resource: "service",
      resource_id: id,
      metadata: { pod_prefix, namespace, user_ids }
    });

    if (user_ids && user_ids.length > 0) {
      const addedUsers = await sql`SELECT full_name, email FROM users WHERE user_id = ANY(${user_ids}) AND org_id = ${org_id}`;
      for (const au of addedUsers) {
        const name = au.full_name?.trim() || au.email || "User";
        await logActivity({
          org_id,
          user_id: requestUserId,
          action: "owner_assigned",
          resource: "service",
          resource_id: id,
          metadata: { owner_name: name }
        });
      }
    }

    return { service_owner_id: id, message: "Service assigned" };
  });

  // POST /api/service-owners/bulk-create — admin only (bulk service creation)
  app.post("/bulk-create", {
    onRequest: [(app as any).authenticate, requirePermission("addServiceOwner")],
  }, async (req, reply) => {
    const { org_id, sub: requestUserId } = getUser(req);
    const { cluster_id, services = [] } = req.body as {
      cluster_id: string;
      services: { service_name: string; namespace?: string }[];
    };

    if (!cluster_id)
      return reply.status(400).send({ detail: "cluster_id is required" });

    // Verify cluster belongs to this org
    const [cluster] = await sql`SELECT cluster_id AS id FROM clusters WHERE cluster_id = ${cluster_id} AND org_id = ${org_id}`;
    if (!cluster) return reply.status(404).send({ detail: "Cluster not in your org" });

    const results = [];
    for (const item of services) {
      const serviceName = item.service_name?.trim();
      const namespace = item.namespace?.trim() || null;

      if (!serviceName) {
        results.push({ service_name: "", namespace: namespace || "", status: "error", detail: "Service name is required" });
        continue;
      }

      try {
        const [existing] = await sql`
          SELECT service_owner_id FROM service_owners
          WHERE org_id = ${org_id}
            AND cluster_id = ${cluster_id}
            AND (namespace = ${namespace} OR (namespace IS NULL AND ${namespace}::text IS NULL))
            AND (pod_prefix = ${serviceName} OR (pod_prefix IS NULL AND ${serviceName}::text IS NULL))
        `;
        if (existing) {
          results.push({ service_name: serviceName, namespace: namespace || "", status: "skipped", detail: "Service already exists" });
          continue;
        }

        const id = genId("srv");
        await sql`
          INSERT INTO service_owners
            (service_owner_id, org_id, cluster_id, namespace, pod_prefix, user_id, user_ids, channel_ids, channel_id, alert_source_channel_id)
          VALUES
            (${id}, ${org_id}, ${cluster_id}, ${namespace}, ${serviceName}, null, '[]', '[]', null, null)
        `;

        // Log activity
        await logActivity({
          org_id,
          user_id: requestUserId,
          action: "service_created",
          resource: "service",
          resource_id: id,
          metadata: { pod_prefix: serviceName, namespace }
        });

        results.push({ service_name: serviceName, namespace: namespace || "", status: "created" });
      } catch (err: any) {
        results.push({ service_name: serviceName, namespace: namespace || "", status: "error", detail: err.message || "Database error" });
      }
    }

    return { results };
  });

  // GET /api/service-owners/alerts-metrics
  app.get("/alerts-metrics", { onRequest: [(app as any).authenticate, requirePermission("viewServiceOwners")] }, async (req) => {
    const { org_id } = getUser(req);
    const { start_date, end_date, interval = "hour" } = req.query as { start_date?: string; end_date?: string; interval?: string };

    let parsedStart = start_date ? new Date(start_date) : new Date(Date.now() - 24 * 3600 * 1000);
    let parsedEnd = end_date ? new Date(end_date) : new Date();

    let metrics = [];
    if (interval === "5m") {
      metrics = await sql`
        SELECT 
          to_timestamp(floor(extract(epoch from a.sent_at) / 300) * 300) as period,
          COUNT(*)::int as count
        FROM alerts_sent a
        JOIN incidents i ON a.incident_id = i.incident_id
        WHERE i.org_id = ${org_id}
          AND a.sent_at >= ${parsedStart}
          AND a.sent_at <= ${parsedEnd}
        GROUP BY period
        ORDER BY period ASC
      `;
    } else if (interval === "1h" || interval === "hour") {
      metrics = await sql`
        SELECT 
          DATE_TRUNC('hour', a.sent_at) as period,
          COUNT(*)::int as count
        FROM alerts_sent a
        JOIN incidents i ON a.incident_id = i.incident_id
        WHERE i.org_id = ${org_id}
          AND a.sent_at >= ${parsedStart}
          AND a.sent_at <= ${parsedEnd}
        GROUP BY period
        ORDER BY period ASC
      `;
    } else {
      metrics = await sql`
        SELECT 
          DATE_TRUNC('day', a.sent_at) as period,
          COUNT(*)::int as count
        FROM alerts_sent a
        JOIN incidents i ON a.incident_id = i.incident_id
        WHERE i.org_id = ${org_id}
          AND a.sent_at >= ${parsedStart}
          AND a.sent_at <= ${parsedEnd}
        GROUP BY period
        ORDER BY period ASC
      `;
    }
    // Fill in missing periods with 0 count
    const bucketMs = interval === "5m" ? 300 * 1000 : (interval === "1h" || interval === "hour" ? 3600 * 1000 : 86400 * 1000);
    const startMs = Math.floor(parsedStart.getTime() / bucketMs) * bucketMs;
    const endMs = Math.floor(parsedEnd.getTime() / bucketMs) * bucketMs;

    const bucketMap = new Map(metrics.map((m: any) => [new Date(m.period).getTime(), m.count]));

    const filledMetrics = [];
    for (let time = startMs; time <= endMs; time += bucketMs) {
      const count = bucketMap.get(time) || 0;
      filledMetrics.push({
        period: new Date(time).toISOString(),
        count: count
      });
    }

    // Fetch alerts detail to group counts per service owner
    const alerts = await sql`
      SELECT 
        a.alert_sent_id,
        i.cluster_id,
        i.namespace,
        i.pod_name
      FROM alerts_sent a
      JOIN incidents i ON a.incident_id = i.incident_id
      WHERE i.org_id = ${org_id}
        AND a.sent_at >= ${parsedStart}
        AND a.sent_at <= ${parsedEnd}
    `;

    const owners = await sql`
      SELECT service_owner_id, cluster_id, namespace, pod_prefix
      FROM service_owners
      WHERE org_id = ${org_id}
    `;

    const serviceCounts = owners.map(o => {
      const matchedAlerts = alerts.filter(a => {
        const clusterMatch = a.cluster_id === o.cluster_id;
        const nsMatch = !o.namespace || a.namespace === o.namespace;
        const podMatch = !o.pod_prefix || (a.pod_name && a.pod_name.startsWith(o.pod_prefix));
        return clusterMatch && nsMatch && podMatch;
      });
      return {
        service_owner_id: o.service_owner_id,
        count: matchedAlerts.length
      };
    });

    return { metrics: filledMetrics, serviceCounts };
  });

  // POST /api/service-owners/bulk-delete — admin only
  app.post("/bulk-delete", {
    onRequest: [(app as any).authenticate, requirePermission("deleteServiceOwner")],
  }, async (req) => {
    const { org_id } = getUser(req);
    const { ids } = req.body as { ids: string[] };
    if (!ids || ids.length === 0) return { count: 0 };
    await sql`DELETE FROM service_owners WHERE service_owner_id = ANY(${ids}) AND org_id = ${org_id}`;
    return { count: ids.length };
  });

  // DELETE /api/service-owners/:id — admin only
  app.delete("/:id", {
    onRequest: [(app as any).authenticate, requirePermission("deleteServiceOwner")],
  }, async (req) => {
    const { org_id } = getUser(req);
    const { id } = req.params as { id: string };
    await sql`DELETE FROM service_owners WHERE service_owner_id = ${id} AND org_id = ${org_id}`;
    return { message: "Deleted" };
  });

  // GET /api/service-owners/:id — authenticate (get service details, incidents, alert rules, activities)
  app.get("/:id", { onRequest: [(app as any).authenticate, requirePermission("viewServiceOwners")] }, async (req, reply) => {
    const { org_id } = getUser(req);
    const { id } = req.params as { id: string };
    const [owner] = await sql`
      SELECT
        so.*,
        c.name       as cluster_name,
        CASE
          WHEN ch.channel_id IS NOT NULL THEN so.alert_source_channel_id
          ELSE NULL
        END as alert_source_channel_id
      FROM service_owners so
      LEFT JOIN clusters c ON so.cluster_id    = c.cluster_id
      LEFT JOIN channels ch ON so.alert_source_channel_id = ch.channel_id
      WHERE so.service_owner_id = ${id} AND so.org_id = ${org_id}
    `;
    if (!owner) return reply.status(404).send({ detail: "Not found" });

    const userIds = parseArr(owner.user_ids);
    if (userIds.length === 0 && owner.user_id) {
      userIds.push(owner.user_id);
    }

    let ownersList: any[] = [];
    if (userIds.length > 0) {
      ownersList = await sql`
        SELECT user_id, email, full_name, role 
        FROM users 
        WHERE user_id = ANY(${userIds}) AND org_id = ${org_id}
      `;
    }

    const groupIds = parseArr(owner.group_ids);
    let groupsList: any[] = [];
    if (groupIds.length > 0) {
      groupsList = await sql`
        SELECT group_id, name, description
        FROM groups
        WHERE group_id = ANY(${groupIds}) AND org_id = ${org_id}
      `;
    }

    // Fetch related incidents matching cluster, namespace, and pod_prefix
    const incidents = await sql`
      SELECT i.*, u.full_name as resolved_by_name
      FROM incidents i
      LEFT JOIN users u ON i.resolved_by = u.user_id
      WHERE i.org_id = ${org_id} 
        AND i.cluster_id = ${owner.cluster_id}
        AND (i.namespace = ${owner.namespace} OR ${owner.namespace}::text IS NULL)
        AND (i.pod_name LIKE ${owner.pod_prefix || ""} || '%')
      ORDER BY i.last_seen_at DESC
      LIMIT 20
    `;

    // Fetch alert rules active on the same cluster
    const rules = await sql`
      SELECT * FROM alert_rules
      WHERE org_id = ${org_id} 
        AND (cluster_id = ${owner.cluster_id} OR cluster_id IS NULL)
      ORDER BY created_at DESC
    `;

    // Fetch service activity logs from activity_log
    const dbActivities = await sql`
      SELECT 
        al.activity_log_id,
        al.org_id,
        al.user_id,
        al.action,
        al.resource,
        al.resource_id,
        al.metadata,
        al.created_at,
        u.full_name as user_name,
        u.email      as user_email
      FROM activity_log al
      LEFT JOIN users u ON al.user_id = u.user_id
      WHERE al.resource_id = ${id} AND al.org_id = ${org_id}
    `;

    // Fetch alerts sent for matching incidents on-the-fly
    const dbAlerts = await sql`
      SELECT 
        a.alert_sent_id as activity_log_id,
        a.channel_type,
        a.sent_at as created_at,
        i.severity,
        u.email as user_email,
        u.full_name as user_name,
        c.name as channel_name
      FROM alerts_sent a
      JOIN incidents i ON a.incident_id = i.incident_id
      LEFT JOIN channels c ON a.channel_id = c.channel_id
      LEFT JOIN users u ON c.channel_id = u.personal_channel_id
      WHERE i.org_id = ${org_id}
        AND i.cluster_id = ${owner.cluster_id}
        AND (i.namespace = ${owner.namespace} OR ${owner.namespace}::text IS NULL)
        AND (i.pod_name LIKE ${owner.pod_prefix || ""} || '%')
    `;

    // Map alerts to activity timeline entries
    const mappedAlerts = dbAlerts.map(a => {
      const recipient = a.user_email || a.channel_name || (a.channel_type === 'mail' ? 'email' : a.channel_type);
      return {
        activity_log_id: a.activity_log_id,
        org_id,
        user_id: null,
        action: "alert_sent",
        resource: "service",
        resource_id: id,
        created_at: a.created_at,
        user_name: a.user_name || "System",
        user_email: a.user_email || "",
        metadata: {
          severity: a.severity?.toUpperCase() || "WARNING",
          recipient: recipient
        }
      };
    });

    const allActivities = [...dbActivities, ...mappedAlerts].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    const [settings] = await sql`SELECT default_alert_source_channel_id FROM service_owner_settings WHERE org_id = ${org_id}`;
    const defaultChannelId = settings?.default_alert_source_channel_id || null;

    let sourceChannel = null;
    const targetChannelId = owner.alert_source_channel_id || defaultChannelId;
    if (targetChannelId) {
      const [ch] = await sql`
        SELECT channel_id, name, type FROM channels WHERE channel_id = ${targetChannelId} AND org_id = ${org_id}
      `;
      if (ch) {
        sourceChannel = {
          channel_id: ch.channel_id,
          name: ch.name,
          type: ch.type
        };
      }
    }

    const redis = (await import("../db/redis.js")).default;
    const ttl = await redis.ttl(`mute:service:${id}`);
    const isMuted = ttl !== -2;
    const mutedTtl = isMuted ? (ttl > 0 ? ttl : null) : null;

    return {
      ...owner,
      user_ids: userIds,
      owners: ownersList,
      group_ids: groupIds,
      groups: groupsList,
      channel_ids: parseArr(owner.channel_ids),
      alert_source_channel_id: owner.alert_source_channel_id || null,
      alert_source_channel: sourceChannel,
      alert_recipients: parseArr(owner.alert_recipients),
      alert_cc: owner.alert_cc || "",
      alert_bcc: owner.alert_bcc || "",
      alert_mail_template_id: owner.alert_mail_template_id || "",
      alert_crash_reasons: parseArr(owner.alert_crash_reasons),
      muted: isMuted,
      muted_ttl: mutedTtl,
      incidents,
      rules,
      activities: allActivities
    };
  });

  // PATCH /api/service-owners/:id — admin only (update service attributes / assign owners)
  app.patch("/:id", {
    onRequest: [(app as any).authenticate, requirePermission("addServiceOwner")],
  }, async (req, reply) => {
    const { org_id, sub: requestUserId } = getUser(req);
    const { id } = req.params as { id: string };
    const {
      cluster_id, namespace, pod_prefix,
      user_ids, group_ids, channel_ids, channel_id,
      alert_source_channel_id, alert_recipients, alert_cc, alert_bcc, alert_mail_template_id,
      alert_crash_reasons
    } = req.body as {
      cluster_id?: string;
      namespace?: string;
      pod_prefix?: string;
      user_ids?: string[];
      group_ids?: string[];
      channel_ids?: string[];
      channel_id?: string | null;
      alert_source_channel_id?: string | null;
      alert_recipients?: any[];
      alert_cc?: string | null;
      alert_bcc?: string | null;
      alert_mail_template_id?: string | null;
      alert_crash_reasons?: string[];
    };

    // Verify if exists
    const [existing] = await sql`
      SELECT 
        user_ids, group_ids, alert_source_channel_id, alert_recipients, 
        alert_cc, alert_bcc, alert_mail_template_id, alert_crash_reasons
      FROM service_owners 
      WHERE service_owner_id = ${id} AND org_id = ${org_id}
    `;
    if (!existing) return reply.status(404).send({ detail: "Not found" });

    if (group_ids !== undefined) {
      if (group_ids.length > 0) {
        const groups = await sql`SELECT group_id FROM groups WHERE group_id = ANY(${group_ids}) AND org_id = ${org_id}`;
        if (groups.length !== group_ids.length) {
          return reply.status(404).send({ detail: "One or more groups not found in your org" });
        }
      }
    }

    if (alert_source_channel_id) {
      const [channel] = await sql`
        SELECT channel_id, channel_type FROM channels 
        WHERE channel_id = ${alert_source_channel_id} AND org_id = ${org_id}
      `;
      if (!channel) return reply.status(404).send({ detail: "Alert channel not found" });
      if (channel.channel_type !== "service_owner") {
        return reply.status(400).send({ detail: "Channel must be of type 'Service Owner'" });
      }
    }

    if (cluster_id !== undefined && cluster_id !== null) {
      const [cluster] = await sql`SELECT cluster_id AS id FROM clusters WHERE cluster_id = ${cluster_id} AND org_id = ${org_id}`;
      if (!cluster) return reply.status(404).send({ detail: "Cluster not in your org" });
    }

    if (user_ids !== undefined) {
      if (user_ids.length > 0) {
        const users = await sql`SELECT user_id FROM users WHERE user_id = ANY(${user_ids}) AND org_id = ${org_id}`;
        if (users.length !== user_ids.length) {
          return reply.status(404).send({ detail: "One or more users not found in your org" });
        }
      }
    }

    if (cluster_id !== undefined) {
      await sql`UPDATE service_owners SET cluster_id = ${cluster_id} WHERE service_owner_id = ${id} AND org_id = ${org_id}`;
    }
    if (namespace !== undefined) {
      await sql`UPDATE service_owners SET namespace = ${namespace || null} WHERE service_owner_id = ${id} AND org_id = ${org_id}`;
    }
    if (pod_prefix !== undefined) {
      await sql`UPDATE service_owners SET pod_prefix = ${pod_prefix || null} WHERE service_owner_id = ${id} AND org_id = ${org_id}`;
    }
    if (user_ids !== undefined) {
      const prevUserIds: string[] = parseArr(existing.user_ids);
      const addedIds = user_ids.filter(uid => !prevUserIds.includes(uid));
      const removedIds = prevUserIds.filter(uid => !user_ids.includes(uid));

      if (addedIds.length > 0) {
        const addedUsers = await sql`SELECT full_name, email FROM users WHERE user_id = ANY(${addedIds}) AND org_id = ${org_id}`;
        for (const au of addedUsers) {
          const name = au.full_name?.trim() || au.email || "User";
          await logActivity({
            org_id,
            user_id: requestUserId,
            action: "owner_assigned",
            resource: "service",
            resource_id: id,
            metadata: { owner_name: name }
          });
        }
      }

      if (removedIds.length > 0) {
        const removedUsers = await sql`SELECT full_name, email FROM users WHERE user_id = ANY(${removedIds}) AND org_id = ${org_id}`;
        for (const ru of removedUsers) {
          const name = ru.full_name?.trim() || ru.email || "User";
          await logActivity({
            org_id,
            user_id: requestUserId,
            action: "owner_removed",
            resource: "service",
            resource_id: id,
            metadata: { owner_name: name }
          });
        }
      }

      const legacyUserId = user_ids[0] || null;
      await sql`UPDATE service_owners SET user_ids = ${JSON.stringify(user_ids)}, user_id = ${legacyUserId} WHERE service_owner_id = ${id} AND org_id = ${org_id}`;
    }
    if (group_ids !== undefined) {
      const prevGroupIds: string[] = parseArr(existing.group_ids);
      const addedIds = group_ids.filter(gid => !prevGroupIds.includes(gid));
      const removedIds = prevGroupIds.filter(gid => !group_ids.includes(gid));

      if (addedIds.length > 0) {
        const addedGroups = await sql`SELECT name FROM groups WHERE group_id = ANY(${addedIds}) AND org_id = ${org_id}`;
        for (const ag of addedGroups) {
          await logActivity({
            org_id,
            user_id: requestUserId,
            action: "owner_assigned",
            resource: "service",
            resource_id: id,
            metadata: { owner_name: `Group: ${ag.name}` }
          });
        }
      }

      if (removedIds.length > 0) {
        const removedGroups = await sql`SELECT name FROM groups WHERE group_id = ANY(${removedIds}) AND org_id = ${org_id}`;
        for (const rg of removedGroups) {
          await logActivity({
            org_id,
            user_id: requestUserId,
            action: "owner_removed",
            resource: "service",
            resource_id: id,
            metadata: { owner_name: `Group: ${rg.name}` }
          });
        }
      }

      await sql`UPDATE service_owners SET group_ids = ${JSON.stringify(group_ids)} WHERE service_owner_id = ${id} AND org_id = ${org_id}`;
    }
    if (channel_ids !== undefined) {
      await sql`UPDATE service_owners SET channel_ids = ${JSON.stringify(channel_ids)} WHERE service_owner_id = ${id} AND org_id = ${org_id}`;
    }
    if (channel_id !== undefined) {
      await sql`UPDATE service_owners SET channel_id = ${channel_id || null} WHERE service_owner_id = ${id} AND org_id = ${org_id}`;
    }

    if (alert_source_channel_id !== undefined) {
      await sql`UPDATE service_owners SET alert_source_channel_id = ${alert_source_channel_id || null} WHERE service_owner_id = ${id} AND org_id = ${org_id}`;
    }
    if (alert_recipients !== undefined) {
      await sql`UPDATE service_owners SET alert_recipients = ${JSON.stringify(alert_recipients)} WHERE service_owner_id = ${id} AND org_id = ${org_id}`;
    }
    if (alert_cc !== undefined) {
      await sql`UPDATE service_owners SET alert_cc = ${alert_cc || null} WHERE service_owner_id = ${id} AND org_id = ${org_id}`;
    }
    if (alert_bcc !== undefined) {
      await sql`UPDATE service_owners SET alert_bcc = ${alert_bcc || null} WHERE service_owner_id = ${id} AND org_id = ${org_id}`;
    }
    if (alert_mail_template_id !== undefined) {
      await sql`UPDATE service_owners SET alert_mail_template_id = ${alert_mail_template_id || null} WHERE service_owner_id = ${id} AND org_id = ${org_id}`;
    }
    if (alert_crash_reasons !== undefined) {
      await sql`UPDATE service_owners SET alert_crash_reasons = ${JSON.stringify(alert_crash_reasons)} WHERE service_owner_id = ${id} AND org_id = ${org_id}`;
    }

    // Compile differences
    const metadataChanges: Record<string, { old: any; new: any }> = {};

    if (alert_source_channel_id !== undefined && alert_source_channel_id !== existing.alert_source_channel_id) {
      metadataChanges.alert_source_channel_id = { old: existing.alert_source_channel_id || null, new: alert_source_channel_id };
    }
    if (alert_cc !== undefined && alert_cc !== existing.alert_cc) {
      metadataChanges.alert_cc = { old: existing.alert_cc || null, new: alert_cc };
    }
    if (alert_bcc !== undefined && alert_bcc !== existing.alert_bcc) {
      metadataChanges.alert_bcc = { old: existing.alert_bcc || null, new: alert_bcc };
    }
    if (alert_mail_template_id !== undefined && alert_mail_template_id !== existing.alert_mail_template_id) {
      metadataChanges.alert_mail_template_id = { old: existing.alert_mail_template_id || null, new: alert_mail_template_id };
    }
    if (alert_recipients !== undefined) {
      const oldRecs = parseArr(existing.alert_recipients);
      if (JSON.stringify(alert_recipients) !== JSON.stringify(oldRecs)) {
        metadataChanges.alert_recipients = { old: oldRecs, new: alert_recipients };
      }
    }
    if (user_ids !== undefined) {
      const oldUsers = parseArr(existing.user_ids);
      if (JSON.stringify(user_ids) !== JSON.stringify(oldUsers)) {
        metadataChanges.user_ids = { old: oldUsers, new: user_ids };
      }
    }
    if (alert_crash_reasons !== undefined) {
      const oldReasons = parseArr(existing.alert_crash_reasons);
      if (JSON.stringify(alert_crash_reasons) !== JSON.stringify(oldReasons)) {
        metadataChanges.alert_crash_reasons = { old: oldReasons, new: alert_crash_reasons };
      }
    }

    if (Object.keys(metadataChanges).length > 0) {
      // Log activity
      await logActivity({
        org_id,
        user_id: requestUserId,
        action: "service_updated",
        resource: "service",
        resource_id: id,
        metadata: { changes: metadataChanges }
      });
    }

    return { message: "Updated" };
  });

  // POST /api/service-owners/:id/send-notification — send manual alert notification
  app.post("/:id/send-notification", {
    onRequest: [(app as any).authenticate, requirePermission("addServiceOwner")],
  }, async (req, reply) => {
    const { org_id, sub: requestUserId } = getUser(req);
    const { id } = req.params as { id: string };
    const {
      channel_type, user_ids = [], cc, bcc, subject, message
    } = req.body as {
      channel_type: "mail" | "teams" | "slack" | "webhook";
      user_ids: string[];
      cc?: string;
      bcc?: string;
      subject: string;
      message: string;
    };

    if (!channel_type || !subject || !message) {
      return reply.status(400).send({ detail: "channel_type, subject and message are required" });
    }

    const [owner] = await sql`
      SELECT so.*, c.name as cluster_name
      FROM service_owners so
      LEFT JOIN clusters c ON so.cluster_id = c.cluster_id
      WHERE so.service_owner_id = ${id} AND so.org_id = ${org_id}
    `;
    if (!owner) return reply.status(404).send({ detail: "Service not found" });

    let targetUsers: any[] = [];
    if (user_ids.length > 0) {
      targetUsers = await sql`
        SELECT user_id, email, full_name, personal_channel_id 
        FROM users 
        WHERE user_id = ANY(${user_ids}) AND org_id = ${org_id}
      `;
    }

    if (targetUsers.length === 0) {
      return reply.status(400).send({ detail: "No valid users selected as recipients" });
    }

    if (channel_type === "mail") {
      const serviceName = owner.pod_prefix || "*";
      const clusterName = owner.cluster_name || "production";
      const namespace = owner.namespace || "";

      const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:40px auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <!-- Header -->
    <div style="background:#6366f1;padding:24px 28px;">
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="width:40px;height:40px;background:rgba(255,255,255,0.2);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:20px;">🔔</div>
        <div>
          <div style="color:rgba(255,255,255,0.85);font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Service Alert</div>
          <div style="color:white;font-size:18px;font-weight:700;margin-top:2px;">${subject}</div>
        </div>
      </div>
    </div>
    <!-- Body -->
    <div style="padding:28px;">
      <p style="font-size:14px;color:#0f172a;line-height:1.6;margin-bottom:20px;">${message.replace(/\r?\n/g, "<br>")}</p>
      <table style="width:100%;border-collapse:collapse;margin-top:20px;border-top:1px solid #e2e8f0;">
        <tr style="border-bottom:1px solid #f1f5f9;">
          <td style="padding:10px 0;color:#64748b;font-size:13px;width:120px;">Service Name</td>
          <td style="padding:10px 0;color:#0f172a;font-size:13px;font-weight:600;">${serviceName}</td>
        </tr>
        <tr style="border-bottom:1px solid #f1f5f9;">
          <td style="padding:10px 0;color:#64748b;font-size:13px;">Cluster</td>
          <td style="padding:10px 0;color:#0f172a;font-size:13px;font-weight:600;">${clusterName}</td>
        </tr>
        ${namespace ? `
        <tr style="border-bottom:1px solid #f1f5f9;">
          <td style="padding:10px 0;color:#64748b;font-size:13px;">Namespace</td>
          <td style="padding:10px 0;color:#0f172a;font-size:13px;font-weight:600;">${namespace}</td>
        </tr>` : ""}
      </table>
    </div>
    <!-- Footer -->
    <div style="padding:16px 28px;background:#f8fafc;border-top:1px solid #f1f5f9;text-align:center;">
      <p style="margin:0;font-size:12px;color:#94a3b8;">
        <strong style="color:#6366f1;">Srevox</strong> — Catch crashes before your users do.
      </p>
    </div>
  </div>
</body>
</html>`;

      const emailsList = targetUsers.map(u => u.email).filter(Boolean);
      if (emailsList.length > 0) {
        await sendEmail(
          emailsList.join(", "),
          subject,
          message,
          html,
          cc || undefined,
          bcc || undefined
        );
      }
    } else {
      for (const u of targetUsers) {
        if (!u.personal_channel_id) continue;
        const [channel] = await sql`SELECT * FROM channels WHERE channel_id = ${u.personal_channel_id} AND org_id = ${org_id}`;
        if (!channel) continue;

        let chConfig: Record<string, string> = {};
        try { chConfig = JSON.parse(decrypt(channel.config_encrypted)); } catch { chConfig = {}; }

        const url = chConfig.webhook_url || chConfig.url;
        if (!url) continue;

        if (channel.type === "teams") {
          const isAdaptiveCard = url.includes("logic.azure.com");
          let payload;
          if (isAdaptiveCard) {
            payload = {
              type: "message",
              attachments: [{
                contentType: "application/vnd.microsoft.card.adaptive",
                content: {
                  $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
                  type: "AdaptiveCard",
                  version: "1.4",
                  body: [
                    { type: "TextBlock", text: `🔔 Service Notification: ${subject}`, weight: "Bolder", size: "Medium", color: "Accent" },
                    { type: "TextBlock", text: message, wrap: true },
                    {
                      type: "FactSet",
                      facts: [
                        { title: "Service", value: owner.pod_prefix || "*" },
                        { title: "Cluster", value: owner.cluster_name }
                      ]
                    }
                  ]
                }
              }]
            };
          } else {
            payload = {
              title: `🔔 Service Notification: ${subject}`,
              text: `**Service**: ${owner.pod_prefix || "*"}\n\n**Cluster**: ${owner.cluster_name}\n\n${message}`
            };
          }
          await axios.post(url, payload, { timeout: 10000 }).catch(console.error);
        } else if (channel.type === "slack" || channel.type === "webhook") {
          const payload = {
            text: `*🔔 Service Notification: ${subject}*\n\n*Service*: ${owner.pod_prefix || "*"}\n*Cluster*: ${owner.cluster_name}\n\n${message}`,
            subject,
            message,
            service_name: owner.pod_prefix || "*",
            cluster_name: owner.cluster_name
          };
          await axios.post(url, payload, { timeout: 10000 }).catch(console.error);
        }
      }
    }

    // Log activity
    await logActivity({
      org_id,
      user_id: requestUserId,
      action: "notification_sent",
      resource: "service",
      resource_id: id,
      metadata: {
        channel_type,
        user_ids,
        subject
      }
    });

    return { success: true, message: "Notification sent successfully" };
  });

  // GET /api/service-owners/resolve — used by alert worker to find owner for a crash
  app.get("/resolve", async (req) => {
    const { cluster_id, namespace, pod_name } = req.query as Record<string, string>;

    const owners = await sql`
      SELECT
        so.*,
        u.email          as owner_email,
        u.full_name      as owner_name,
        u.personal_channel_id
      FROM service_owners so
      LEFT JOIN users u ON so.user_id = u.user_id
      WHERE so.cluster_id = ${cluster_id}
        AND (so.namespace IS NULL OR so.namespace = ${namespace})
        AND (so.pod_prefix IS NULL OR ${pod_name} LIKE so.pod_prefix || '%')
      ORDER BY
        (CASE WHEN so.pod_prefix IS NOT NULL THEN 2 ELSE 0 END) +
        (CASE WHEN so.namespace  IS NOT NULL THEN 1 ELSE 0 END) DESC
      LIMIT 5
    `;

    return {
      owners: owners.map((o) => ({
        ...o,
        channel_ids: parseArr(o.channel_ids),
        user_ids: parseArr(o.user_ids),
        group_ids: parseArr(o.group_ids),
        alert_recipients: parseArr(o.alert_recipients)
      })),
    };
  });

  // GET /api/service-owners/mute-status — check global service mute status
  app.get("/mute-status", { onRequest: [(app as any).authenticate] }, async (req) => {
    const redis = (await import("../db/redis.js")).default;
    const globalTtl = await redis.ttl("mute:service:global");
    const globalMuted = await redis.exists("mute:service:global");
    
    return {
      global_muted: globalMuted === 1,
      global_ttl: globalMuted === 1 ? (globalTtl > 0 ? globalTtl : null) : null
    };
  });

  // POST /api/service-owners/mute — globally mute all service owners alerts
  app.post("/mute", { onRequest: [(app as any).authenticate, requirePermission("addCluster")] }, async (req, reply) => {
    const { minutes } = req.body as { minutes?: number };
    const redis = (await import("../db/redis.js")).default;
    
    if (minutes && minutes > 0) {
      await redis.setex("mute:service:global", minutes * 60, "1");
    } else {
      await redis.set("mute:service:global", "1");
    }
    return { message: "Service Owner alerts muted globally" };
  });

  // POST /api/service-owners/unmute — globally unmute all service owners alerts
  app.post("/unmute", { onRequest: [(app as any).authenticate, requirePermission("addCluster")] }, async (req) => {
    const redis = (await import("../db/redis.js")).default;
    await redis.del("mute:service:global");
    return { message: "Service Owner alerts unmuted globally" };
  });

  // POST /api/service-owners/:id/mute — mute a specific service owner mapping
  app.post("/:id/mute", { onRequest: [(app as any).authenticate, requirePermission("viewServiceOwners")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { minutes } = req.body as { minutes?: number };
    const redis = (await import("../db/redis.js")).default;
    
    const { org_id } = getUser(req);
    const [svc] = await sql`SELECT service_owner_id FROM service_owners WHERE service_owner_id = ${id} AND org_id = ${org_id}`;
    if (!svc) return reply.status(404).send({ detail: "Service not found" });

    if (minutes && minutes > 0) {
      await redis.setex(`mute:service:${id}`, minutes * 60, "1");
    } else {
      await redis.set(`mute:service:${id}`, "1");
    }
    return { message: "Service muted successfully" };
  });

  // POST /api/service-owners/:id/unmute — unmute a specific service owner mapping
  app.post("/:id/unmute", { onRequest: [(app as any).authenticate, requirePermission("viewServiceOwners")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const redis = (await import("../db/redis.js")).default;
    
    const { org_id } = getUser(req);
    const [svc] = await sql`SELECT service_owner_id FROM service_owners WHERE service_owner_id = ${id} AND org_id = ${org_id}`;
    if (!svc) return reply.status(404).send({ detail: "Service not found" });

    await redis.del(`mute:service:${id}`);
    return { message: "Service unmuted successfully" };
  });

  // GET /api/service-owners/routing-defaults — get default fallback settings
  app.get("/routing-defaults", { onRequest: [(app as any).authenticate] }, async (req) => {
    const { org_id } = getUser(req);
    const [settings] = await sql`
      SELECT 
        CASE 
          WHEN ch.channel_id IS NOT NULL THEN s.default_alert_source_channel_id
          ELSE NULL
        END as default_alert_source_channel_id,
        s.default_alert_cc,
        s.default_alert_bcc
      FROM service_owner_settings s
      LEFT JOIN channels ch ON s.default_alert_source_channel_id = ch.channel_id
      WHERE s.org_id = ${org_id}
    `;
    return settings || {
      default_alert_source_channel_id: null,
      default_alert_cc: null,
      default_alert_bcc: null
    };
  });

  // PATCH /api/service-owners/routing-defaults — update default fallback settings
  app.patch("/routing-defaults", { onRequest: [(app as any).authenticate, requirePermission("addCluster")] }, async (req) => {
    const { org_id } = getUser(req);
    const { default_alert_source_channel_id, default_alert_cc, default_alert_bcc } = req.body as any;
    
    await sql`
      INSERT INTO service_owner_settings (org_id, default_alert_source_channel_id, default_alert_cc, default_alert_bcc)
      VALUES (${org_id}, ${default_alert_source_channel_id || null}, ${default_alert_cc || null}, ${default_alert_bcc || null})
      ON CONFLICT (org_id) DO UPDATE 
      SET default_alert_source_channel_id = EXCLUDED.default_alert_source_channel_id,
          default_alert_cc = EXCLUDED.default_alert_cc,
          default_alert_bcc = EXCLUDED.default_alert_bcc,
          updated_at = now()
    `;
    return { success: true, message: "Service Owner settings updated successfully" };
  });
}