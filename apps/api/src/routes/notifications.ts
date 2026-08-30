import { FastifyInstance } from "fastify";
import sql from "../db/sql.js";
import { getUser } from "../middleware/rbac.js";

export default async function notificationRoutes(app: FastifyInstance) {

  // GET /api/notifications — list active user notifications
  app.get("/", { onRequest: [(app as any).authenticate] }, async (req) => {
    const { sub, org_id } = getUser(req);
    const notifications = await sql`
      SELECT 
        notification_id as id,
        incident_id,
        cluster_id,
        title,
        sub,
        severity,
        type,
        is_read as read,
        created_at as time
      FROM user_notifications
      WHERE user_id = ${sub} AND org_id = ${org_id} AND is_dismissed = false
      ORDER BY created_at DESC
      LIMIT 30
    `;
    return { notifications };
  });

  // POST /api/notifications/:id/read — mark single read
  app.post("/:id/read", { onRequest: [(app as any).authenticate] }, async (req, reply) => {
    const { sub, org_id } = getUser(req);
    const { id } = req.params as { id: string };

    const [notif] = await sql`
      UPDATE user_notifications
      SET is_read = true
      WHERE notification_id = ${id} AND user_id = ${sub} AND org_id = ${org_id}
      RETURNING notification_id
    `;
    if (!notif) return reply.status(404).send({ detail: "Notification not found" });

    try {
      const redis = (await import("../db/redis.js")).default;
      await redis.publish(`srevox:notifications:${sub}`, JSON.stringify({ type: "notification" }));
    } catch {}

    return { success: true };
  });

  // POST /api/notifications/read-all — mark all read
  app.post("/read-all", { onRequest: [(app as any).authenticate] }, async (req) => {
    const { sub, org_id } = getUser(req);
    await sql`
      UPDATE user_notifications
      SET is_read = true
      WHERE user_id = ${sub} AND org_id = ${org_id} AND is_read = false
    `;

    try {
      const redis = (await import("../db/redis.js")).default;
      await redis.publish(`srevox:notifications:${sub}`, JSON.stringify({ type: "notification" }));
    } catch {}

    return { success: true };
  });

  // DELETE /api/notifications/:id — dismiss single notification
  app.delete("/:id", { onRequest: [(app as any).authenticate] }, async (req, reply) => {
    const { sub, org_id } = getUser(req);
    const { id } = req.params as { id: string };

    const [notif] = await sql`
      UPDATE user_notifications
      SET is_dismissed = true
      WHERE notification_id = ${id} AND user_id = ${sub} AND org_id = ${org_id}
      RETURNING notification_id
    `;
    if (!notif) return reply.status(404).send({ detail: "Notification not found" });

    try {
      const redis = (await import("../db/redis.js")).default;
      await redis.publish(`srevox:notifications:${sub}`, JSON.stringify({ type: "notification" }));
    } catch {}

    return { success: true };
  });

  // DELETE /api/notifications/clear-all — dismiss all notifications
  app.delete("/clear-all", { onRequest: [(app as any).authenticate] }, async (req) => {
    const { sub, org_id } = getUser(req);
    await sql`
      UPDATE user_notifications
      SET is_dismissed = true
      WHERE user_id = ${sub} AND org_id = ${org_id} AND is_dismissed = false
    `;

    try {
      const redis = (await import("../db/redis.js")).default;
      await redis.publish(`srevox:notifications:${sub}`, JSON.stringify({ type: "notification" }));
    } catch {}

    return { success: true };
  });

  // GET /api/notifications/mute-status — check muting preferences
  app.get("/mute-status", { onRequest: [(app as any).authenticate] }, async (req) => {
    const { sub } = getUser(req);
    const [pref] = await sql`
      SELECT notifications_muted, notifications_muted_until 
      FROM user_alert_preferences 
      WHERE user_id = ${sub}
    `;

    if (!pref) {
      return { muted: false, muted_until: null };
    }

    const now = new Date();
    const isMutedTimed = pref.notifications_muted_until && new Date(pref.notifications_muted_until) > now;
    const isMutedPerm = !!pref.notifications_muted;

    return {
      muted: isMutedTimed || isMutedPerm,
      muted_until: isMutedTimed ? pref.notifications_muted_until : null
    };
  });

  // POST /api/notifications/mute — set notifications muting
  app.post("/mute", { onRequest: [(app as any).authenticate] }, async (req, reply) => {
    const { sub, org_id } = getUser(req);
    const { minutes } = req.body as { minutes: number };

    if (minutes === undefined) {
      return reply.status(400).send({ detail: "minutes is required" });
    }

    let notifications_muted = false;
    let notifications_muted_until: Date | null = null;

    if (minutes === -1) {
      notifications_muted = true;
    } else if (minutes > 0) {
      notifications_muted_until = new Date(Date.now() + minutes * 60 * 1000);
    }

    await sql`
      INSERT INTO user_alert_preferences
        (user_id, org_id, notifications_muted, notifications_muted_until, updated_at)
      VALUES
        (${sub}, ${org_id}, ${notifications_muted}, ${notifications_muted_until}, now())
      ON CONFLICT (user_id) DO UPDATE SET
        notifications_muted = EXCLUDED.notifications_muted,
        notifications_muted_until = EXCLUDED.notifications_muted_until,
        updated_at = now()
    `;

    return {
      success: true,
      muted: true,
      muted_until: notifications_muted_until
    };
  });

  // POST /api/notifications/unmute — unmute notifications
  app.post("/unmute", { onRequest: [(app as any).authenticate] }, async (req) => {
    const { sub, org_id } = getUser(req);

    await sql`
      INSERT INTO user_alert_preferences
        (user_id, org_id, notifications_muted, notifications_muted_until, updated_at)
      VALUES
        (${sub}, ${org_id}, false, null, now())
      ON CONFLICT (user_id) DO UPDATE SET
        notifications_muted = false,
        notifications_muted_until = null,
        updated_at = now()
    `;

    return {
      success: true,
      muted: false,
      muted_until: null
    };
  });

  // GET /api/notifications/live — real-time notification push stream
  app.get("/live", async (req, reply) => {
    let sub: string;
    try {
      const { token } = req.query as { token?: string };
      if (!token) {
        return reply.status(401).send({ detail: "Unauthorized" });
      }
      const payload = app.jwt.verify(token) as any;
      sub = payload.sub;
    } catch (err) {
      return reply.status(401).send({ detail: "Unauthorized" });
    }

    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no"
    });

    reply.raw.write("retry: 5000\n\n");
    reply.raw.write(`data: ${JSON.stringify({ type: "connected" })}\n\n`);

    const pingInterval = setInterval(() => {
      reply.raw.write(":\n\n");
    }, 15000);

    const Redis = (await import("ioredis")).default;
    const subscriber = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
    const channel = `srevox:notifications:${sub}`;

    await subscriber.subscribe(channel);
    subscriber.on("message", (chan, message) => {
      if (chan === channel) {
        reply.raw.write(`data: ${message}\n\n`);
      }
    });

    req.raw.on("close", async () => {
      clearInterval(pingInterval);
      try {
        await subscriber.quit();
      } catch {
        // Safe swallow
      }
    });
  });
}
