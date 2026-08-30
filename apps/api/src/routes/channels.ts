import { FastifyInstance } from "fastify";
import { genId } from "../utils/id.js";
import sql from "../db/sql.js";
import { encrypt, decrypt } from "../services/crypto.js";
import { getUser, requirePermission } from "../middleware/rbac.js";
import axios from "axios";

export default async function channelRoutes(app: FastifyInstance) {

  // GET /api/channels — all roles
  app.get("/", { onRequest: [(app as any).authenticate] }, async (req, reply) => {
    try {
      const { org_id } = getUser(req);

      // Ensure service_owner_settings table exists
      await sql`
        CREATE TABLE IF NOT EXISTS service_owner_settings (
          org_id VARCHAR(64) PRIMARY KEY,
          default_alert_source_channel_id VARCHAR(64),
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `;

      const channels = await sql`
        SELECT 
          ch.channel_id, ch.name, ch.type, ch.enabled, ch.last_success_at, ch.last_error, ch.created_at,
          ch.channel_type, ch.is_global_default,
          (SELECT COUNT(*)::int FROM service_owners so
           WHERE (
             so.alert_source_channel_id = ch.channel_id 
             OR (so.channel_ids IS NOT NULL AND jsonb_typeof(so.channel_ids::jsonb) = 'array' AND so.channel_ids::jsonb @> jsonb_build_array(ch.channel_id))
             OR (
               so.alert_source_channel_id IS NULL
               AND (
                 so.user_id IS NOT NULL 
                 OR (so.user_ids IS NOT NULL AND jsonb_typeof(so.user_ids) = 'array' AND jsonb_array_length(so.user_ids) > 0)
                 OR (so.group_ids IS NOT NULL AND jsonb_typeof(so.group_ids) = 'array' AND jsonb_array_length(so.group_ids) > 0)
               )
               AND ch.channel_id = COALESCE(
                 (SELECT channel_id FROM channels WHERE org_id = ch.org_id AND channel_type = 'service_owner' AND is_global_default = true LIMIT 1),
                 (SELECT default_alert_source_channel_id FROM service_owner_settings WHERE org_id = ch.org_id)
               )
             )
           ) AND so.org_id = ch.org_id
          ) AS service_count
        FROM channels ch
        WHERE ch.org_id = ${org_id}
        ORDER BY ch.created_at DESC
      `;
      return { channels };
    } catch (err: any) {
      req.log.error(err, "GET /api/channels error");
      reply.status(500);
      return { success: false, error: err.message || "Failed to fetch channels" };
    }
  });

  // GET /api/channels/:id/usage — admin only
  app.get("/:id/usage", {
    onRequest: [(app as any).authenticate, requirePermission("viewChannels")],
  }, async (req, reply) => {
    try {
      const { org_id } = getUser(req);
      const { id } = req.params as { id: string };
      const [row] = await sql`
        SELECT COUNT(*)::int as count 
        FROM service_owners so
        WHERE (
          so.alert_source_channel_id = ${id} 
          OR (so.channel_ids IS NOT NULL AND jsonb_typeof(so.channel_ids::jsonb) = 'array' AND so.channel_ids::jsonb @> jsonb_build_array(${id}))
          OR (
            so.alert_source_channel_id IS NULL 
            AND (
              so.user_id IS NOT NULL 
              OR (so.user_ids IS NOT NULL AND jsonb_typeof(so.user_ids) = 'array' AND jsonb_array_length(so.user_ids) > 0)
              OR (so.group_ids IS NOT NULL AND jsonb_typeof(so.group_ids) = 'array' AND jsonb_array_length(so.group_ids) > 0)
            )
            AND ${id} = COALESCE(
              (SELECT channel_id FROM channels WHERE org_id = ${org_id} AND channel_type = 'service_owner' AND is_global_default = true LIMIT 1),
              (SELECT default_alert_source_channel_id FROM service_owner_settings WHERE org_id = ${org_id})
            )
          )
        ) AND so.org_id = ${org_id}
      `;
      return { count: row?.count || 0 };
    } catch (err: any) {
      req.log.error(err, "GET /api/channels/:id/usage error");
      reply.status(500);
      return { count: 0, error: err.message };
    }
  });

  // GET /api/channels/:id — admin only
  app.get("/:id", {
    onRequest: [(app as any).authenticate, requirePermission("viewChannels")],
  }, async (req, reply) => {
    const { org_id } = getUser(req);
    const { id } = req.params as { id: string };
    const [channel] = await sql`
      SELECT channel_id, name, type, enabled, config_encrypted, channel_type, is_global_default, created_at
      FROM channels
      WHERE channel_id = ${id} AND org_id = ${org_id}
    `;
    if (!channel) return reply.status(404).send({ detail: "Not found" });

    let config: Record<string, string> = {};
    try { config = JSON.parse(decrypt(channel.config_encrypted)); } catch { config = {}; }

    return {
      channel_id: channel.channel_id,
      name: channel.name,
      type: channel.type,
      enabled: channel.enabled,
      channel_type: channel.channel_type,
      is_global_default: channel.is_global_default,
      config,
      created_at: channel.created_at
    };
  });

  // POST /api/channels — admin only
  app.post("/", {
    onRequest: [(app as any).authenticate, requirePermission("addChannel")],
  }, async (req, reply) => {
    const { org_id } = getUser(req);
    const { name, type, config, channel_type = "normal", is_global_default = false } = req.body as any;
    if (!name || !type || !config)
      return reply.status(400).send({ detail: "name, type and config required" });

    if (channel_type === "service_owner" && is_global_default) {
      // Clear global default flag on other channels of type service_owner in org
      await sql`UPDATE channels SET is_global_default = false WHERE org_id = ${org_id} AND channel_type = 'service_owner'`;
    }

    const id = genId("chn");
    await sql`
      INSERT INTO channels (channel_id, org_id, name, type, config_encrypted, channel_type, is_global_default)
      VALUES (${id}, ${org_id}, ${name}, ${type}, ${encrypt(JSON.stringify(config))}, ${channel_type}, ${is_global_default})
    `;
    return { channel_id: id, name, type, enabled: true, channel_type, is_global_default };
  });

  // PATCH /api/channels/:id/toggle — admin only
  app.patch("/:id/toggle", {
    onRequest: [(app as any).authenticate, requirePermission("testChannel")],
  }, async (req) => {
    const { org_id } = getUser(req);
    const { id } = req.params as { id: string };
    await sql`UPDATE channels SET enabled = NOT enabled WHERE channel_id = ${id} AND org_id = ${org_id}`;
    return { message: "Toggled" };
  });

  // PATCH /api/channels/:id — admin only
  app.patch("/:id", {
    onRequest: [(app as any).authenticate, requirePermission("addChannel")],
  }, async (req) => {
    const { org_id } = getUser(req);
    const { id } = req.params as { id: string };
    const { name, config, channel_type, is_global_default } = req.body as any;

    if (name) {
      await sql`UPDATE channels SET name = ${name} WHERE channel_id = ${id} AND org_id = ${org_id}`;
    }
    if (config) {
      await sql`UPDATE channels SET config_encrypted = ${encrypt(JSON.stringify(config))} WHERE channel_id = ${id} AND org_id = ${org_id}`;
    }
    if (channel_type !== undefined) {
      await sql`UPDATE channels SET channel_type = ${channel_type} WHERE channel_id = ${id} AND org_id = ${org_id}`;
    }
    if (is_global_default !== undefined) {
      if (is_global_default && (channel_type === "service_owner" || (!channel_type))) {
        await sql`UPDATE channels SET is_global_default = false WHERE org_id = ${org_id} AND channel_type = 'service_owner'`;
      }
      await sql`UPDATE channels SET is_global_default = ${is_global_default} WHERE channel_id = ${id} AND org_id = ${org_id}`;
    }

    return { message: "Updated" };
  });

  // POST /api/channels/:id/test — member+
  app.post("/:id/test", {
    onRequest: [(app as any).authenticate, requirePermission("testChannel")],
  }, async (req, reply) => {
    const { org_id } = getUser(req);
    const { id } = req.params as { id: string };
    const [channel] = await sql`SELECT * FROM channels WHERE channel_id = ${id} AND org_id = ${org_id}`;
    if (!channel) return reply.status(404).send({ detail: "Not found" });

    let config: Record<string, string> = {};
    try { config = JSON.parse(decrypt(channel.config_encrypted)); } catch { config = {}; }

    const { test_email } = (req.body || {}) as { test_email?: string };
    if (test_email) {
      config.to = test_email;
    }

    try {
      const res = await axios.post(
          `${process.env.ALERT_WORKER_URL || "http://localhost:3001"}/test`,
          { type: channel.type, config, test_message: { pod_name: "test-pod-srevox", namespace: "production", crash_reason: "OOMKilled", severity: "critical" } },
          { timeout: 15000 }
      );
      await sql`UPDATE channels SET last_success_at = now(), last_error = null WHERE channel_id = ${id}`;
      return { message: "Test sent", result: res.data };
    } catch (err: any) {
      const msg = err.response?.data?.error || err.response?.data?.detail || err.message;
      await sql`UPDATE channels SET last_error = ${msg} WHERE channel_id = ${id}`;
      return reply.status(502).send({ detail: `Test failed: ${msg}` });
    }
  });

  // DELETE /api/channels/:id — admin only
  app.delete("/:id", {
    onRequest: [(app as any).authenticate, requirePermission("deleteChannel")],
  }, async (req) => {
    const { org_id } = getUser(req);
    const { id } = req.params as { id: string };
    await sql`DELETE FROM channels WHERE channel_id = ${id} AND org_id = ${org_id}`;
    return { message: "Deleted" };
  });
}