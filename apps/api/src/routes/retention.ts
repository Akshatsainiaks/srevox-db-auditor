import { FastifyInstance } from "fastify";
import sql from "../db/sql.js";
import { getUser, requirePermission } from "../middleware/rbac.js";

export default async function retentionRoutes(app: FastifyInstance) {

  // GET /api/retention/audit-logs — get audit logs retention policy
  app.get("/audit-logs", { onRequest: [(app as any).authenticate] }, async (req) => {
    const { org_id } = getUser(req);

    const [policy] = await sql`
      SELECT activity_days, purge_interval_hours FROM retention_policies
      WHERE org_id = ${org_id}
    `;

    const runs = await sql`
      SELECT run_id, run_type, items_purged, completed_at
      FROM retention_runs
      WHERE org_id = ${org_id} AND run_type = 'logs'
      ORDER BY completed_at DESC
      LIMIT 20
    `;

    return {
      policy: policy || { activity_days: 0, purge_interval_hours: 4 },
      runs: runs || [],
    };
  });

  // PUT /api/retention/audit-logs — save audit logs retention policy (admin/custom permission)
  app.put("/audit-logs", { onRequest: [(app as any).authenticate, requirePermission("changeRetention")] }, async (req, reply) => {
    const { org_id } = getUser(req);

    const { activity_days = 0, purge_interval_hours = 4 } = req.body as {
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

    if (activity_days && activity_days > 0) {
      const logsRes = await sql`
        DELETE FROM activity_log 
        WHERE org_id = ${org_id} 
          AND created_at < now() - (${activity_days} * interval '1 day')
        RETURNING action, resource, resource_id, created_at
      `;
      const logsDetails = JSON.stringify(logsRes || []);
      await sql`
        INSERT INTO retention_runs (org_id, run_type, items_purged, purged_details, completed_at)
        VALUES (${org_id}, 'logs', ${logsRes.length || 0}, ${logsDetails}, now())
      `;
    }

    return { message: "Audit logs retention policy saved successfully" };
  });

  // GET /api/retention/incidents — get incidents auto-purge policy
  app.get("/incidents", { onRequest: [(app as any).authenticate] }, async (req) => {
    const { org_id } = getUser(req);

    const [policy] = await sql`
      SELECT incident_days, purge_interval_hours FROM retention_policies
      WHERE org_id = ${org_id}
    `;

    const runs = await sql`
      SELECT run_id, run_type, items_purged, completed_at
      FROM retention_runs
      WHERE org_id = ${org_id} AND run_type = 'incidents'
      ORDER BY completed_at DESC
      LIMIT 20
    `;

    return {
      policy: policy || { incident_days: 0, purge_interval_hours: 4 },
      runs: runs || [],
    };
  });

  // PUT /api/retention/incidents — save incidents auto-purge policy (admin/custom permission)
  app.put("/incidents", { onRequest: [(app as any).authenticate, requirePermission("changeRetention")] }, async (req, reply) => {
    const { org_id } = getUser(req);

    const { incident_days = 0, purge_interval_hours = 4 } = req.body as {
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

    if (incident_days && incident_days > 0) {
      const incRes = await sql`
        DELETE FROM incidents 
        WHERE org_id = ${org_id} 
          AND first_seen_at < now() - (${incident_days} * interval '1 day')
        RETURNING pod_name, namespace, crash_reason, first_seen_at
      `;
      const incDetails = JSON.stringify(incRes || []);
      await sql`
        INSERT INTO retention_runs (org_id, run_type, items_purged, purged_details, completed_at)
        VALUES (${org_id}, 'incidents', ${incRes.length || 0}, ${incDetails}, now())
      `;
    }

    return { message: "Incident retention policy saved successfully" };
  });

  // GET /api/retention/runs/:runId — admin/custom permission
  app.get("/runs/:runId", { onRequest: [(app as any).authenticate, requirePermission("viewActivityLog")] }, async (req, reply) => {
    const { org_id } = getUser(req);
    const { runId } = req.params as { runId: string };

    const [run] = await sql`
      SELECT run_id, run_type, items_purged, purged_details, completed_at
      FROM retention_runs
      WHERE run_id = ${runId} AND org_id = ${org_id}
    `;
    if (!run) return reply.status(404).send({ detail: "Run not found" });

    let details = [];
    try {
      details = typeof run.purged_details === "string" ? JSON.parse(run.purged_details) : run.purged_details;
    } catch {
      details = [];
    }

    return {
      run_id: run.run_id,
      run_type: run.run_type,
      items_purged: run.items_purged,
      completed_at: run.completed_at,
      details,
    };
  });

  // DELETE /api/retention/runs — admin/custom permission: clear retention runs history
  app.delete("/runs", { onRequest: [(app as any).authenticate, requirePermission("changeRetention")] }, async (req, reply) => {
    const { org_id } = getUser(req);
    const { type } = req.query as { type?: string };

    if (type) {
      await sql`
        DELETE FROM retention_runs
        WHERE org_id = ${org_id} AND run_type = ${type}
      `;
    } else {
      await sql`
        DELETE FROM retention_runs
        WHERE org_id = ${org_id}
      `;
    }

    return { message: "Retention history cleared successfully" };
  });
}
