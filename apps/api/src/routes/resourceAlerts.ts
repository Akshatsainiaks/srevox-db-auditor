import { FastifyInstance } from "fastify";
import sql from "../db/sql.js";
import { getUser, requirePermission } from "../middleware/rbac.js";
import { genId } from "../utils/id.js";
import { logActivity } from "../services/activity.js";

export default async function resourceAlertRoutes(app: FastifyInstance) {
  app.get("/", { onRequest: [(app as any).authenticate, requirePermission("viewRules")] }, async (req) => {
    let { org_id } = getUser(req);
    if (!org_id) {
      const [defaultOrg] = await sql`SELECT org_id FROM organizations LIMIT 1`;
      org_id = defaultOrg?.org_id || null;
    }
    const { cluster_id } = req.query as { cluster_id?: string };
    const alerts = cluster_id
      ? await sql`SELECT * FROM resource_alerts WHERE (${org_id}::text IS NULL OR org_id = ${org_id}::text OR org_id IS NULL) AND cluster_id = ${cluster_id} ORDER BY created_at DESC`
      : await sql`SELECT * FROM resource_alerts WHERE (${org_id}::text IS NULL OR org_id = ${org_id}::text OR org_id IS NULL) ORDER BY created_at DESC`;
    return { alerts };
  });

  app.get("/cluster/:cluster_id", { onRequest: [(app as any).authenticate, requirePermission("viewRules")] }, async (req) => {
    let { org_id } = getUser(req);
    if (!org_id) {
      const [defaultOrg] = await sql`SELECT org_id FROM organizations LIMIT 1`;
      org_id = defaultOrg?.org_id || null;
    }
    const { cluster_id } = req.params as { cluster_id: string };
    const alerts = await sql`SELECT * FROM resource_alerts WHERE (${org_id}::text IS NULL OR org_id = ${org_id}::text OR org_id IS NULL) AND cluster_id = ${cluster_id} ORDER BY created_at DESC`;
    return { alerts };
  });

  app.post("/test", { onRequest: [(app as any).authenticate, requirePermission("addRule")] }, async (req, reply) => {
    const { org_id } = getUser(req);
    const { cluster_id, resource_type, threshold_pct, target, target_name, channel_ids } = req.body as any;

    let parsedChannels: string[] = [];
    if (Array.isArray(channel_ids)) {
      parsedChannels = channel_ids;
    } else if (typeof channel_ids === "string") {
      try {
        const arr = JSON.parse(channel_ids);
        if (Array.isArray(arr)) parsedChannels = arr;
      } catch {}
    }

    if (parsedChannels.length === 0) {
      return reply.status(400).send({ detail: "Please select at least one notification channel to test." });
    }

    let userOrgId = org_id;
    if (!userOrgId) {
      const [defaultOrg] = await sql`SELECT org_id FROM organizations LIMIT 1`;
      userOrgId = defaultOrg?.org_id || null;
    }

    const [cl] = await sql`SELECT name FROM clusters WHERE cluster_id = ${cluster_id} AND (${userOrgId}::text IS NULL OR org_id = ${userOrgId}::text OR org_id IS NULL)`;
    const clusterName = cl?.name || cluster_id || "Cluster";

    const resTypeStr = (resource_type || "memory").toUpperCase();
    const testValStr = resource_type === "cpu" ? "78%" : (resource_type === "disk" || resource_type === "storage") ? "88%" : resource_type === "pod_restarts" ? "5 restarts" : "85%";
    const testTitle = `[TEST] Resource Alert: Node 'test-node-1' ${resTypeStr === "DISK" ? "STORAGE" : resTypeStr} ${testValStr}`;
    const testDetails = `[TEST NOTIFICATION] Node 'test-node-1' ${resTypeStr} is at ${testValStr} (Rule threshold: > ${threshold_pct || 50}%). Alert dispatch channel integration test succeeded.`;

    const alertPayload = {
      event_type: "resource_threshold_exceeded",
      title: testTitle,
      org_id: userOrgId,
      cluster_id,
      cluster_name: clusterName,
      details: testDetails,
      channel_ids: parsedChannels,
    };

    const redis = (await import("../db/redis.js")).default;
    await redis.publish("srevox:system_alerts", JSON.stringify(alertPayload));

    return { success: true, message: `Test notification sent to ${parsedChannels.length} notification channel(s).` };
  });

  app.post("/", { onRequest: [(app as any).authenticate, requirePermission("addRule")] }, async (req) => {
    let { org_id, sub: requestUserId } = getUser(req);
    if (!org_id) {
      const [defaultOrg] = await sql`SELECT org_id FROM organizations LIMIT 1`;
      org_id = defaultOrg?.org_id || null;
    }
    const { cluster_id, resource_type, threshold_pct, memory_threshold_pct, target, target_name, severity, channel_ids, repeat_interval_mins, repeat_enabled } = req.body as any;
    const id = genId("ral");
    const numThreshold = Number(threshold_pct) || 0;
    const memThreshold = memory_threshold_pct !== undefined && memory_threshold_pct !== null ? Number(memory_threshold_pct) : null;
    const [alert] = await sql`
      INSERT INTO resource_alerts (resource_alert_id, org_id, cluster_id, resource_type, threshold_pct, memory_threshold_pct, target, target_name, severity, channel_ids, repeat_interval_mins, repeat_enabled)
      VALUES (${id}, ${org_id}, ${cluster_id}, ${resource_type}, ${numThreshold}::numeric, ${memThreshold ? memThreshold : null}::numeric, ${target}, ${target_name||null}, ${severity}, ${JSON.stringify(channel_ids || [])}, ${repeat_interval_mins ? Number(repeat_interval_mins) : 15}, ${repeat_enabled ?? true})
      RETURNING *
    `;

    const [cl] = await sql`SELECT name FROM clusters WHERE cluster_id = ${cluster_id} AND (${org_id}::text IS NULL OR org_id = ${org_id}::text OR org_id IS NULL)`;
    const clusterName = cl?.name || cluster_id;

    await logActivity({
      org_id: org_id || "default",
      user_id: requestUserId,
      action: "resource_alert_created",
      resource: "resource_alert",
      resource_id: id,
      metadata: { cluster_name: clusterName, resource_type, threshold_pct: numThreshold, memory_threshold_pct: memThreshold, target, target_name, repeat_interval_mins: alert.repeat_interval_mins, repeat_enabled: alert.repeat_enabled }
    });

    return { alert };
  });

  app.put("/:id", { onRequest: [(app as any).authenticate, requirePermission("addRule")] }, async (req, reply) => {
    const { org_id, sub: requestUserId } = getUser(req);
    const { id } = req.params as { id: string };
    const body = req.body as any;

    const [existing] = await sql`SELECT * FROM resource_alerts WHERE resource_alert_id = ${id} AND org_id = ${org_id}`;
    if (!existing) {
      reply.status(404);
      return { error: "Resource alert not found" };
    }

    const updates: Record<string, any> = {};
    if (body.resource_type !== undefined) updates.resource_type = body.resource_type;
    if (body.threshold_pct !== undefined) updates.threshold_pct = Number(body.threshold_pct);
    if (body.memory_threshold_pct !== undefined) updates.memory_threshold_pct = body.memory_threshold_pct !== null ? Number(body.memory_threshold_pct) : null;
    if (body.target !== undefined) updates.target = body.target;
    if (body.target_name !== undefined) updates.target_name = body.target_name;
    if (body.severity !== undefined) updates.severity = body.severity;
    if (body.channel_ids !== undefined) updates.channel_ids = JSON.stringify(body.channel_ids);
    if (body.repeat_interval_mins !== undefined) updates.repeat_interval_mins = Number(body.repeat_interval_mins);
    if (body.repeat_enabled !== undefined) updates.repeat_enabled = Boolean(body.repeat_enabled);
    if (body.enabled !== undefined) updates.enabled = body.enabled;
    if (body.mute_until !== undefined) updates.mute_until = body.mute_until;

    const changes: Record<string, { old: any; new: any }> = {};
    for (const key of Object.keys(updates)) {
      if (existing[key] !== undefined && existing[key] !== updates[key]) {
        changes[key] = { old: existing[key], new: updates[key] };
      }
      if (key === "channel_ids") {
        await sql`UPDATE resource_alerts SET channel_ids = ${updates.channel_ids}::jsonb WHERE resource_alert_id = ${id} AND org_id = ${org_id}`;
      } else if (key === "mute_until") {
        await sql`UPDATE resource_alerts SET mute_until = ${updates.mute_until ? updates.mute_until : null}::timestamptz WHERE resource_alert_id = ${id} AND org_id = ${org_id}`;
      } else if (key === "threshold_pct") {
        await sql`UPDATE resource_alerts SET threshold_pct = ${updates[key]}::numeric WHERE resource_alert_id = ${id} AND org_id = ${org_id}`;
      } else if (key === "memory_threshold_pct") {
        await sql`UPDATE resource_alerts SET memory_threshold_pct = ${updates[key] !== null ? updates[key] : null}::numeric WHERE resource_alert_id = ${id} AND org_id = ${org_id}`;
      } else {
        await sql`UPDATE resource_alerts SET ${sql(key)} = ${updates[key]} WHERE resource_alert_id = ${id} AND org_id = ${org_id}`;
      }
    }
    await sql`UPDATE resource_alerts SET updated_at = now() WHERE resource_alert_id = ${id} AND org_id = ${org_id}`;

    const [alert] = await sql`SELECT * FROM resource_alerts WHERE resource_alert_id = ${id} AND org_id = ${org_id}`;
    const [cl] = await sql`SELECT name FROM clusters WHERE cluster_id = ${alert.cluster_id} AND org_id = ${org_id}`;
    const clusterName = cl?.name || alert.cluster_id;

    if (body.mute_until !== undefined) {
      await logActivity({
        org_id,
        user_id: requestUserId,
        action: body.mute_until ? "resource_alert_muted" : "resource_alert_unmuted",
        resource: "resource_alert",
        resource_id: id,
        metadata: { 
          cluster_name: clusterName,
          resource_type: alert.resource_type,
          mute_until: body.mute_until ? new Date(body.mute_until).toLocaleString() : null 
        }
      });
    } else {
      await logActivity({
        org_id,
        user_id: requestUserId,
        action: "resource_alert_updated",
        resource: "resource_alert",
        resource_id: id,
        metadata: { 
          cluster_name: clusterName,
          resource_type: alert.resource_type,
          threshold_pct: alert.threshold_pct,
          target: alert.target,
          target_name: alert.target_name,
          changes: Object.keys(changes).length > 0 ? changes : undefined
        }
      });
    }

    return { alert };
  });

  app.delete("/:id", { onRequest: [(app as any).authenticate, requirePermission("deleteRule")] }, async (req) => {
    const { org_id, sub: requestUserId } = getUser(req);
    const { id } = req.params as { id: string };
    
    const [existing] = await sql`SELECT * FROM resource_alerts WHERE resource_alert_id = ${id} AND org_id = ${org_id}`;
    if (existing) {
      const [cl] = await sql`SELECT name FROM clusters WHERE cluster_id = ${existing.cluster_id} AND org_id = ${org_id}`;
      const clusterName = cl?.name || existing.cluster_id;

      await sql`DELETE FROM resource_alerts WHERE resource_alert_id = ${id} AND org_id = ${org_id}`;

      await logActivity({
        org_id,
        user_id: requestUserId,
        action: "resource_alert_deleted",
        resource: "resource_alert",
        resource_id: id,
        metadata: { 
          cluster_name: clusterName,
          resource_type: existing.resource_type,
          threshold_pct: existing.threshold_pct
        }
      });
    }

    return { message: "Deleted" };
  });
}
