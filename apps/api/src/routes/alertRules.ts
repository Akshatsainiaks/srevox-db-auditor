import { FastifyInstance } from "fastify";
import { genId } from "../utils/id.js";
import sql from "../db/sql.js";
import { getUser, requirePermission } from "../middleware/rbac.js";
import { CRASH_REASONS } from "../types/index.js";

const parseArr = (v: unknown): string[] =>
  typeof v === "string" ? JSON.parse(v) : (Array.isArray(v) ? v : []);

export default async function alertRuleRoutes(app: FastifyInstance) {

  // GET /api/alert-rules — all roles
  app.get("/", { onRequest: [(app as any).authenticate] }, async (req) => {
    const { org_id } = getUser(req);
    const rules = await sql`
      SELECT ar.*, c.name as cluster_name
      FROM alert_rules ar
      LEFT JOIN clusters c ON ar.cluster_id = c.cluster_id
      WHERE ar.org_id = ${org_id}
      ORDER BY ar.created_at DESC
    `;
    const redis = (await import("../db/redis.js")).default;
    const rulesWithMute = await Promise.all(
      rules.map(async (r) => {
        const ttl = await redis.ttl(`mute:rule:${r.rule_id}`);
        return {
          ...r,
          namespaces:    parseArr(r.namespaces),
          crash_reasons: parseArr(r.crash_reasons),
          channel_ids:   parseArr(r.channel_ids),
          muted_ttl:     ttl > 0 ? ttl : null,
        };
      })
    );
    return { rules: rulesWithMute };
  });

  // GET /api/alert-rules/:id
  app.get("/:id", { onRequest: [(app as any).authenticate] }, async (req, reply) => {
    const { org_id } = getUser(req);
    const { id } = req.params as { id: string };
    const [rule] = await sql`
      SELECT ar.*, c.name as cluster_name
      FROM alert_rules ar
      LEFT JOIN clusters c ON ar.cluster_id = c.cluster_id
      WHERE ar.rule_id = ${id} AND ar.org_id = ${org_id}
    `;
    if (!rule) return reply.status(404).send({ detail: "Alert rule not found" });

    const redis = (await import("../db/redis.js")).default;
    const ttl = await redis.ttl(`mute:rule:${id}`);

    return {
      ...rule,
      namespaces:    parseArr(rule.namespaces),
      crash_reasons: parseArr(rule.crash_reasons),
      channel_ids:   parseArr(rule.channel_ids),
      muted_ttl:     ttl > 0 ? ttl : null,
    };
  });

  // POST /api/alert-rules — admin only
  app.post("/", {
    onRequest: [(app as any).authenticate, requirePermission("addRule")],
  }, async (req, reply) => {
    const { org_id } = getUser(req);
    const {
      name, cluster_id, description = "",
      namespaces = [], crash_reasons,
      min_restarts = 3, cooldown_minutes = 15,
      severity = "warning", channel_ids = [],
      only_increase_restarts = true,
    } = req.body as any;

    if (!name || !cluster_id)
      return reply.status(400).send({ detail: "name and cluster_id required" });

    // Verify cluster belongs to this org
    const [cluster] = await sql`
      SELECT cluster_id FROM clusters WHERE cluster_id = ${cluster_id} AND org_id = ${org_id}
    `;
    if (!cluster) return reply.status(404).send({ detail: "Cluster not found in your organization" });

    const id = genId("arl");
    await sql`
      INSERT INTO alert_rules
        (rule_id, org_id, cluster_id, name, description, namespaces,
         crash_reasons, min_restarts, cooldown_minutes, severity, channel_ids, only_increase_restarts)
      VALUES
        (${id}, ${org_id}, ${cluster_id}, ${name}, ${description},
         ${JSON.stringify(namespaces)}, ${JSON.stringify(crash_reasons || CRASH_REASONS)},
         ${min_restarts}, ${cooldown_minutes}, ${severity}, ${JSON.stringify(channel_ids)}, ${only_increase_restarts})
    `;
    return { rule_id: id, name, severity };
  });

  // PATCH /api/alert-rules/:id/toggle — member+
  app.patch("/:id/toggle", {
    onRequest: [(app as any).authenticate, requirePermission("toggleRule")],
  }, async (req) => {
    const { org_id } = getUser(req);
    const { id } = req.params as { id: string };
    await sql`UPDATE alert_rules SET enabled = NOT enabled WHERE rule_id = ${id} AND org_id = ${org_id}`;
    return { message: "Toggled" };
  });

  // PATCH /api/alert-rules/:id — admin only
  app.patch("/:id", {
    onRequest: [(app as any).authenticate, requirePermission("addRule")],
  }, async (req) => {
    const { org_id } = getUser(req);
    const { id } = req.params as { id: string };
    const body = req.body as Record<string, unknown>;

    if (body.name)             await sql`UPDATE alert_rules SET name = ${body.name as string} WHERE rule_id = ${id} AND org_id = ${org_id}`;
    if (body.cluster_id)       await sql`UPDATE alert_rules SET cluster_id = ${body.cluster_id as string} WHERE rule_id = ${id} AND org_id = ${org_id}`;
    if (body.description !== undefined) await sql`UPDATE alert_rules SET description = ${body.description as string} WHERE rule_id = ${id} AND org_id = ${org_id}`;
    if (body.min_restarts)     await sql`UPDATE alert_rules SET min_restarts = ${body.min_restarts as number} WHERE rule_id = ${id} AND org_id = ${org_id}`;
    if (body.cooldown_minutes) await sql`UPDATE alert_rules SET cooldown_minutes = ${body.cooldown_minutes as number} WHERE rule_id = ${id} AND org_id = ${org_id}`;
    if (body.severity)         await sql`UPDATE alert_rules SET severity = ${body.severity as string} WHERE rule_id = ${id} AND org_id = ${org_id}`;
    if (body.channel_ids)      await sql`UPDATE alert_rules SET channel_ids = ${JSON.stringify(body.channel_ids)} WHERE rule_id = ${id} AND org_id = ${org_id}`;
    if (body.namespaces)       await sql`UPDATE alert_rules SET namespaces = ${JSON.stringify(body.namespaces)} WHERE rule_id = ${id} AND org_id = ${org_id}`;
    if (body.only_increase_restarts !== undefined) await sql`UPDATE alert_rules SET only_increase_restarts = ${body.only_increase_restarts as boolean} WHERE rule_id = ${id} AND org_id = ${org_id}`;

    return { message: "Updated" };
  });

  // DELETE /api/alert-rules/:id — admin only
  app.delete("/:id", {
    onRequest: [(app as any).authenticate, requirePermission("deleteRule")],
  }, async (req) => {
    const { org_id } = getUser(req);
    const { id } = req.params as { id: string };
    await sql`UPDATE incidents SET rule_id = NULL WHERE rule_id = ${id}`;
    await sql`DELETE FROM alert_rules WHERE rule_id = ${id} AND org_id = ${org_id}`;
    return { message: "Deleted" };
  });

  // POST /api/alert-rules/:id/mute — member+
  app.post("/:id/mute", {
    onRequest: [(app as any).authenticate, requirePermission("toggleRule")],
  }, async (req, reply) => {
    const { org_id } = getUser(req);
    const { id } = req.params as { id: string };
    const { minutes } = req.body as { minutes: number };

    if (!minutes || typeof minutes !== "number" || minutes <= 0) {
      return reply.status(400).send({ detail: "minutes must be a positive number" });
    }

    // Verify rule belongs to this org
    const [rule] = await sql`
      SELECT rule_id FROM alert_rules WHERE rule_id = ${id} AND org_id = ${org_id}
    `;
    if (!rule) return reply.status(404).send({ detail: "Alert rule not found" });

    // Set mute key in Redis with TTL
    const redis = (await import("../db/redis.js")).default;
    await redis.setex(`mute:rule:${id}`, minutes * 60, "1");

    return { message: `Rule muted for ${minutes} minutes` };
  });

  // POST /api/alert-rules/:id/unmute — member+
  app.post("/:id/unmute", {
    onRequest: [(app as any).authenticate, requirePermission("toggleRule")],
  }, async (req, reply) => {
    const { org_id } = getUser(req);
    const { id } = req.params as { id: string };

    // Verify rule belongs to this org
    const [rule] = await sql`
      SELECT rule_id FROM alert_rules WHERE rule_id = ${id} AND org_id = ${org_id}
    `;
    if (!rule) return reply.status(404).send({ detail: "Alert rule not found" });

    // Delete mute key from Redis
    const redis = (await import("../db/redis.js")).default;
    await redis.del(`mute:rule:${id}`);

    return { message: "Rule unmuted" };
  });
}