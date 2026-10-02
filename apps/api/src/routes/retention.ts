import { FastifyInstance } from "fastify";
import sql from "../db/sql.js";
import { getUser, requirePermission } from "../middleware/rbac.js";
import { genId } from "../utils/id.js";

export default async function retentionRoutes(app: FastifyInstance) {

  // GET /api/retention — full overview of all retention policies and runs
  app.get("/", { onRequest: [(app as any).authenticate] }, async (req) => {
    const { org_id } = getUser(req);

    const [policy] = await sql`
      SELECT org_id, db_audit_days, activity_days, incident_days, purge_interval_hours,
             last_audit_purge_at, last_logs_purge_at, last_incidents_purge_at, updated_at
      FROM retention_policies
      WHERE org_id = ${org_id}
      LIMIT 1
    `;

    const runs = await sql`
      SELECT run_id, run_type, items_purged, status, completed_at
      FROM retention_runs
      WHERE org_id = ${org_id} OR org_id = 'org_default'
      ORDER BY completed_at DESC
      LIMIT 20
    `;

    const [stats] = await sql`
      SELECT 
        COUNT(*)::int AS total_events,
        MIN(commit_timestamp) AS oldest_event,
        MAX(commit_timestamp) AS newest_event
      FROM db_audit_events
      WHERE (org_id = ${org_id} OR org_id IS NULL)
    `;

    return {
      policy: policy || { db_audit_days: 90, activity_days: 30, incident_days: 30, purge_interval_hours: 24 },
      stats: stats || { total_events: 0, oldest_event: null, newest_event: null },
      runs: runs || [],
    };
  });

  // GET /api/retention/db-audit — get CDC audit events retention policy & statistics
  app.get("/db-audit", { onRequest: [(app as any).authenticate] }, async (req) => {
    const { org_id } = getUser(req);

    const [policy] = await sql`
      SELECT db_audit_days, purge_interval_hours, last_audit_purge_at, updated_at
      FROM retention_policies
      WHERE org_id = ${org_id}
      LIMIT 1
    `;

    const runs = await sql`
      SELECT run_id, run_type, items_purged, status, completed_at
      FROM retention_runs
      WHERE (org_id = ${org_id} OR org_id = 'org_default') AND run_type = 'db_audit'
      ORDER BY completed_at DESC
      LIMIT 20
    `;

    const [stats] = await sql`
      SELECT 
        COUNT(*)::int AS total_events,
        MIN(commit_timestamp) AS oldest_event,
        MAX(commit_timestamp) AS newest_event
      FROM db_audit_events
      WHERE (org_id = ${org_id} OR org_id IS NULL)
    `;

    return {
      policy: policy || { db_audit_days: 90, purge_interval_hours: 24 },
      stats: stats || { total_events: 0, oldest_event: null, newest_event: null },
      runs: runs || [],
    };
  });

  // PUT /api/retention/db-audit — save CDC audit events retention policy
  app.put("/db-audit", { onRequest: [(app as any).authenticate, requirePermission("changeRetention")] }, async (req, reply) => {
    const { org_id } = getUser(req);

    const { db_audit_days = 90, purge_interval_hours = 24 } = req.body as {
      db_audit_days?: number;
      purge_interval_hours?: number;
    };

    await sql`
      INSERT INTO retention_policies (org_id, db_audit_days, purge_interval_hours, last_audit_purge_at, updated_at)
      VALUES (${org_id}, ${db_audit_days}, ${purge_interval_hours}, now(), now())
      ON CONFLICT (org_id) DO UPDATE SET
        db_audit_days = EXCLUDED.db_audit_days,
        purge_interval_hours = EXCLUDED.purge_interval_hours,
        last_audit_purge_at = now(),
        updated_at = now()
    `;

    let purgedCount = 0;
    if (db_audit_days && db_audit_days > 0) {
      const purged = await sql`
        DELETE FROM db_audit_events
        WHERE (org_id = ${org_id} OR org_id IS NULL)
          AND commit_timestamp < now() - (${db_audit_days} * interval '1 day')
        RETURNING id, event_id, table_name, operation
      `;
      purgedCount = purged.length || 0;

      if (purgedCount > 0) {
        const runId = genId("run");
        await sql`
          INSERT INTO retention_runs (run_id, org_id, run_type, items_purged, purged_details, status, completed_at)
          VALUES (${runId}, ${org_id}, 'db_audit', ${purgedCount}, ${JSON.stringify(purged.slice(0, 50))}, 'completed', now())
        `;
      }
    }

    return {
      message: "Database audit retention policy saved successfully",
      items_purged: purgedCount,
    };
  });

  // POST /api/retention/db-audit/purge-now — trigger instant manual purge of expired events
  app.post("/db-audit/purge-now", { onRequest: [(app as any).authenticate, requirePermission("changeRetention")] }, async (req, reply) => {
    const { org_id } = getUser(req);

    const [policy] = await sql`
      SELECT db_audit_days FROM retention_policies WHERE org_id = ${org_id} LIMIT 1
    `;

    const days = policy?.db_audit_days || 90;
    if (!days || days <= 0) {
      return reply.status(400).send({ detail: "Retention policy is currently set to Keep Forever. Set a retention window to purge." });
    }

    const purged = await sql`
      DELETE FROM db_audit_events
      WHERE (org_id = ${org_id} OR org_id IS NULL)
        AND commit_timestamp < now() - (${days} * interval '1 day')
      RETURNING id, event_id, table_name, operation
    `;
    const purgedCount = purged.length || 0;

    const runId = genId("run");
    await sql`
      INSERT INTO retention_runs (run_id, org_id, run_type, items_purged, purged_details, status, completed_at)
      VALUES (${runId}, ${org_id}, 'db_audit', ${purgedCount}, ${JSON.stringify(purged.slice(0, 50))}, 'completed', now())
    `;

    return {
      message: `Successfully purged ${purgedCount} expired audit events`,
      items_purged: purgedCount,
    };
  });

  // GET /api/retention/audit-logs — get system activity logs retention policy
  app.get("/audit-logs", { onRequest: [(app as any).authenticate] }, async (req) => {
    const { org_id } = getUser(req);

    const [policy] = await sql`
      SELECT activity_days, purge_interval_hours, last_logs_purge_at, updated_at
      FROM retention_policies
      WHERE org_id = ${org_id}
      LIMIT 1
    `;

    const runs = await sql`
      SELECT run_id, run_type, items_purged, status, completed_at
      FROM retention_runs
      WHERE (org_id = ${org_id} OR org_id = 'org_default') AND run_type = 'logs'
      ORDER BY completed_at DESC
      LIMIT 20
    `;

    return {
      policy: policy || { activity_days: 30, purge_interval_hours: 24 },
      runs: runs || [],
    };
  });

  // PUT /api/retention/audit-logs — save activity logs retention policy
  app.put("/audit-logs", { onRequest: [(app as any).authenticate, requirePermission("changeRetention")] }, async (req, reply) => {
    const { org_id } = getUser(req);

    const { activity_days = 30, purge_interval_hours = 24 } = req.body as {
      activity_days?: number;
      purge_interval_hours?: number;
    };

    await sql`
      INSERT INTO retention_policies (org_id, activity_days, purge_interval_hours, last_logs_purge_at, updated_at)
      VALUES (${org_id}, ${activity_days}, ${purge_interval_hours}, now(), now())
      ON CONFLICT (org_id) DO UPDATE SET
        activity_days = EXCLUDED.activity_days,
        purge_interval_hours = EXCLUDED.purge_interval_hours,
        last_logs_purge_at = now(),
        updated_at = now()
    `;

    let purgedCount = 0;
    if (activity_days && activity_days > 0) {
      const logsRes = await sql`
        DELETE FROM activity_log 
        WHERE org_id = ${org_id} 
          AND created_at < now() - (${activity_days} * interval '1 day')
        RETURNING action, resource, resource_id, created_at
      `;
      purgedCount = logsRes.length || 0;
      if (purgedCount > 0) {
        const runId = genId("run");
        await sql`
          INSERT INTO retention_runs (run_id, org_id, run_type, items_purged, purged_details, status, completed_at)
          VALUES (${runId}, ${org_id}, 'logs', ${purgedCount}, ${JSON.stringify(logsRes.slice(0, 50))}, 'completed', now())
        `;
      }
    }

    return { message: "System activity logs retention policy saved successfully", items_purged: purgedCount };
  });

  // GET /api/retention/incidents — get incidents auto-purge policy
  app.get("/incidents", { onRequest: [(app as any).authenticate] }, async (req) => {
    const { org_id } = getUser(req);

    const [policy] = await sql`
      SELECT incident_days, purge_interval_hours, last_incidents_purge_at, updated_at
      FROM retention_policies
      WHERE org_id = ${org_id}
      LIMIT 1
    `;

    const runs = await sql`
      SELECT run_id, run_type, items_purged, status, completed_at
      FROM retention_runs
      WHERE (org_id = ${org_id} OR org_id = 'org_default') AND run_type = 'incidents'
      ORDER BY completed_at DESC
      LIMIT 20
    `;

    return {
      policy: policy || { incident_days: 30, purge_interval_hours: 24 },
      runs: runs || [],
    };
  });

  // PUT /api/retention/incidents — save incidents auto-purge policy
  app.put("/incidents", { onRequest: [(app as any).authenticate, requirePermission("changeRetention")] }, async (req, reply) => {
    const { org_id } = getUser(req);

    const { incident_days = 30, purge_interval_hours = 24 } = req.body as {
      incident_days?: number;
      purge_interval_hours?: number;
    };

    await sql`
      INSERT INTO retention_policies (org_id, incident_days, purge_interval_hours, last_incidents_purge_at, updated_at)
      VALUES (${org_id}, ${incident_days}, ${purge_interval_hours}, now(), now())
      ON CONFLICT (org_id) DO UPDATE SET
        incident_days = EXCLUDED.incident_days,
        purge_interval_hours = EXCLUDED.purge_interval_hours,
        last_incidents_purge_at = now(),
        updated_at = now()
    `;

    let purgedCount = 0;
    if (incident_days && incident_days > 0) {
      try {
        const incRes = await sql`
          DELETE FROM incidents 
          WHERE org_id = ${org_id} 
            AND first_seen_at < now() - (${incident_days} * interval '1 day')
          RETURNING incident_id, pod_name, namespace, crash_reason, first_seen_at
        `;
        purgedCount = incRes.length || 0;
        if (purgedCount > 0) {
          const runId = genId("run");
          await sql`
            INSERT INTO retention_runs (run_id, org_id, run_type, items_purged, purged_details, status, completed_at)
            VALUES (${runId}, ${org_id}, 'incidents', ${purgedCount}, ${JSON.stringify(incRes.slice(0, 50))}, 'completed', now())
          `;
        }
      } catch {}
    }

    return { message: "Incident retention policy saved successfully", items_purged: purgedCount };
  });

  // GET /api/retention/runs/:runId
  app.get("/runs/:runId", { onRequest: [(app as any).authenticate, requirePermission("viewActivityLog")] }, async (req, reply) => {
    const { org_id } = getUser(req);
    const { runId } = req.params as { runId: string };

    const [run] = await sql`
      SELECT run_id, run_type, items_purged, purged_details, status, completed_at
      FROM retention_runs
      WHERE run_id = ${runId} AND (org_id = ${org_id} OR org_id = 'org_default')
    `;
    if (!run) return reply.status(404).send({ detail: "Run not found" });

    let details = [];
    try {
      details = typeof run.purged_details === "string" ? JSON.parse(run.purged_details) : (run.purged_details || []);
    } catch {
      details = [];
    }

    return {
      run_id: run.run_id,
      run_type: run.run_type,
      items_purged: run.items_purged,
      status: run.status,
      completed_at: run.completed_at,
      details,
    };
  });

  // DELETE /api/retention/runs — clear retention runs history
  app.delete("/runs", { onRequest: [(app as any).authenticate, requirePermission("changeRetention")] }, async (req, reply) => {
    const { org_id } = getUser(req);
    const { type } = req.query as { type?: string };

    if (type) {
      await sql`
        DELETE FROM retention_runs
        WHERE (org_id = ${org_id} OR org_id = 'org_default') AND run_type = ${type}
      `;
    } else {
      await sql`
        DELETE FROM retention_runs
        WHERE (org_id = ${org_id} OR org_id = 'org_default')
      `;
    }

    return { message: "Retention history cleared successfully" };
  });
}
