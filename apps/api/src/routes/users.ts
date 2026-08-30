import { FastifyInstance } from "fastify";
import { genId } from "../utils/id.js";
import bcrypt from "bcryptjs";
import sql from "../db/sql.js";
import { getUser, requireRole, requirePermission, CAN, PERMISSION_IDS, mergePermissions } from "../middleware/rbac.js";
import { sendEmail } from "../services/email.js";
import { logActivity } from "../services/activity.js";

export default async function userRoutes(app: FastifyInstance) {

  // GET /api/users — list org members (authenticated org users)
  app.get("/", {
    onRequest: [(app as any).authenticate],
  }, async (req) => {
    const { org_id } = getUser(req);
    const users = await sql`
      SELECT user_id, email, full_name, role, permissions, is_active, created_at, last_login_at
      FROM users
      WHERE org_id = ${org_id} AND is_active = true
      ORDER BY lower(coalesce(nullif(full_name, ''), email)) ASC
    `;

    // Fetch group memberships for all users in the organization
    const memberships = await sql`
      SELECT gm.user_id, g.group_id, g.name, g.permissions
      FROM group_members gm
      JOIN groups g ON gm.group_id = g.group_id
      WHERE g.org_id = ${org_id}
    `;

    const userList = users.map((u: any) => {
      const userGroups = memberships.filter((m: any) => m.user_id === u.user_id);
      const effectivePerms = mergePermissions(u.permissions, userGroups.map((g: any) => g.permissions));
      return {
        ...u,
        groups: userGroups.map((g: any) => ({ group_id: g.group_id, name: g.name })),
        effective_permissions: effectivePerms
      };
    });

    return { users: userList };
  });

  // POST /api/users/create — admin only (direct user creation)
  app.post("/create", {
    onRequest: [(app as any).authenticate, requirePermission("inviteUser")],
  }, async (req, reply) => {
    const { org_id } = getUser(req);
    const { email, password, full_name, role = "member", send_welcome_email } = req.body as {
      email: string;
      password: string;
      full_name?: string;
      role: string;
      send_welcome_email?: boolean;
    };

    if (!email || !password) return reply.status(400).send({ detail: "Email and password are required" });
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return reply.status(400).send({ detail: "Invalid email format" });
    if (password.length < 8) return reply.status(400).send({ detail: "Password must be at least 8 characters" });
    if (!["viewer", "member", "admin"].includes(role)) return reply.status(400).send({ detail: "Invalid role" });

    // Check if user already exists in this organization
    const [existing] = await sql`SELECT user_id, is_active FROM users WHERE email = ${email} AND org_id = ${org_id}`;
    if (existing) {
      if (existing.is_active) {
        return reply.status(409).send({ detail: "User already exists in this organization" });
      } else {
        const hashed = await bcrypt.hash(password, 12);
        await sql.begin(async (tx: any) => {
          await tx`
            UPDATE users
            SET is_active = true, hashed_password = ${hashed}, role = ${role}, full_name = ${full_name || ""}
            WHERE user_id = ${existing.user_id}
          `;
          await tx`
            INSERT INTO user_organizations (user_id, org_id, role)
            VALUES (${existing.user_id}, ${org_id}, ${role})
            ON CONFLICT (user_id, org_id) DO UPDATE SET role = ${role}
          `;
        });

        let preview_url: string | null = null;
        if (send_welcome_email) {
          const emailPreview = await sendEmail(
            email,
            "Welcome to Srevox!",
            `Hello ${full_name || email},\n\nYou have been invited to Srevox.\nYour login email: ${email}\nYour temporary password: ${password}\n\nPlease login and change your password.`
          );
          if (typeof emailPreview === "string") preview_url = emailPreview;
        }

        return { message: "User reactivated successfully", user_id: existing.user_id, email, role, preview_url };
      }
    }

    const userId = genId("usr");
    const hashed = await bcrypt.hash(password, 12);

    await sql.begin(async (tx: any) => {
      await tx`
        INSERT INTO users (user_id, org_id, email, hashed_password, full_name, role)
        VALUES (${userId}, ${org_id}, ${email}, ${hashed}, ${full_name || ""}, ${role})
      `;
      await tx`
        INSERT INTO user_organizations (user_id, org_id, role)
        VALUES (${userId}, ${org_id}, ${role})
      `;
    });

    let preview_url: string | null = null;
    if (send_welcome_email) {
      const emailPreview = await sendEmail(
        email,
        "Welcome to Srevox!",
        `Hello ${full_name || email},\n\nYou have been invited to Srevox.\nYour login email: ${email}\nYour temporary password: ${password}\n\nPlease login and change your password.`
      );
      if (typeof emailPreview === "string") preview_url = emailPreview;
    }

    return { message: "User created successfully", user_id: userId, email, role, preview_url };
  });

  // POST /api/users/bulk-create — admin only (bulk user creation)
  app.post("/bulk-create", {
    onRequest: [(app as any).authenticate, requirePermission("inviteUser")],
  }, async (req, reply) => {
    const { org_id } = getUser(req);
    const { users, default_password, default_role = "member", send_welcome_email } = req.body as {
      users: { email: string; full_name?: string }[];
      default_password?: string;
      default_role: string;
      send_welcome_email?: boolean;
    };

    if (!users || !Array.isArray(users)) {
      return reply.status(400).send({ detail: "Users array is required" });
    }
    if (!default_password || default_password.length < 8) {
      return reply.status(400).send({ detail: "Default password must be at least 8 characters" });
    }
    if (!["viewer", "member", "admin"].includes(default_role)) {
      return reply.status(400).send({ detail: "Invalid default role" });
    }

    const results = [];
    const hashed = await bcrypt.hash(default_password, 12);

    for (const u of users) {
      const email = u.email?.trim();
      const full_name = u.full_name?.trim() || "";

      if (!email) {
        results.push({ email: "", status: "error", detail: "Email is required" });
        continue;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        results.push({ email, status: "error", detail: "Invalid email format" });
        continue;
      }

      try {
        const [existing] = await sql`SELECT user_id, is_active FROM users WHERE email = ${email} AND org_id = ${org_id}`;
        if (existing) {
          if (existing.is_active) {
            results.push({ email, status: "skipped", detail: "User already in organization" });
          } else {
            await sql.begin(async (tx: any) => {
              await tx`
                UPDATE users
                SET is_active = true, hashed_password = ${hashed}, role = ${default_role}, full_name = ${full_name}
                WHERE user_id = ${existing.user_id}
              `;
              await tx`
                INSERT INTO user_organizations (user_id, org_id, role)
                VALUES (${existing.user_id}, ${org_id}, ${default_role})
                ON CONFLICT (user_id, org_id) DO UPDATE SET role = ${default_role}
              `;
            });

            if (send_welcome_email) {
              await sendEmail(
                email,
                "Welcome to Srevox!",
                `Hello ${full_name || email},\n\nYou have been invited to Srevox.\nYour login email: ${email}\nYour temporary password: ${default_password}\n\nPlease login and change your password.`
              ).catch(console.error);
            }
            results.push({ email, status: "created" });
          }
        } else {
          const userId = genId("usr");
          await sql.begin(async (tx: any) => {
            await tx`
              INSERT INTO users (user_id, org_id, email, hashed_password, full_name, role)
              VALUES (${userId}, ${org_id}, ${email}, ${hashed}, ${full_name}, ${default_role})
            `;
            await tx`
              INSERT INTO user_organizations (user_id, org_id, role)
              VALUES (${userId}, ${org_id}, ${default_role})
            `;
          });

          if (send_welcome_email) {
            await sendEmail(
              email,
              "Welcome to Srevox!",
              `Hello ${full_name || email},\n\nYou have been invited to Srevox.\nYour login email: ${email}\nYour temporary password: ${default_password}\n\nPlease login and change your password.`
            ).catch(console.error);
          }
          results.push({ email, status: "created" });
        }
      } catch (err: any) {
        results.push({ email, status: "error", detail: err.message || "Failed to process user" });
      }
    }

    return { results };
  });

  // POST /api/users/invite — admin only
  app.post("/invite", {
    onRequest: [(app as any).authenticate, requirePermission("inviteUser")],
  }, async (req, reply) => {
    const { org_id, sub } = getUser(req);
    const { email, role = "member" } = req.body as { email: string; role: string };

    if (!email) return reply.status(400).send({ detail: "Email is required" });
    if (!["viewer", "member", "admin"].includes(role))
      return reply.status(400).send({ detail: "Invalid role" });

    // Check if user already exists and is active in org
    const [existing] = await sql`
      SELECT user_id, is_active FROM users WHERE email = ${email} AND org_id = ${org_id}
    `;
    if (existing && existing.is_active) return reply.status(409).send({ detail: "User already in your organization" });

    // Check if invitation already pending
    const [pendingInvite] = await sql`
      SELECT invite_id FROM invitations
      WHERE email = ${email} AND org_id = ${org_id} AND accepted = false
        AND expires_at > now()
    `;
    if (pendingInvite) return reply.status(409).send({ detail: "Invitation already sent" });

    const inviteId = genId("inv");
    const [invite] = await sql`
      INSERT INTO invitations (invite_id, org_id, email, role, invited_by)
      VALUES (${inviteId}, ${org_id}, ${email}, ${role}, ${sub})
      RETURNING invite_id, email, role, token, expires_at
    `;

    // In production, send email with invite link
    // For now return the token so admin can share it
    const inviteUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/accept-invite?token=${invite.token}`;

    const emailPreview = await sendEmail(
      invite.email,
      "You've been invited to join Srevox",
      `Hello!\n\nYou've been invited to join an organization on Srevox as a ${invite.role}.\n\nClick the link below to accept your invitation:\n${inviteUrl}\n\nThis link will expire soon.`
    );

    return {
      message: "Invitation created",
      invite_url: inviteUrl,
      email: invite.email,
      role:  invite.role,
      expires_at: invite.expires_at,
      preview_url: typeof emailPreview === "string" ? emailPreview : null,
    };
  });

  // GET /api/users/invitations — list pending invitations (admin only)
  app.get("/invitations", {
    onRequest: [(app as any).authenticate, requirePermission("inviteUser")],
  }, async (req) => {
    const { org_id } = getUser(req);
    const invitations = await sql`
      SELECT i.invite_id, i.email, i.role, i.accepted, i.expires_at, i.created_at,
             u.full_name as invited_by_name
      FROM invitations i
      LEFT JOIN users u ON i.invited_by = u.user_id
      WHERE i.org_id = ${org_id}
      ORDER BY i.created_at DESC
    `;
    return { invitations };
  });

  // DELETE /api/users/invitations/:id — cancel invitation (admin only)
  app.delete("/invitations/:id", {
    onRequest: [(app as any).authenticate, requirePermission("inviteUser")],
  }, async (req) => {
    const { org_id } = getUser(req);
    const { id } = req.params as { id: string };
    await sql`DELETE FROM invitations WHERE invite_id = ${id} AND org_id = ${org_id}`;
    return { message: "Invitation cancelled" };
  });

  // POST /api/users/accept-invite — accept invitation (public)
  app.post("/accept-invite", async (req, reply) => {
    const { token, password, full_name } = req.body as {
      token: string;
      password: string;
      full_name?: string;
    };

    const [invite] = await sql`
      SELECT * FROM invitations
      WHERE token = ${token} AND accepted = false AND expires_at > now()
    `;
    if (!invite) return reply.status(400).send({ detail: "Invalid or expired invitation" });

    // Check if email already registered in this organization
    const [existingUser] = await sql`SELECT user_id, is_active FROM users WHERE email = ${invite.email} AND org_id = ${invite.org_id}`;
    if (existingUser && existingUser.is_active) {
      return reply.status(409).send({ detail: "Email already registered in this organization" });
    }

    if (!password || password.length < 8)
      return reply.status(400).send({ detail: "Password must be at least 8 characters" });

    const hashed = await bcrypt.hash(password, 12);
    const userId = existingUser ? existingUser.user_id : genId("usr");

    await sql.begin(async (tx: any) => {
      if (existingUser) {
        await tx`
          UPDATE users
          SET is_active = true, hashed_password = ${hashed}, full_name = ${full_name || ""}, role = ${invite.role}
          WHERE user_id = ${userId}
        `;
        await tx`
          INSERT INTO user_organizations (user_id, org_id, role)
          VALUES (${userId}, ${invite.org_id}, ${invite.role})
          ON CONFLICT (user_id, org_id) DO UPDATE SET role = ${invite.role}
        `;
      } else {
        await tx`
          INSERT INTO users (user_id, org_id, email, hashed_password, full_name, role)
          VALUES (${userId}, ${invite.org_id}, ${invite.email}, ${hashed}, ${full_name || ""}, ${invite.role})
        `;
        await tx`
          INSERT INTO user_organizations (user_id, org_id, role)
          VALUES (${userId}, ${invite.org_id}, ${invite.role})
        `;
      }
      await tx`
        UPDATE invitations SET accepted = true WHERE invite_id = ${invite.invite_id}
      `;
    });

    // Auto login
    const jwtToken = await (reply as any).jwtSign(
      { sub: userId, org_id: invite.org_id, role: invite.role, email: invite.email },
      { expiresIn: "24h" }
    );

    return {
      access_token: jwtToken,
      token_type: "bearer",
      user: { user_id: userId, email: invite.email, full_name: full_name || "", role: invite.role },
    };
  });

  // PATCH /api/users/:id/role — change role (admin only, cannot change own role)
app.patch("/:id/role", {
  onRequest: [(app as any).authenticate, requirePermission("changeRole")],
}, async (req, reply) => {
  const { org_id, sub } = getUser(req);
  const { id } = req.params as { id: string };
  const { role } = req.body as { role: string };

  if (id === sub) return reply.status(400).send({ detail: "Cannot change your own role" });
  if (!["viewer", "member", "admin"].includes(role))
    return reply.status(400).send({ detail: "Invalid role" });

  const [updated] = await sql`
    UPDATE users SET role = ${role}
    WHERE user_id = ${id} AND org_id = ${org_id}
    RETURNING user_id, email, full_name, role, org_id
  `;
  if (!updated) return reply.status(404).send({ detail: "User not found" });

  await sql`
    UPDATE user_organizations SET role = ${role}
    WHERE user_id = ${id} AND org_id = ${org_id}
  `;

  return { message: "Role updated", user: updated };
});

  // PATCH /api/users/:id/email — change other user's email (admin only, cannot change own email from here)
  app.patch("/:id/email", {
    onRequest: [(app as any).authenticate, requirePermission("changeRole")],
  }, async (req, reply) => {
    const { org_id, sub } = getUser(req);
    const { id } = req.params as { id: string };
    const { email } = req.body as { email: string };

    if (id === sub) return reply.status(400).send({ detail: "Use profile settings to change your own email" });
    
    const cleanEmail = email?.trim().toLowerCase();
    if (!cleanEmail) return reply.status(400).send({ detail: "Email cannot be empty" });

    const [user] = await sql`SELECT email FROM users WHERE user_id = ${id} AND org_id = ${org_id}`;
    if (!user) return reply.status(404).send({ detail: "User not found" });

    if (user.email !== cleanEmail) {
      const [existing] = await sql`SELECT user_id FROM users WHERE email = ${cleanEmail}`;
      if (existing) return reply.status(400).send({ detail: "Email is already in use by another account" });

      await sql`UPDATE users SET email = ${cleanEmail} WHERE user_id = ${id} AND org_id = ${org_id}`;
      
      await logActivity({
        org_id,
        user_id: sub,
        action: "email_change",
        resource: "user",
        resource_id: id,
        metadata: { old: user.email, new: cleanEmail }
      });
    }

    return { message: "Email updated" };
  });

  // PATCH /api/users/:id/permissions — change permissions (admin only, cannot change own permissions)
  app.patch("/:id/permissions", {
    onRequest: [(app as any).authenticate, requirePermission("changeRole")],
  }, async (req, reply) => {
    const { org_id, sub } = getUser(req);
    const { id } = req.params as { id: string };
    const { permissions } = req.body as { permissions: any };

    if (id === sub) return reply.status(400).send({ detail: "Cannot change your own permissions" });
    if (!permissions || typeof permissions !== "object" || Array.isArray(permissions)) {
      return reply.status(400).send({ detail: "Permissions must be a JSON object mapping category IDs to permission arrays" });
    }

    // Extract valid category IDs and permission IDs from mapping
    const validCategoryIds = Array.from(new Set(Object.values(PERMISSION_IDS).map(p => p.categoryId)));
    const validPermIds = Object.values(PERMISSION_IDS).map(p => p.id);

    for (const [catId, arr] of Object.entries(permissions)) {
      if (!validCategoryIds.includes(catId)) {
        return reply.status(400).send({ detail: `Invalid permission category: ${catId}` });
      }
      if (!Array.isArray(arr)) {
        return reply.status(400).send({ detail: `Permission category ${catId} must map to an array of permission items` });
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

    const [updated] = await sql`
      UPDATE users SET permissions = ${sql.json(permissions as any)}
      WHERE user_id = ${id} AND org_id = ${org_id}
      RETURNING user_id, email, full_name, role, permissions, org_id
    `;
    if (!updated) return reply.status(404).send({ detail: "User not found" });

    return { message: "Permissions updated", user: updated };
  });

  // DELETE /api/users/:id — remove from org (admin only, cannot remove self)
  app.delete("/:id", {
    onRequest: [(app as any).authenticate, requirePermission("removeUser")],
  }, async (req, reply) => {
    const { org_id, sub } = getUser(req);
    const { id } = req.params as { id: string };

    if (id === sub) return reply.status(400).send({ detail: "Cannot remove yourself" });

    await sql.begin(async (tx: any) => {
      await tx`
        UPDATE users SET is_active = false
        WHERE user_id = ${id} AND org_id = ${org_id}
      `;
      await tx`
        DELETE FROM user_organizations
        WHERE user_id = ${id} AND org_id = ${org_id}
      `;
    });
    return { message: "User removed from organization" };
  });

  // POST /api/users/:id/reset-password — admin only
  app.post("/:id/reset-password", {
    onRequest: [(app as any).authenticate, requirePermission("changeRole")],
  }, async (req, reply) => {
    const { org_id } = getUser(req);
    const { id } = req.params as { id: string };
    const { password, send_email = true } = req.body as { password?: string; send_email?: boolean };

    let finalPassword = password;
    if (!finalPassword) {
      const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%";
      finalPassword = Array.from({ length: 14 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    } else if (finalPassword.length < 8) {
      return reply.status(400).send({ detail: "Password must be at least 8 characters" });
    }

    const hashed = await bcrypt.hash(finalPassword, 12);

    const [user] = await sql`
      UPDATE users SET hashed_password = ${hashed}
      WHERE user_id = ${id} AND org_id = ${org_id}
      RETURNING email
    `;

    if (!user) return reply.status(404).send({ detail: "User not found" });

    let emailPreview = null;
    if (send_email) {
      emailPreview = await sendEmail(
        user.email,
        "Your Srevox Password Has Been Reset",
        `Hello,\n\nAn administrator has reset your password.\nYour new password is: ${finalPassword}\n\nPlease login and change your password immediately.`
      );
    }

    return { message: "Password reset", new_password: finalPassword, email: user.email, preview_url: typeof emailPreview === "string" ? emailPreview : null };
  });
}