import { FastifyInstance } from "fastify";
import { genId } from "../utils/id.js";
import sql from "../db/sql.js";
import { setCache, getCache, invalidateCache } from "../db/redis.js";
import { getUser, requirePermission } from "../middleware/rbac.js";
import axios from "axios";
import { getK8sClient } from "../services/k8s.js";
import { Log } from "@kubernetes/client-node";
import { PassThrough } from "node:stream";
import { decrypt } from "../utils/crypto.js";
async function fetchK8sPodLogs(clusterId: string, namespace: string, podName: string, containerName: string | undefined, previous: boolean): Promise<string> {
  const { core, kc } = await getK8sClient(clusterId);
  
  let targetContainer = (containerName || "").trim();
  
  // Auto-discover container name if not provided
  if (!targetContainer) {
    try {
      const podRes = await core.readNamespacedPod({ name: podName, namespace });
      const containers = (podRes as any)?.spec?.containers || (podRes as any)?.body?.spec?.containers || [];
      if (containers.length > 0 && containers[0]?.name) {
        targetContainer = containers[0].name;
      }
    } catch (e: any) {
      console.warn(`[incidents] Could not auto-discover container name for ${podName}:`, e.message);
    }
  }

  // Method 1: Try direct CoreV1Api readNamespacedPodLog
  try {
    const params: any = {
      name: podName,
      namespace: namespace,
      previous: previous,
      tailLines: 100
    };
    if (targetContainer) {
      params.container = targetContainer;
    }
    const res = await core.readNamespacedPodLog(params);
    const bodyText = typeof (res as any).body === "string" ? (res as any).body : typeof res === "string" ? res : res ? String(res) : "";
    if (bodyText && bodyText.trim().length > 0) return bodyText;
  } catch (err: any) {
    console.warn(`[incidents] Direct readNamespacedPodLog failed for ${podName} (previous=${previous}):`, err.message);
  }

  // Method 2: Stream fallback via Log(kc)
  const k8sLog = new Log(kc);
  const logStream = new PassThrough();
  let logs = "";

  logStream.on("data", (chunk) => {
    logs += chunk.toString("utf8");
  });

  const logPromise = k8sLog.log(
    namespace,
    podName,
    targetContainer,
    logStream,
    { tailLines: 100, previous }
  );

  return new Promise<string>((resolve, reject) => {
    logStream.on("end", () => resolve(logs));
    logStream.on("close", () => resolve(logs));
    logStream.on("error", (err) => reject(err));
    logPromise.catch((err) => reject(err));
    setTimeout(() => resolve(logs), 5000);
  });
}

export default async function incidentRoutes(app: FastifyInstance) {

  // GET /api/incidents/analytics/summary
  app.get("/analytics/summary", { onRequest: [(app as any).authenticate, requirePermission("viewAnalytics")] }, async (req, reply) => {
    const { org_id } = getUser(req);
    const { start_date, end_date } = req.query as { start_date?: string; end_date?: string };

    const cacheKey = start_date && end_date
      ? `analytics:summary:${org_id}:${start_date}:${end_date}`
      : `analytics:summary:${org_id}`;

    const cached = await getCache(cacheKey);
    if (cached) return cached;

    let custom = null;
    let topCrashedQuery = sql`
      SELECT pod_name, namespace, COUNT(*)::int as count
      FROM incidents
      WHERE org_id = ${org_id}
      GROUP BY pod_name, namespace
      ORDER BY count DESC
      LIMIT 10
    `;
    let topAlertingQuery = sql`
      SELECT i.pod_name, i.namespace, COUNT(*)::int as count
      FROM alerts_sent a
      JOIN incidents i ON a.incident_id = i.incident_id
      WHERE i.org_id = ${org_id}
      GROUP BY i.pod_name, i.namespace
      ORDER BY count DESC
      LIMIT 10
    `;

    if (start_date && end_date) {
      const startDate = new Date(start_date);
      const endDate = new Date(end_date);
      if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
        const diffMs = endDate.getTime() - startDate.getTime();
        const diffDays = diffMs / (1000 * 3600 * 24);
        const interval = diffDays <= 2 ? "hour" : diffDays > 60 ? "month" : "day";

        const customCrashes = await sql`
          SELECT DATE_TRUNC(${interval}, first_seen_at) as period, COUNT(*)::int as count
          FROM incidents
          WHERE org_id = ${org_id}
            AND first_seen_at >= ${startDate}
            AND first_seen_at <= ${endDate}
          GROUP BY period
          ORDER BY period ASC
        `;

        const customAlerts = await sql`
          SELECT DATE_TRUNC(${interval}, a.sent_at) as period, COUNT(*)::int as count
          FROM alerts_sent a
          JOIN incidents i ON a.incident_id = i.incident_id
          WHERE i.org_id = ${org_id}
            AND a.sent_at >= ${startDate}
            AND a.sent_at <= ${endDate}
          GROUP BY period
          ORDER BY period ASC
        `;

        custom = {
          crashes: customCrashes,
          alerts: customAlerts,
          interval
        };

        topCrashedQuery = sql`
          SELECT pod_name, namespace, COUNT(*)::int as count
          FROM incidents
          WHERE org_id = ${org_id}
            AND first_seen_at >= ${startDate}
            AND first_seen_at <= ${endDate}
          GROUP BY pod_name, namespace
          ORDER BY count DESC
          LIMIT 10
        `;

        topAlertingQuery = sql`
          SELECT i.pod_name, i.namespace, COUNT(*)::int as count
          FROM alerts_sent a
          JOIN incidents i ON a.incident_id = i.incident_id
          WHERE i.org_id = ${org_id}
            AND a.sent_at >= ${startDate}
            AND a.sent_at <= ${endDate}
          GROUP BY i.pod_name, i.namespace
          ORDER BY count DESC
          LIMIT 10
        `;
      }
    }

    // 1. Hourly breakdown (past 24 hours)
    const hourlyCrashes = await sql`
      SELECT DATE_TRUNC('hour', first_seen_at) as period, COUNT(*)::int as count
      FROM incidents
      WHERE org_id = ${org_id} AND first_seen_at > now() - interval '24 hours'
      GROUP BY period
      ORDER BY period ASC
    `;
    
    const hourlyAlerts = await sql`
      SELECT DATE_TRUNC('hour', a.sent_at) as period, COUNT(*)::int as count
      FROM alerts_sent a
      JOIN incidents i ON a.incident_id = i.incident_id
      WHERE i.org_id = ${org_id} AND a.sent_at > now() - interval '24 hours'
      GROUP BY period
      ORDER BY period ASC
    `;

    // 2. Daily breakdown (past 30 days)
    const dailyCrashes = await sql`
      SELECT DATE_TRUNC('day', first_seen_at) as period, COUNT(*)::int as count
      FROM incidents
      WHERE org_id = ${org_id} AND first_seen_at > now() - interval '30 days'
      GROUP BY period
      ORDER BY period ASC
    `;
    
    const dailyAlerts = await sql`
      SELECT DATE_TRUNC('day', a.sent_at) as period, COUNT(*)::int as count
      FROM alerts_sent a
      JOIN incidents i ON a.incident_id = i.incident_id
      WHERE i.org_id = ${org_id} AND a.sent_at > now() - interval '30 days'
      GROUP BY period
      ORDER BY period ASC
    `;

    // 3. Monthly breakdown (past 12 months)
    const monthlyCrashes = await sql`
      SELECT DATE_TRUNC('month', first_seen_at) as period, COUNT(*)::int as count
      FROM incidents
      WHERE org_id = ${org_id} AND first_seen_at > now() - interval '12 months'
      GROUP BY period
      ORDER BY period ASC
    `;
    
    const monthlyAlerts = await sql`
      SELECT DATE_TRUNC('month', a.sent_at) as period, COUNT(*)::int as count
      FROM alerts_sent a
      JOIN incidents i ON a.incident_id = i.incident_id
      WHERE i.org_id = ${org_id} AND a.sent_at > now() - interval '12 months'
      GROUP BY period
      ORDER BY period ASC
    `;

    // Execute the resolved top pods / alerts queries
    const topCrashedPods = await topCrashedQuery;
    const topAlertingPods = await topAlertingQuery;

    const result = {
      hourly: { crashes: hourlyCrashes, alerts: hourlyAlerts },
      daily: { crashes: dailyCrashes, alerts: dailyAlerts },
      monthly: { crashes: monthlyCrashes, alerts: monthlyAlerts },
      top_crashed: topCrashedPods,
      top_alerting: topAlertingPods,
      custom
    };

    // Cache the analytics results in Redis for 60 seconds (or 10 seconds for custom ranges)
    const cacheTTL = start_date && end_date ? 10 : 60;
    await setCache(cacheKey, result, cacheTTL);

    return result;
  });

  // GET /api/incidents/analytics/top-pods
  app.get("/analytics/top-pods", { onRequest: [(app as any).authenticate, requirePermission("viewAnalytics")] }, async (req) => {
    const { org_id } = getUser(req);
    const { start_date, end_date, search, sort_by = "count", sort_order = "desc", limit = "10", offset = "0" } =
      req.query as Record<string, string>;

    const startDate = start_date ? new Date(start_date) : null;
    const endDate = end_date ? new Date(end_date) : null;

    let sortCol = sql`count`;
    if (sort_by === "pod_name") sortCol = sql`pod_name`;
    else if (sort_by === "namespace") sortCol = sql`namespace`;

    const sortDir = sort_order === "asc" ? sql`ASC` : sql`DESC`;

    const searchPattern = search ? `%${search}%` : null;

    const pods = await sql`
      WITH grouped AS (
        SELECT pod_name, namespace, COUNT(*)::int as count
        FROM incidents
        WHERE org_id = ${org_id}
          ${startDate && !isNaN(startDate.getTime()) ? sql`AND first_seen_at >= ${startDate}` : sql``}
          ${endDate && !isNaN(endDate.getTime()) ? sql`AND first_seen_at <= ${endDate}` : sql``}
          ${searchPattern ? sql`AND (pod_name ILIKE ${searchPattern} OR namespace ILIKE ${searchPattern})` : sql``}
        GROUP BY pod_name, namespace
      )
      SELECT *, COUNT(*) OVER()::int as total_count 
      FROM grouped
      ORDER BY ${sortCol} ${sortDir}
      LIMIT ${Number(limit)} OFFSET ${Number(offset)}
    `;

    const total = pods.length > 0 ? pods[0].total_count : 0;
    const items = pods.map(({ total_count, ...rest }) => rest);

    return { items, total };
  });

  // GET /api/incidents/analytics/top-alerts
  app.get("/analytics/top-alerts", { onRequest: [(app as any).authenticate, requirePermission("viewAnalytics")] }, async (req) => {
    const { org_id } = getUser(req);
    const { start_date, end_date, search, sort_by = "count", sort_order = "desc", limit = "10", offset = "0" } =
      req.query as Record<string, string>;

    const startDate = start_date ? new Date(start_date) : null;
    const endDate = end_date ? new Date(end_date) : null;

    let sortCol = sql`count`;
    if (sort_by === "pod_name") sortCol = sql`pod_name`;
    else if (sort_by === "namespace") sortCol = sql`namespace`;

    const sortDir = sort_order === "asc" ? sql`ASC` : sql`DESC`;

    const searchPattern = search ? `%${search}%` : null;

    const alerts = await sql`
      WITH grouped AS (
        SELECT i.pod_name, i.namespace, COUNT(*)::int as count
        FROM alerts_sent a
        JOIN incidents i ON a.incident_id = i.incident_id
        WHERE i.org_id = ${org_id}
          ${startDate && !isNaN(startDate.getTime()) ? sql`AND a.sent_at >= ${startDate}` : sql``}
          ${endDate && !isNaN(endDate.getTime()) ? sql`AND a.sent_at <= ${endDate}` : sql``}
          ${searchPattern ? sql`AND (i.pod_name ILIKE ${searchPattern} OR i.namespace ILIKE ${searchPattern})` : sql``}
        GROUP BY i.pod_name, i.namespace
      )
      SELECT *, COUNT(*) OVER()::int as total_count 
      FROM grouped
      ORDER BY ${sortCol} ${sortDir}
      LIMIT ${Number(limit)} OFFSET ${Number(offset)}
    `;

    const total = alerts.length > 0 ? alerts[0].total_count : 0;
    const items = alerts.map(({ total_count, ...rest }) => rest);

    return { items, total };
  });

  // GET /api/incidents/stats/summary
  app.get("/stats/summary", { onRequest: [(app as any).authenticate] }, async (req) => {
    const { org_id } = getUser(req);
    const { cluster_id } = req.query as { cluster_id?: string };
    
    const cacheKey = cluster_id ? `stats:${org_id}:${cluster_id}` : `stats:${org_id}`;
    const cached = await getCache(cacheKey);
    if (cached) return cached;

    const [stats] = await sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'open')                              AS open_count,
        COUNT(*) FILTER (WHERE status = 'acknowledged')                     AS acknowledged_count,
        COUNT(*) FILTER (WHERE status = 'resolved')                         AS resolved_count,
        COUNT(*) FILTER (WHERE severity = 'critical' AND status = 'open')   AS critical_open,
        COUNT(*) FILTER (WHERE first_seen_at > now() - interval '24 hours') AS last_24h,
        COUNT(*) FILTER (WHERE first_seen_at > now() - interval '7 days')   AS last_7d,
        COUNT(*) FILTER (WHERE crash_reason = 'OOMKilled')                  AS oom_count,
        COUNT(*) FILTER (WHERE crash_reason = 'CrashLoopBackOff')           AS crash_loop_count
      FROM incidents
      WHERE org_id = ${org_id}
        ${cluster_id ? sql`AND cluster_id = ${cluster_id}` : sql``}
    `;

    const result = {
      open_count:         Number(stats.open_count),
      acknowledged_count: Number(stats.acknowledged_count),
      resolved_count:     Number(stats.resolved_count),
      critical_open:      Number(stats.critical_open),
      last_24h:           Number(stats.last_24h),
      last_7d:            Number(stats.last_7d),
      oom_count:          Number(stats.oom_count),
      crash_loop_count:   Number(stats.crash_loop_count),
    };

    await setCache(cacheKey, result, 30);
    return result;
  });

  // GET /api/incidents
  app.get("/", { onRequest: [(app as any).authenticate] }, async (req) => {
    const { org_id } = getUser(req);
    const { status, severity, namespace, cluster_id, limit = "50", offset = "0" } =
      req.query as Record<string, string>;

    const incidents = await sql`
      SELECT i.*, c.name as cluster_name,
             COALESCE(u1.full_name, split_part(u1.email, '@', 1)) as acknowledged_by_name,
             COALESCE(u2.full_name, split_part(u2.email, '@', 1)) as resolved_by_name
      FROM incidents i
      LEFT JOIN clusters c ON i.cluster_id = c.cluster_id
      LEFT JOIN users u1 ON i.acknowledged_by = u1.user_id
      LEFT JOIN users u2 ON i.resolved_by = u2.user_id
      WHERE i.org_id = ${org_id}
        ${status     ? sql`AND i.status = ${status}`           : sql``}
        ${severity   ? sql`AND i.severity = ${severity}`       : sql``}
        ${namespace  ? sql`AND i.namespace = ${namespace}`     : sql``}
        ${cluster_id ? sql`AND i.cluster_id = ${cluster_id}`   : sql``}
      ORDER BY i.first_seen_at DESC
      LIMIT ${Number(limit)} OFFSET ${Number(offset)}
    `;

    const [{ count }] = await sql`
      SELECT COUNT(*) FROM incidents
      WHERE org_id = ${org_id}
        ${status     ? sql`AND status = ${status}`           : sql``}
        ${severity   ? sql`AND severity = ${severity}`       : sql``}
        ${namespace  ? sql`AND namespace = ${namespace}`     : sql``}
        ${cluster_id ? sql`AND cluster_id = ${cluster_id}`   : sql``}
    `;

    return { incidents, total: Number(count) };
  });

  // GET /api/incidents/trends/daily
  app.get("/trends/daily", { onRequest: [(app as any).authenticate] }, async (req) => {
    const { org_id } = getUser(req);
    const trends = await sql`
      SELECT
        DATE(first_seen_at) as date,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE severity = 'critical') as critical,
        COUNT(*) FILTER (WHERE severity = 'warning')  as warning
      FROM incidents
      WHERE org_id = ${org_id}
        AND first_seen_at > now() - interval '30 days'
      GROUP BY DATE(first_seen_at)
      ORDER BY date ASC
    `;
    return { trends };
  });

  // GET /api/incidents/:id
  app.get("/:id", { onRequest: [(app as any).authenticate] }, async (req, reply) => {
    const { org_id, sub } = getUser(req);
    const { id } = req.params as { id: string };
    const [incident] = await sql`
      SELECT i.*, c.name as cluster_name,
             COALESCE(u1.full_name, split_part(u1.email, '@', 1)) as acknowledged_by_name,
             COALESCE(u2.full_name, split_part(u2.email, '@', 1)) as resolved_by_name,
             d.ai_diagnosis as ai_diagnosis,
             d.ai_diagnosed_at as ai_diagnosed_at
      FROM incidents i
      LEFT JOIN clusters c ON i.cluster_id = c.cluster_id
      LEFT JOIN users u1 ON i.acknowledged_by = u1.user_id
      LEFT JOIN users u2 ON i.resolved_by = u2.user_id
      LEFT JOIN user_ai_diagnoses d ON i.incident_id = d.incident_id AND d.user_id = ${sub}
      WHERE i.incident_id = ${id} AND i.org_id = ${org_id}
    `;
    if (!incident) return reply.status(404).send({ detail: "Incident not found" });
    return incident;
  });

  // POST /api/incidents — internal use by alert worker
  app.post("/", async (req) => {
    const body = req.body as any;
    const id = genId("inc");
    const orgId = body.org_id || "orgjncj44t4hb4";
    await sql`
      INSERT INTO incidents
        (incident_id, org_id, cluster_id, rule_id, pod_name, namespace, container_name,
         crash_reason, restart_count, exit_code, pod_labels, raw_event, severity)
      VALUES
        (${id}, ${orgId},
         ${body.cluster_id || null}, ${body.rule_id || null},
         ${body.pod_name || "unknown-pod"}, ${body.namespace || "default"}, ${body.container_name || null},
         ${body.crash_reason || "Error"}, ${body.restart_count || 0}, ${body.exit_code !== undefined && body.exit_code !== null ? body.exit_code : null},
         ${JSON.stringify(body.pod_labels || {})},
         ${JSON.stringify(body.raw_event || {})},
         ${body.severity || "warning"})
      ON CONFLICT DO NOTHING
    `;
    await invalidateCache(`stats:${orgId}`);
    return { incident_id: id };
  });

  // PATCH /api/incidents/:id/acknowledge — member+
  app.patch("/:id/acknowledge", {
    onRequest: [(app as any).authenticate, requirePermission("acknowledgeIncident")],
  }, async (req) => {
    const { org_id, sub } = getUser(req);
    const { id } = req.params as { id: string };
    await sql`
      UPDATE incidents SET status = 'acknowledged', acknowledged_by = ${sub}
      WHERE incident_id = ${id} AND org_id = ${org_id}
    `;
    await invalidateCache(`stats:${org_id}`);
    return { message: "Acknowledged" };
  });

  // PATCH /api/incidents/:id/resolve — member+
  app.patch("/:id/resolve", {
    onRequest: [(app as any).authenticate, requirePermission("resolveIncident")],
  }, async (req) => {
    const { org_id, sub } = getUser(req);
    const { id } = req.params as { id: string };
    await sql`
      UPDATE incidents SET status = 'resolved', resolved_at = now(), resolved_by = ${sub}
      WHERE incident_id = ${id} AND org_id = ${org_id}
    `;

    // Mark existing notifications of this incident as read
    await sql`
      UPDATE user_notifications
      SET is_read = true
      WHERE incident_id = ${id} AND org_id = ${org_id}
    `;

    // Insert resolved notification for all users
    const [inc] = await sql`SELECT pod_name, namespace, severity, cluster_id FROM incidents WHERE incident_id = ${id} AND org_id = ${org_id}`;
    if (inc) {
      const title = `${inc.pod_name} resolved`;
      const subText = `Resolved by user · ${inc.namespace}`;
      const severity = inc.severity || 'warning';

      const addedNotifs = await sql`
        INSERT INTO user_notifications (org_id, user_id, incident_id, cluster_id, title, sub, severity, type)
        SELECT 
          ${org_id}, 
          u.user_id, 
          ${id}, 
          ${inc.cluster_id || null},
          ${title}, 
          ${subText}, 
          ${severity}, 
          'resolved'
        FROM users u
        LEFT JOIN user_alert_preferences p ON u.user_id = p.user_id
        WHERE u.org_id = ${org_id} 
          AND u.is_active = true
          AND (p.notifications_muted IS DISTINCT FROM true)
          AND (p.notifications_muted_until IS NULL OR p.notifications_muted_until < now())
        RETURNING user_id, notification_id, cluster_id, title, sub, severity, type, is_read, created_at
      `;

      // Publish to Redis for each active user to push SSE live updates
      const redis = (await import("../db/redis.js")).default;
      for (const notif of addedNotifs) {
        const payload = {
          id: notif.notification_id,
          incident_id: id,
          cluster_id: notif.cluster_id,
          title: notif.title,
          sub: notif.sub,
          severity: notif.severity,
          type: notif.type,
          read: notif.is_read,
          time: notif.created_at
        };
        await redis.publish(`srevox:notifications:${notif.user_id}`, JSON.stringify({ type: "notification", notification: payload }));
      }
    }

    await invalidateCache(`stats:${org_id}`);
    return { message: "Resolved" };
  });

  // GET /api/incidents/:id/logs — member+
  app.get("/:id/logs", {
    onRequest: [(app as any).authenticate, requirePermission("runDiagnosis")],
  }, async (req, reply) => {
    const { org_id } = getUser(req);
    const { id } = req.params as { id: string };
    const [incident] = await sql`
      SELECT * FROM incidents WHERE incident_id = ${id} AND org_id = ${org_id}
    `;
    if (!incident) return reply.status(404).send({ detail: "Incident not found" });

    try {
      if (incident.pod_name.startsWith("simulated-")) {
        throw new Error("Simulated pod log request");
      }
      let logs = "";
      try {
        logs = await fetchK8sPodLogs(incident.cluster_id, incident.namespace, incident.pod_name, incident.container_name || undefined, false);
      } catch (err: any) {
        // Fallback to previous container logs if active logs throw (e.g. terminated container)
        logs = await fetchK8sPodLogs(incident.cluster_id, incident.namespace, incident.pod_name, incident.container_name || undefined, true);
      }
      if (!logs || logs.trim().length === 0) {
        try {
          logs = await fetchK8sPodLogs(incident.cluster_id, incident.namespace, incident.pod_name, incident.container_name || undefined, true);
        } catch {}
      }
      return { logs };
    } catch (err: any) {
      const isSimulated = incident.pod_name.startsWith("simulated-") || err.message?.toLowerCase().includes("simulated");
      const isNotFoundError = err.response?.statusCode === 404 || 
                             err.message?.includes("404") || 
                             err.message?.toLowerCase().includes("not found");

      if (isSimulated) {
        const simulatedLogs = `2026-05-31T06:20:00.123Z [server] Starting Srevox Backend Service...
2026-05-31T06:20:00.456Z [database] Connecting to PostgreSQL at postgres:5432...
2026-05-31T06:20:01.789Z [database] Connection successful!
2026-05-31T06:20:02.012Z [redis] Connecting to Redis at redis:6379...
2026-05-31T06:20:05.023Z [redis] Error: Connection timeout. Failed to connect to redis:6379
2026-05-31T06:20:05.024Z [error] UnhandledPromiseRejectionWarning: Error: Connection refused
    at RedisClient.on_error (/app/node_modules/redis/index.js:342:15)
    at Socket.<anonymous> (/app/node_modules/redis/index.js:211:14)
    at Socket.emit (node:events:513:28)
    at emitErrorNT (node:internal/streams/destroy:151:8)
    at emitErrorCloseNT (node:internal/streams/destroy:116:3)
    at process.processTicksAndRejections (node:internal/process/task_queues:82:21)
2026-05-31T06:20:05.025Z [server] Exited with code 1`;
        return { logs: simulatedLogs };
      }

      if (isNotFoundError) {
        return reply.status(404).send({
          detail: "Pod logs not found. The pod might have been stopped, terminated, or replaced by a new deployment.",
          code: 404
        });
      }

      const isConnectionError = err.message?.toLowerCase().includes("cluster not found") || err.message?.toLowerCase().includes("kubeconfig") || !incident.cluster_id;
      const errorMsg = err.response?.body?.message || err.message || JSON.stringify(err);
      const statusCode = err.response?.statusCode || 500;
      
      return reply.status(statusCode).send({
        detail: `Failed to fetch pod logs: ${errorMsg}`,
        code: statusCode,
        isConnectionError: isConnectionError || statusCode === 401 || statusCode === 403
      });
    }
  });

  // POST /api/incidents/:id/diagnose — member+
  app.post("/:id/diagnose", {
    onRequest: [(app as any).authenticate, requirePermission("runDiagnosis")],
  }, async (req, reply) => {
    const { org_id, sub } = getUser(req);
    const { id } = req.params as { id: string };
    const [incident] = await sql`
      SELECT * FROM incidents WHERE incident_id = ${id} AND org_id = ${org_id}
    `;
    if (!incident) return reply.status(404).send({ detail: "Not found" });

    // Check user_ai_diagnoses first
    const [cachedDiag] = await sql`
      SELECT ai_diagnosis FROM user_ai_diagnoses WHERE incident_id = ${id} AND user_id = ${sub}
    `;
    if (cachedDiag) return { diagnosis: cachedDiag.ai_diagnosis, cached: true };

    // Try fetching logs to include in AI diagnosis
    let logs = "";
    if (incident.pod_name.startsWith("simulated-")) {
      logs = `2026-05-31T06:20:00.123Z [server] Starting Srevox Backend Service...
2026-05-31T06:20:00.456Z [database] Connecting to PostgreSQL at postgres:5432...
2026-05-31T06:20:01.789Z [database] Connection successful!
2026-05-31T06:20:02.012Z [redis] Connecting to Redis at redis:6379...
2026-05-31T06:20:05.023Z [redis] Error: Connection timeout. Failed to connect to redis:6379
2026-05-31T06:20:05.024Z [error] UnhandledPromiseRejectionWarning: Error: Connection refused
    at RedisClient.on_error (/app/node_modules/redis/index.js:342:15)
    at Socket.<anonymous> (/app/node_modules/redis/index.js:211:14)
    at Socket.emit (node:events:513:28)
    at emitErrorNT (node:internal/streams/destroy:151:8)
    at emitErrorCloseNT (node:internal/streams/destroy:116:3)
    at process.processTicksAndRejections (node:internal/process/task_queues:82:21)
2026-05-31T06:20:05.025Z [server] Exited with code 1`;
    } else {
      try {
        try {
          logs = await fetchK8sPodLogs(incident.cluster_id, incident.namespace, incident.pod_name, incident.container_name || undefined, true);
        } catch {
          logs = await fetchK8sPodLogs(incident.cluster_id, incident.namespace, incident.pod_name, incident.container_name || undefined, false);
        }
      } catch (e: any) {
        console.warn(`Could not retrieve logs for diagnosis of incident ${id}:`, e.message || e);
        // Do not fallback to Redis logs for real pods when fetching logs fails
        logs = "";
      }
    }

    const { provider } = (req.body || {}) as { provider?: string };

    const [aiSettings] = await sql`
      SELECT provider, model, api_key_groq, api_key_openai, api_key_anthropic, ollama_url 
      FROM ai_settings WHERE user_id = ${sub} LIMIT 1
    `;

    const body: Record<string, any> = { user_id: sub };
    if (logs) {
      body.logs = logs;
    }
    if (aiSettings) {
      const activeProvider = provider || aiSettings.provider || "groq";
      let activeModel = aiSettings.model || "llama-3.1-8b-instant";
      
      if (provider && provider !== aiSettings.provider) {
        if (provider === "groq") activeModel = "llama-3.3-70b-versatile";
        else if (provider === "openai") activeModel = "gpt-4o-mini";
        else if (provider === "anthropic") activeModel = "claude-sonnet-4-5";
        else if (provider === "ollama") activeModel = "llama3";
      }

      let activeKey = "";
      if (activeProvider === "groq") activeKey = decrypt(aiSettings.api_key_groq || "");
      else if (activeProvider === "openai") activeKey = decrypt(aiSettings.api_key_openai || "");
      else if (activeProvider === "anthropic") activeKey = decrypt(aiSettings.api_key_anthropic || "");

      body.provider = activeProvider;
      body.model = activeModel;
      body.api_key = activeKey;
      body.ollama_url = aiSettings.ollama_url || "http://localhost:11434";
    }

    try {
      const res = await axios.post(
        `${process.env.AI_SERVICE_URL || "http://localhost:8000"}/api/diagnose/${id}`,
        body, { timeout: 60000 }
      );
      return res.data;
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.response?.data?.error || err.message;
      return reply.status(502).send({ detail: `AI service unavailable: ${msg}` });
    }
  });

  // DELETE /api/incidents/:id — admin only
  app.delete("/:id", {
    onRequest: [(app as any).authenticate, requirePermission("deleteIncident")],
  }, async (req) => {
    const { org_id } = getUser(req);
    const { id } = req.params as { id: string };
    await sql`
      DELETE FROM incidents WHERE incident_id = ${id} AND org_id = ${org_id}
    `;
    await invalidateCache(`stats:${org_id}`);
    return { message: "Deleted" };
  });

  // POST /api/incidents/bulk-acknowledge — member+
  app.post("/bulk-acknowledge", {
    onRequest: [(app as any).authenticate, requirePermission("acknowledgeIncident")],
  }, async (req, reply) => {
    const { org_id, sub } = getUser(req);
    const { ids } = req.body as { ids: string[] };
    if (!Array.isArray(ids) || ids.length === 0) {
      return reply.status(400).send({ detail: "ids array required" });
    }
    await sql`
      UPDATE incidents SET status = 'acknowledged', acknowledged_by = ${sub}
      WHERE incident_id IN ${sql(ids)} AND org_id = ${org_id}
    `;
    await invalidateCache(`stats:${org_id}`);
    return { message: "Bulk Acknowledged" };
  });

  // POST /api/incidents/bulk-resolve — member+
  app.post("/bulk-resolve", {
    onRequest: [(app as any).authenticate, requirePermission("resolveIncident")],
  }, async (req, reply) => {
    const { org_id, sub } = getUser(req);
    const { ids } = req.body as { ids: string[] };
    if (!Array.isArray(ids) || ids.length === 0) {
      return reply.status(400).send({ detail: "ids array required" });
    }
    await sql`
      UPDATE incidents SET status = 'resolved', resolved_at = now(), resolved_by = ${sub}
      WHERE incident_id IN ${sql(ids)} AND org_id = ${org_id}
    `;

    for (const id of ids) {
      await sql`
        UPDATE user_notifications
        SET is_read = true
        WHERE incident_id = ${id} AND org_id = ${org_id}
      `;
      const [inc] = await sql`SELECT pod_name, namespace, severity, cluster_id FROM incidents WHERE incident_id = ${id} AND org_id = ${org_id}`;
      if (inc) {
        const title = `${inc.pod_name} resolved`;
        const subText = `Resolved by user · ${inc.namespace}`;
        const severity = inc.severity || 'warning';

        const addedNotifs = await sql`
          INSERT INTO user_notifications (org_id, user_id, incident_id, cluster_id, title, sub, severity, type)
          SELECT 
            ${org_id}, 
            u.user_id, 
            ${id}, 
            ${inc.cluster_id || null},
            ${title}, 
            ${subText}, 
            ${severity}, 
            'resolved'
          FROM users u
          LEFT JOIN user_alert_preferences p ON u.user_id = p.user_id
          WHERE u.org_id = ${org_id} 
            AND u.is_active = true
            AND (p.notifications_muted IS DISTINCT FROM true)
            AND (p.notifications_muted_until IS NULL OR p.notifications_muted_until < now())
          RETURNING user_id, notification_id, cluster_id, title, sub, severity, type, is_read, created_at
        `;

        const redis = (await import("../db/redis.js")).default;
        for (const notif of addedNotifs) {
          const payload = {
            id: notif.notification_id,
            incident_id: id,
            cluster_id: notif.cluster_id,
            title: notif.title,
            sub: notif.sub,
            severity: notif.severity,
            type: notif.type,
            read: notif.is_read,
            time: notif.created_at
          };
          await redis.publish(`srevox:notifications:${notif.user_id}`, JSON.stringify({ type: "notification", notification: payload }));
        }
      }
    }

    await invalidateCache(`stats:${org_id}`);
    return { message: "Bulk Resolved" };
  });

  // POST /api/incidents/bulk-delete — admin only
  app.post("/bulk-delete", {
    onRequest: [(app as any).authenticate, requirePermission("deleteIncident")],
  }, async (req, reply) => {
    const { org_id } = getUser(req);
    const { ids } = req.body as { ids: string[] };
    if (!Array.isArray(ids) || ids.length === 0) {
      return reply.status(400).send({ detail: "ids array required" });
    }
    await sql`
      DELETE FROM incidents WHERE incident_id IN ${sql(ids)} AND org_id = ${org_id}
    `;
    await invalidateCache(`stats:${org_id}`);
    return { message: "Bulk Deleted" };
  });
}