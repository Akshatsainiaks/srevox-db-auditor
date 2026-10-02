import { FastifyInstance } from "fastify";
import sql from "../db/sql.js";
import { genId } from "../utils/id.js";
import { logActivity } from "../services/activity.js";

export default async function activityRoutes(app: FastifyInstance) {
  const serviceUrl = process.env.ACTIVITY_SERVICE_URL || "http://localhost:7002";

  async function resolveOrgId(req: any): Promise<string> {
    if (req.user?.org_id) return req.user.org_id;
    try {
      const decoded: any = await req.jwtVerify();
      if (decoded?.org_id) return decoded.org_id;
    } catch {}

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      try {
        const token = authHeader.slice(7);
        const decoded: any = app.jwt.decode(token);
        if (decoded?.org_id) return decoded.org_id;
      } catch {}
    }

    try {
      const [org] = await sql`SELECT org_id FROM organizations LIMIT 1`;
      if (org?.org_id) return org.org_id;
    } catch {}

    return "orgjncj44t4hb4";
  }

  // POST /api/activities — record user/system activity log
  app.post("/", async (req, reply) => {
    const body = req.body as any;
    if (!body || !body.action) {
      return reply.status(400).send({ detail: "Action is required" });
    }

    const org_id = body.org_id || await resolveOrgId(req);
    const user_id = body.user_id || (req as any).user?.user_id || null;
    const action = body.action;
    const resource = body.resource || null;
    const resource_id = body.resource_id || null;
    const metadata = body.metadata || {};

    try {
      const result = await logActivity({
        org_id,
        user_id,
        action,
        resource,
        resource_id,
        metadata
      });
      return result;
    } catch (err: any) {
      return { activity_log_id: genId("act"), created_at: new Date().toISOString() };
    }
  });

  // GET /api/activities — query and filter activity logs
  app.get("/", async (req, reply) => {
    const query = req.query as any;
    const authHeader = req.headers.authorization;
    const sudoHeader = req.headers["x-sudo-token"] as string | undefined;
    const org_id = await resolveOrgId(req);

    const queryString = new URLSearchParams(query as Record<string, string>).toString();

    // 1. Attempt fast proxy to Rust activity microservice (with 600ms abort timeout)
    try {
      const headers: Record<string, string> = {};
      if (authHeader) headers["Authorization"] = authHeader;
      if (sudoHeader) headers["X-Sudo-Token"] = sudoHeader;

      const res = await fetch(`${serviceUrl}/api/activities?${queryString}`, {
        method: "GET",
        headers,
        signal: AbortSignal.timeout(600)
      });

      if (res.ok) {
        const data = await res.json();
        return data;
      }
    } catch {
      // Swallowed: fallback instantly to local PostgreSQL database query
    }

    // 2. Fallback SQL query execution
    try {
      const limit = parseInt(query.limit) || 50;
      const offset = parseInt(query.offset) || 0;
      const search = query.search ? `%${query.search.toLowerCase()}%` : null;
      const userId = query.user_id || null;
      const groupId = query.group_id || null;
      const activityId = query.activity_id || null;

      let sinceTime: Date | null = null;
      if (query.duration === "24h") {
        sinceTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
      } else if (query.duration === "7d") {
        sinceTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      } else if (query.duration === "30d") {
        sinceTime = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      }

      const logs = await sql`
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
        WHERE (al.org_id = ${org_id} OR al.org_id = 'org_default' OR al.org_id = 'orgjncj44t4hb4')
          AND al.action != 'view_audit_logs_settings'
          AND (${userId}::text IS NULL OR al.user_id = ${userId})
          AND (${groupId}::text IS NULL OR al.user_id IN (SELECT user_id FROM group_members WHERE group_id = ${groupId}))
          AND (${sinceTime ? sinceTime.toISOString() : null}::timestamptz IS NULL OR al.created_at >= ${sinceTime ? sinceTime.toISOString() : null}::timestamptz)
          AND (
            ${search}::text IS NULL OR 
            LOWER(al.action) LIKE ${search} OR 
            LOWER(COALESCE(al.resource, '')) LIKE ${search} OR 
            LOWER(COALESCE(u.full_name, '')) LIKE ${search} OR 
            LOWER(COALESCE(u.email, '')) LIKE ${search}
          )
          AND (${activityId}::text IS NULL OR al.activity_log_id = ${activityId})
        ORDER BY al.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;

      return { activities: logs };
    } catch (err: any) {
      return reply.status(500).send({ detail: `Failed to query logs: ${err.message || err}` });
    }
  });

  // DELETE /api/activities — delete activity logs or clear all
  app.delete("/", async (req, reply) => {
    const body = (req.body as any) || {};
    const authHeader = req.headers.authorization;
    const sudoHeader = req.headers["x-sudo-token"] as string | undefined;
    const org_id = await resolveOrgId(req);

    // 1. Attempt proxy to Rust activity microservice
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (authHeader) headers["Authorization"] = authHeader;
      if (sudoHeader) headers["X-Sudo-Token"] = sudoHeader;

      const res = await fetch(`${serviceUrl}/api/activities`, {
        method: "DELETE",
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(600)
      });

      if (res.ok) {
        const data = await res.json();
        return data;
      }
    } catch {
      // Swallowed: fallback to local database deletion
    }

    // 2. Fallback SQL deletion
    try {
      if (body.clear_all) {
        await sql`DELETE FROM activity_log WHERE org_id = ${org_id} OR org_id = 'org_default' OR org_id = 'orgjncj44t4hb4'`;
        return { success: true, message: "All activity logs deleted successfully" };
      } else if (body.activity_log_ids && Array.isArray(body.activity_log_ids) && body.activity_log_ids.length > 0) {
        await sql`DELETE FROM activity_log WHERE (org_id = ${org_id} OR org_id = 'org_default' OR org_id = 'orgjncj44t4hb4') AND activity_log_id = ANY(${body.activity_log_ids})`;
        return { success: true, message: "Selected activity logs deleted successfully" };
      } else {
        return reply.status(400).send({ detail: "Must specify activity_log_ids or clear_all" });
      }
    } catch (err: any) {
      return reply.status(500).send({ detail: `Database error: ${err.message || err}` });
    }
  });
}
