import { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { genId } from "../utils/id.js";
import sql from "../db/sql.js";
import { setSession, deleteSession, invalidateCache } from "../db/redis.js";
import { encrypt } from "../services/crypto.js";
import { getUser, mergePermissions, requireRole } from "../middleware/rbac.js";
import { logActivity } from "../services/activity.js";

// Registration helper function removed

export default async function authRoutes(app: FastifyInstance) {

  // POST /api/auth/signup
  app.post("/signup", async (req, reply) => {
    return reply.status(403).send({ detail: "Registration is disabled on self-hosted instances." });
  });

  // POST /api/auth/login — login
  app.post("/login", async (req, reply) => {
    const { username, password } = req.body as {
      username: string;
      password: string;
    };

    const [user] = await sql`
      SELECT u.user_id, u.org_id, u.email, u.hashed_password, u.full_name, u.role, u.permissions
      FROM users u
      WHERE u.email = ${username} AND u.is_active = true
      ORDER BY u.last_login_at DESC NULLS LAST
      LIMIT 1
    `;

    if (!user || !(await bcrypt.compare(password, user.hashed_password))) {
      return reply.status(401).send({ detail: "Incorrect email or password" });
    }

    await sql`UPDATE users SET last_login_at = now() WHERE user_id = ${user.user_id}`;

    const token = await reply.jwtSign(
      { sub: user.user_id, org_id: user.org_id, role: user.role, email: user.email },
      { expiresIn: "24h" }
    );
    await setSession(token, { userId: user.user_id, orgId: user.org_id, role: user.role });

    const userGroups = await sql`
      SELECT g.group_id, g.name, g.permissions
      FROM groups g
      JOIN group_members gm ON g.group_id = gm.group_id
      WHERE gm.user_id = ${user.user_id} AND g.org_id = ${user.org_id}
    `;

    const effectivePerms = mergePermissions(user.permissions, userGroups.map((g: any) => g.permissions));

    const [org] = await sql`
      SELECT org_id, name, slug, default_alert_source_channel_id, default_alert_cc, default_alert_bcc 
      FROM organizations WHERE org_id = ${user.org_id}
    `;

    return {
      access_token: token,
      token_type: "bearer",
      user: {
        user_id: user.user_id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        org_id: user.org_id,
        permissions: user.permissions,
        groups: userGroups.map((g: any) => ({ group_id: g.group_id, name: g.name })),
        effective_permissions: effectivePerms,
        org
      },
    };
  });

  // POST /api/auth/logout
  app.post("/logout", { onRequest: [(app as any).authenticate] }, async (req) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (token) await deleteSession(token);
    return { message: "Logged out" };
  });

  // GET /api/auth/me & /api/auth/account
  app.get("/me", { onRequest: [(app as any).authenticate] }, async (req, reply) => {
    return getAccountHandler(req, reply);
  });

  app.get("/account", { onRequest: [(app as any).authenticate] }, async (req, reply) => {
    return getAccountHandler(req, reply);
  });

  async function getAccountHandler(req: any, reply: any) {
    const payload = req.user as { sub: string };
    const [user] = await sql`
      SELECT user_id, org_id, email, full_name, role, personal_channel_id,
             permissions, created_at, last_login_at
      FROM users WHERE user_id = ${payload.sub}
    `;
    if (!user) return reply.status(404).send({ detail: "User not found" });

    const userGroups = await sql`
      SELECT g.group_id, g.name, g.permissions
      FROM groups g
      JOIN group_members gm ON g.group_id = gm.group_id
      WHERE gm.user_id = ${user.user_id} AND g.org_id = ${user.org_id}
    `;

    const effectivePerms = mergePermissions(user.permissions, userGroups.map((g: any) => g.permissions));

    const [org] = await sql`
      SELECT org_id, name, slug
      FROM organizations WHERE org_id = ${user.org_id}
    `;

    return {
      ...user,
      full_name: user.full_name || "Admin User",
      org,
      groups: userGroups.map((g: any) => ({ group_id: g.group_id, name: g.name })),
      effective_permissions: effectivePerms
    };
  }

  // PATCH /api/auth/account — update profile + personal channel
  app.patch("/account", { onRequest: [(app as any).authenticate] }, async (req, reply) => {
    const payload = req.user as { sub: string; org_id: string; email: string };
    const { full_name, current_password, new_password, personal_channel, org_name, email } = req.body as {
      full_name?:         string;
      current_password?:  string;
      new_password?:      string;
      personal_channel?:  { type: string; config: Record<string, string>; name: string };
      org_name?:          string;
      email?:             string;
    };

    const [dbUser] = await sql`SELECT role, hashed_password FROM users WHERE user_id = ${payload.sub}`;
    if (!dbUser) return reply.status(404).send({ detail: "User not found" });

    if (new_password) {
      if (new_password.length < 8)
        return reply.status(400).send({ detail: "New password must be at least 8 characters" });

      if (!current_password || !(await bcrypt.compare(current_password, dbUser.hashed_password)))
        return reply.status(400).send({ detail: "Current password is incorrect" });

      const hashed = await bcrypt.hash(new_password, 12);
      await sql`UPDATE users SET hashed_password = ${hashed} WHERE email = ${payload.email}`;
    }

    if (full_name !== undefined) {
      await sql`UPDATE users SET full_name = ${full_name} WHERE email = ${payload.email}`;
    }

    if (email !== undefined) {
      if (dbUser.role !== "admin") {
        return reply.status(403).send({ detail: "Only administrators can change email addresses" });
      }
      const cleanEmail = email.trim().toLowerCase();
      if (!cleanEmail) {
        return reply.status(400).send({ detail: "Email cannot be empty" });
      }

      const [currentUser] = await sql`SELECT email FROM users WHERE user_id = ${payload.sub}`;
      if (currentUser && currentUser.email !== cleanEmail) {
        const [existing] = await sql`SELECT user_id FROM users WHERE email = ${cleanEmail} AND user_id != ${payload.sub}`;
        if (existing) {
          return reply.status(400).send({ detail: "Email is already in use by another user" });
        }

        const [{ count }] = await sql`
          SELECT count(*) FROM activity_log 
          WHERE user_id = ${payload.sub}
            AND action = 'email_change' 
            AND created_at > now() - interval '30 days'
        `;
        if (Number(count) >= 1) {
          return reply.status(400).send({ detail: "Email can only be changed once every 30 days" });
        }

        const oldEmail = currentUser.email;
        await sql`UPDATE users SET email = ${cleanEmail} WHERE email = ${oldEmail}`;
 
        await logActivity({
          org_id: payload.org_id,
          user_id: payload.sub,
          action: "email_change",
          resource: null,
          resource_id: null,
          metadata: { old: oldEmail, new: cleanEmail }
        });
      }
    }

    if (org_name !== undefined) {
      if (dbUser.role !== "admin") {
        return reply.status(403).send({ detail: "Only administrators can change the organization name" });
      }
      const [org] = await sql`SELECT name FROM organizations WHERE org_id = ${payload.org_id}`;
      if (org && org.name !== org_name) {
        const [{ count }] = await sql`
          SELECT count(*) FROM activity_log 
          WHERE org_id = ${payload.org_id} 
            AND action = 'org_name_change' 
            AND created_at > now() - interval '1 month'
        `;
        if (Number(count) >= 2) {
          return reply.status(429).send({ detail: "Organization name can only be changed 2 times per month" });
        }

        await sql`UPDATE organizations SET name = ${org_name} WHERE org_id = ${payload.org_id}`;
        
        await logActivity({
          org_id: payload.org_id,
          user_id: payload.sub,
          action: "org_name_change",
          resource: null,
          resource_id: null,
          metadata: { old: org.name, new: org_name }
        });
      }
    }



    // Save personal alert channel
    if (personal_channel) {
      const channelId = genId("chn");
      const configEncrypted = encrypt(JSON.stringify(personal_channel.config));

      // Delete old personal channel if exists
      const [existingUser] = await sql`SELECT personal_channel_id FROM users WHERE user_id = ${payload.sub}`;
      if (existingUser?.personal_channel_id) {
        await sql`DELETE FROM channels WHERE channel_id = ${existingUser.personal_channel_id}`;
      }

      await sql`
        INSERT INTO channels (channel_id, org_id, name, type, config_encrypted)
        VALUES (${channelId}, ${payload.org_id}, ${personal_channel.name}, ${personal_channel.type}, ${configEncrypted})
      `;
      await sql`
        UPDATE users SET personal_channel_id = ${channelId} WHERE user_id = ${payload.sub}
      `;
      return { message: "Profile and personal channel updated", personal_channel_id: channelId };
    }

    return { message: "Profile updated" };
  });

  // GET /api/auth/account/personal-channel
  app.get("/account/personal-channel", { onRequest: [(app as any).authenticate] }, async (req) => {
    const payload = req.user as { sub: string };
    const [user] = await sql`
      SELECT personal_channel_id FROM users WHERE user_id = ${payload.sub}
    `;

    if (!user?.personal_channel_id) return { channel: null };

    const [channel] = await sql`
      SELECT channel_id, name, type, enabled, last_success_at, last_error
      FROM channels WHERE channel_id = ${user.personal_channel_id}
    `;
    return { channel: channel || null };
  });

  // POST /api/auth/purge-data — delete organization data (admin only)
  app.post("/purge-data", {
    onRequest: [(app as any).authenticate, requireRole("admin")],
  }, async (req, reply) => {
    const payload = req.user as { sub: string; org_id: string };
    const { password, action } = req.body as { password?: string; action?: string };

    if (!password || !action) {
      return reply.status(400).send({ detail: "Password and action are required" });
    }

    // Verify password
    const [user] = await sql`
      SELECT hashed_password FROM users WHERE user_id = ${payload.sub}
    `;
    if (!user || !(await bcrypt.compare(password, user.hashed_password))) {
      return reply.status(401).send({ detail: "Incorrect password. Authorization failed." });
    }

    if (action === "events" || action === "incidents") {
      try { await sql`DELETE FROM db_audit_events WHERE org_id = ${payload.org_id} OR org_id IS NULL`; } catch {}
      try { await sql`DELETE FROM incidents WHERE org_id = ${payload.org_id}`; } catch {}
      await invalidateCache(`stats:${payload.org_id}`);
      return { message: "All audit mutation events deleted successfully" };
    } else if (action === "connectors" || action === "clusters") {
      try { await sql`DELETE FROM db_connectors WHERE org_id = ${payload.org_id} OR org_id IS NULL`; } catch {}
      try { await sql`DELETE FROM clusters WHERE org_id = ${payload.org_id}`; } catch {}
      await invalidateCache(`stats:${payload.org_id}`);
      return { message: "All database connectors deleted successfully" };
    } else if (action === "all") {
      await sql.begin(async (tx: any) => {
        try { await tx`DELETE FROM db_audit_events WHERE org_id = ${payload.org_id} OR org_id IS NULL`; } catch {}
        try { await tx`DELETE FROM db_connectors WHERE org_id = ${payload.org_id} OR org_id IS NULL`; } catch {}
        try { await tx`DELETE FROM retention_policies WHERE org_id = ${payload.org_id}`; } catch {}
        try { await tx`DELETE FROM alerts_sent WHERE org_id = ${payload.org_id}`; } catch {}
        try { await tx`DELETE FROM user_ai_diagnoses WHERE incident_id IN (SELECT incident_id FROM incidents WHERE org_id = ${payload.org_id})`; } catch {}
        try { await tx`DELETE FROM incidents WHERE org_id = ${payload.org_id}`; } catch {}
        try { await tx`DELETE FROM service_owners WHERE org_id = ${payload.org_id}`; } catch {}
        try { await tx`DELETE FROM resource_alerts WHERE org_id = ${payload.org_id}`; } catch {}
        try { await tx`DELETE FROM alert_rules WHERE org_id = ${payload.org_id}`; } catch {}
        try { await tx`DELETE FROM channels WHERE org_id = ${payload.org_id}`; } catch {}
        try { await tx`DELETE FROM invitations WHERE org_id = ${payload.org_id}`; } catch {}
        try { await tx`DELETE FROM clusters WHERE org_id = ${payload.org_id}`; } catch {}
        try { await tx`DELETE FROM activity_log WHERE org_id = ${payload.org_id}`; } catch {}
      });
      await invalidateCache(`stats:${payload.org_id}`);
      return { message: "All organization data reset successfully" };
    } else {
      return reply.status(400).send({ detail: "Invalid action. Must be 'events', 'connectors', or 'all'." });
    }
  });

  // POST /api/auth/switch-org
  app.post("/switch-org", {
    onRequest: [(app as any).authenticate]
  }, async (req, reply) => {
    const payload = req.user as { sub: string; email: string };
    const { org_id } = req.body as { org_id: string };

    if (!org_id) {
      return reply.status(400).send({ detail: "org_id is required" });
    }

    const [targetUser] = await sql`
      SELECT user_id, role FROM users 
      WHERE email = ${payload.email} AND org_id = ${org_id} AND is_active = true
    `;
    if (!targetUser) {
      return reply.status(403).send({ detail: "You do not belong to this organization" });
    }

    const token = await reply.jwtSign(
      { sub: targetUser.user_id, org_id, role: targetUser.role, email: payload.email },
      { expiresIn: "24h" }
    );
    await setSession(token, { userId: targetUser.user_id, orgId: org_id, role: targetUser.role });
    await sql`UPDATE users SET last_login_at = now() WHERE user_id = ${targetUser.user_id}`;

    // Get org info
    const [org] = await sql`
      SELECT org_id, name, slug FROM organizations WHERE org_id = ${org_id}
    `;

    return {
      access_token: token,
      token_type: "bearer",
      user: { user_id: targetUser.user_id, email: payload.email, role: targetUser.role, org_id, org }
    };
  });

  // POST /api/auth/verify-password
  app.post("/verify-password", {
    onRequest: [(app as any).authenticate]
  }, async (req, reply) => {
    const payload = req.user as { sub: string; org_id: string; role: string; email: string };
    const { password } = req.body as { password?: string };

    if (!password) {
      return reply.status(400).send({ detail: "Password is required" });
    }

    const [user] = await sql`SELECT hashed_password FROM users WHERE user_id = ${payload.sub}`;
    if (!user) {
      return reply.status(404).send({ detail: "User not found" });
    }

    const isMatch = await bcrypt.compare(password, user.hashed_password);
    if (!isMatch) {
      return reply.status(400).send({ detail: "Incorrect password" });
    }

    // Sign a short-lived sudo token (valid for 15 minutes)
    const sudoToken = await reply.jwtSign(
      { sub: payload.sub, org_id: payload.org_id, role: payload.role, email: payload.email, scope: "sudo" },
      { expiresIn: "15m" }
    );

    return { success: true, sudo_token: sudoToken };
  });

  // POST /api/auth/verify-sudo-password
  app.post("/verify-sudo-password", {
    onRequest: [(app as any).authenticate]
  }, async (req, reply) => {
    const payload = req.user as { sub: string; org_id: string; role: string; email: string };
    const { password } = req.body as { password?: string };

    if (!password) {
      return reply.status(400).send({ detail: "Password is required" });
    }

    const [org] = await sql`SELECT security_password FROM organizations WHERE org_id = ${payload.org_id}`;
    if (!org) {
      return reply.status(404).send({ detail: "Organization not found" });
    }

    const isMatch = password === org.security_password;
    if (!isMatch) {
      return reply.status(400).send({ detail: "Incorrect security password" });
    }

    const sudoToken = await reply.jwtSign(
      { sub: payload.sub, org_id: payload.org_id, role: payload.role, email: payload.email, scope: "sudo" },
      { expiresIn: "15m" }
    );

    return { success: true, sudo_token: sudoToken };
  });

  // POST /api/auth/update-sudo-password
  app.post("/update-sudo-password", {
    onRequest: [(app as any).authenticate]
  }, async (req, reply) => {
    const { org_id, role, sub } = getUser(req);
    if (role !== "admin") {
      return reply.status(403).send({ detail: "Forbidden: Admin role required" });
    }

    const { current_password, new_password } = req.body as {
      current_password?: string;
      new_password?: string;
    };

    if (!current_password || !new_password) {
      return reply.status(400).send({ detail: "Both current and new passwords are required" });
    }

    if (new_password.length < 6) {
      return reply.status(400).send({ detail: "Password must be at least 6 characters" });
    }

    const [org] = await sql`SELECT security_password FROM organizations WHERE org_id = ${org_id}`;
    if (!org) {
      return reply.status(404).send({ detail: "Organization not found" });
    }

    if (current_password !== org.security_password) {
      return reply.status(400).send({ detail: "Current security password is incorrect" });
    }

    await sql`
      UPDATE organizations
      SET security_password = ${new_password}
      WHERE org_id = ${org_id}
    `;

    await logActivity({
      org_id,
      user_id: sub,
      action: "update_security_password",
      resource: null,
      resource_id: null,
      metadata: {}
    });

    return { message: "Security password updated successfully" };
  });

  // POST /api/auth/reset-sudo-password — admin only
  app.post("/reset-sudo-password", {
    onRequest: [(app as any).authenticate]
  }, async (req, reply) => {
    const { org_id, role, sub } = getUser(req);
    if (role !== "admin") {
      return reply.status(403).send({ detail: "Forbidden: Admin role required" });
    }

    await sql`
      UPDATE organizations
      SET security_password = 'admin123'
      WHERE org_id = ${org_id}
    `;

    await logActivity({
      org_id,
      user_id: sub,
      action: "reset_security_password",
      resource: null,
      resource_id: null,
      metadata: { target_password: "admin123" }
    });

    return { message: "Security password reset to admin123 successfully" };
  });

}