import { FastifyInstance } from "fastify";
import { genId } from "../utils/id.js";
import sql from "../db/sql.js";
import { getUser, requirePermission } from "../middleware/rbac.js";

export default async function notificationGroupRoutes(app: FastifyInstance) {

  // GET /api/notification-groups
  app.get("/", { onRequest: [(app as any).authenticate] }, async (req) => {
    const { org_id } = getUser(req);
    const groups = await sql`
      SELECT group_id, name, emails, created_at
      FROM notification_groups
      WHERE org_id = ${org_id}
      ORDER BY name ASC
    `;
    return { groups };
  });

  // POST /api/notification-groups
  app.post("/", {
    onRequest: [(app as any).authenticate, requirePermission("addChannel")], // reuse channel management permission
  }, async (req, reply) => {
    const { org_id } = getUser(req);
    const { name, emails = [] } = req.body as { name: string; emails: string[] };
    if (!name) return reply.status(400).send({ detail: "name is required" });

    const id = genId("ngp");
    await sql`
      INSERT INTO notification_groups (group_id, org_id, name, emails)
      VALUES (${id}, ${org_id}, ${name}, ${JSON.stringify(emails)})
    `;
    return { group_id: id, name, emails };
  });

  // PUT /api/notification-groups/:id
  app.put("/:id", {
    onRequest: [(app as any).authenticate, requirePermission("addChannel")],
  }, async (req, reply) => {
    const { org_id } = getUser(req);
    const { id } = req.params as { id: string };
    const { name, emails } = req.body as { name?: string; emails?: string[] };

    const [group] = await sql`
      SELECT group_id FROM notification_groups 
      WHERE group_id = ${id} AND org_id = ${org_id}
    `;
    if (!group) return reply.status(404).send({ detail: "Group not found" });

    if (name !== undefined) {
      await sql`UPDATE notification_groups SET name = ${name} WHERE group_id = ${id}`;
    }
    if (emails !== undefined) {
      await sql`UPDATE notification_groups SET emails = ${JSON.stringify(emails)} WHERE group_id = ${id}`;
    }

    return { message: "Updated" };
  });

  // DELETE /api/notification-groups/:id
  app.delete("/:id", {
    onRequest: [(app as any).authenticate, requirePermission("deleteChannel")],
  }, async (req, reply) => {
    const { org_id } = getUser(req);
    const { id } = req.params as { id: string };

    const [group] = await sql`
      SELECT group_id FROM notification_groups 
      WHERE group_id = ${id} AND org_id = ${org_id}
    `;
    if (!group) return reply.status(404).send({ detail: "Group not found" });

    await sql`DELETE FROM notification_groups WHERE group_id = ${id}`;
    return { message: "Deleted" };
  });
}
