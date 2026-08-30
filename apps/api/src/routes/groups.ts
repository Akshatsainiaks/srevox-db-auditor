import { FastifyInstance } from "fastify";
import { genId } from "../utils/id.js";
import sql from "../db/sql.js";
import { getUser, requirePermission, PERMISSION_IDS } from "../middleware/rbac.js";

export default async function groupRoutes(app: FastifyInstance) {

  // GET /api/groups — list groups in organization
  app.get("/", {
    onRequest: [(app as any).authenticate],
  }, async (req) => {
    const { org_id } = getUser(req);
    
    // Fetch groups
    const groups = await sql`
      SELECT group_id, org_id, name, description, permissions, created_at
      FROM groups
      WHERE org_id = ${org_id}
      ORDER BY name ASC
    `;

    // Fetch memberships to count and attach summary info
    const memberships = await sql`
      SELECT gm.group_id, u.user_id, u.email, u.full_name, u.role
      FROM group_members gm
      JOIN users u ON gm.user_id = u.user_id
      WHERE u.org_id = ${org_id} AND u.is_active = true
    `;

    const groupsWithMembers = groups.map((g: any) => {
      const groupMembers = memberships.filter((m: any) => m.group_id === g.group_id);
      return {
        ...g,
        member_count: groupMembers.length,
        members: groupMembers.map((m: any) => ({
          user_id: m.user_id,
          email: m.email,
          full_name: m.full_name,
          role: m.role
        }))
      };
    });

    return { groups: groupsWithMembers };
  });

  // GET /api/groups/:id — get specific group details
  app.get("/:id", {
    onRequest: [(app as any).authenticate, requirePermission("viewTeam")],
  }, async (req, reply) => {
    const { org_id } = getUser(req);
    const { id } = req.params as { id: string };

    const [group] = await sql`
      SELECT group_id, org_id, name, description, permissions, created_at
      FROM groups
      WHERE group_id = ${id} AND org_id = ${org_id}
    `;
    if (!group) return reply.status(404).send({ detail: "Group not found" });

    const members = await sql`
      SELECT u.user_id, u.email, u.full_name, u.role
      FROM group_members gm
      JOIN users u ON gm.user_id = u.user_id
      WHERE gm.group_id = ${id} AND u.org_id = ${org_id} AND u.is_active = true
    `;

    return { group, members };
  });

  // POST /api/groups — create user group
  app.post("/", {
    onRequest: [(app as any).authenticate, requirePermission("changeRole")],
  }, async (req, reply) => {
    const { org_id } = getUser(req);
    const { name, description = "" } = req.body as { name: string; description?: string };

    if (!name || !name.trim()) {
      return reply.status(400).send({ detail: "Group name is required" });
    }

    const [dup] = await sql`
      SELECT group_id FROM groups
      WHERE LOWER(name) = LOWER(${name.trim()}) AND org_id = ${org_id}
    `;
    if (dup) {
      return reply.status(409).send({ detail: "A group with this name already exists" });
    }

    const groupId = genId("grp");
    const [group] = await sql`
      INSERT INTO groups (group_id, org_id, name, description, permissions)
      VALUES (${groupId}, ${org_id}, ${name.trim()}, ${description.trim()}, '{}'::jsonb)
      RETURNING group_id, org_id, name, description, permissions, created_at
    `;

    return { message: "Group created successfully", group };
  });

  // PATCH /api/groups/:id — edit group details & permissions
  app.patch("/:id", {
    onRequest: [(app as any).authenticate, requirePermission("changeRole")],
  }, async (req, reply) => {
    const { org_id } = getUser(req);
    const { id } = req.params as { id: string };
    const { name, description, permissions } = req.body as { name?: string; description?: string; permissions?: any };

    // Check if group exists
    const [existing] = await sql`SELECT group_id FROM groups WHERE group_id = ${id} AND org_id = ${org_id}`;
    if (!existing) return reply.status(404).send({ detail: "Group not found" });

    if (name !== undefined) {
      if (!name || !name.trim()) {
        return reply.status(400).send({ detail: "Group name cannot be empty" });
      }
      const [dup] = await sql`
        SELECT group_id FROM groups
        WHERE LOWER(name) = LOWER(${name.trim()}) AND org_id = ${org_id} AND group_id != ${id}
      `;
      if (dup) {
        return reply.status(409).send({ detail: "A group with this name already exists" });
      }
    }

    // Validate permissions if provided
    if (permissions !== undefined) {
      if (!permissions || typeof permissions !== "object" || Array.isArray(permissions)) {
        return reply.status(400).send({ detail: "Permissions must be a JSON object" });
      }

      const validCategoryIds = Array.from(new Set(Object.values(PERMISSION_IDS).map(p => p.categoryId)));
      const validPermIds = Object.values(PERMISSION_IDS).map(p => p.id);

      for (const [catId, arr] of Object.entries(permissions)) {
        if (!validCategoryIds.includes(catId)) {
          return reply.status(400).send({ detail: `Invalid permission category: ${catId}` });
        }
        if (!Array.isArray(arr)) {
          return reply.status(400).send({ detail: `Permission category ${catId} must map to an array` });
        }
        for (const item of arr) {
          if (!item || typeof item !== "object" || Array.isArray(item)) {
            return reply.status(400).send({ detail: `Permission item in ${catId} must be an object` });
          }
          if (typeof item.id !== "string" || !validPermIds.includes(item.id)) {
            return reply.status(400).send({ detail: `Permission item in ${catId} has invalid or missing id` });
          }
          if (typeof item.value !== "boolean") {
            return reply.status(400).send({ detail: `Permission value for ${item.id} must be a boolean` });
          }
          if (item.resources !== undefined) {
            if (!Array.isArray(item.resources)) {
              return reply.status(400).send({ detail: `Resources override for ${item.id} must be an array` });
            }
            for (const res of item.resources) {
              if (!res || typeof res !== "object" || Array.isArray(res)) {
                return reply.status(400).send({ detail: `Resource override item for ${item.id} must be an object` });
              }
              if (typeof res.id !== "string" || !res.id) {
                return reply.status(400).send({ detail: `Resource override for ${item.id} has invalid id` });
              }
              if (typeof res.value !== "boolean") {
                return reply.status(400).send({ detail: `Resource override value for ${item.id} -> ${res.id} must be a boolean` });
              }
            }
          }
        }
      }
    }

    // Perform updates
    const updates: Record<string, any> = {};
    if (name !== undefined && name.trim()) updates.name = name.trim();
    if (description !== undefined) updates.description = description.trim();
    if (permissions !== undefined) updates.permissions = sql.json(permissions);

    if (Object.keys(updates).length === 0) {
      return reply.status(400).send({ detail: "No updates provided" });
    }

    const [updated] = await sql`
      UPDATE groups
      SET ${sql(updates)}
      WHERE group_id = ${id} AND org_id = ${org_id}
      RETURNING group_id, org_id, name, description, permissions, created_at
    `;

    return { message: "Group updated successfully", group: updated };
  });

  // DELETE /api/groups/:id — delete group
  app.delete("/:id", {
    onRequest: [(app as any).authenticate, requirePermission("changeRole")],
  }, async (req, reply) => {
    const { org_id } = getUser(req);
    const { id } = req.params as { id: string };

    const [deleted] = await sql`
      DELETE FROM groups
      WHERE group_id = ${id} AND org_id = ${org_id}
      RETURNING group_id
    `;
    if (!deleted) return reply.status(404).send({ detail: "Group not found" });

    return { message: "Group deleted successfully" };
  });

  // POST /api/groups/:id/members — bulk set group members
  app.post("/:id/members", {
    onRequest: [(app as any).authenticate, requirePermission("changeRole")],
  }, async (req, reply) => {
    const { org_id } = getUser(req);
    const { id } = req.params as { id: string };
    const { user_ids } = req.body as { user_ids: string[] };

    if (!user_ids || !Array.isArray(user_ids)) {
      return reply.status(400).send({ detail: "user_ids array is required" });
    }

    // Check if group exists
    const [group] = await sql`SELECT group_id FROM groups WHERE group_id = ${id} AND org_id = ${org_id}`;
    if (!group) return reply.status(404).send({ detail: "Group not found" });

    // Filter valid user_ids belonging to organization
    const validUsers = await sql`
      SELECT user_id FROM users
      WHERE org_id = ${org_id} AND user_id = ANY(${user_ids}) AND is_active = true
    `;
    const filteredUserIds = validUsers.map((u: any) => u.user_id);

    // Sync memberships in transaction
    await sql.begin(async (tx: any) => {
      // Clear existing members
      await tx`
        DELETE FROM group_members
        WHERE group_id = ${id}
      `;

      // Insert new memberships
      if (filteredUserIds.length > 0) {
        const rows = filteredUserIds.map((userId: string) => ({
          group_id: id,
          user_id: userId
        }));
        await tx`
          INSERT INTO group_members ${sql(rows)}
        `;
      }
    });

    return { message: "Group memberships updated successfully", member_count: filteredUserIds.length };
  });

  // DELETE /api/groups/:id/members/:userId — remove specific member from group
  app.delete("/:id/members/:userId", {
    onRequest: [(app as any).authenticate, requirePermission("changeRole")],
  }, async (req, reply) => {
    const { org_id } = getUser(req);
    const { id, userId } = req.params as { id: string; userId: string };

    // Check if group exists
    const [group] = await sql`SELECT group_id FROM groups WHERE group_id = ${id} AND org_id = ${org_id}`;
    if (!group) return reply.status(404).send({ detail: "Group not found" });

    const [deleted] = await sql`
      DELETE FROM group_members
      WHERE group_id = ${id} AND user_id = ${userId}
      RETURNING group_id
    `;
    if (!deleted) return reply.status(404).send({ detail: "Member not found in this group" });

    return { message: "Member removed from group successfully" };
  });
}
