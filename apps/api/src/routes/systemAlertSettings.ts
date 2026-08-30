import { FastifyInstance } from "fastify";
import sql from "../db/sql.js";
import { getUser, requirePermission } from "../middleware/rbac.js";

const parseArr = (v: unknown): string[] =>
  typeof v === "string" ? JSON.parse(v) : (Array.isArray(v) ? v : []);

export default async function systemAlertSettingsRoutes(app: FastifyInstance) {

  // GET /api/system-alert-settings
  app.get("/", { onRequest: [(app as any).authenticate] }, async (req) => {
    const { org_id } = getUser(req);

    const [settings] = await sql`
      SELECT enabled, enabled_events, channel_ids 
      FROM system_alert_settings
      WHERE org_id = ${org_id}
    `;

    if (!settings) {
      return {
        settings: {
          enabled: true,
          enabled_events: ["cluster_connected", "cluster_disconnected", "cluster_deleted", "cluster_error"],
          channel_ids: []
        }
      };
    }

    return {
      settings: {
        enabled: settings.enabled ?? true,
        enabled_events: parseArr(settings.enabled_events),
        channel_ids: parseArr(settings.channel_ids)
      }
    };
  });

  // PUT /api/system-alert-settings
  app.put("/", { 
    onRequest: [(app as any).authenticate, requirePermission("systemAlerts")]
  }, async (req) => {
    const { org_id } = getUser(req);
    const {
      enabled = true,
      enabled_events = ["cluster_connected", "cluster_disconnected", "cluster_deleted", "cluster_error"],
      channel_ids = []
    } = req.body as {
      enabled?: boolean;
      enabled_events?: string[];
      channel_ids?: string[];
    };

    await sql`
      INSERT INTO system_alert_settings (org_id, enabled, enabled_events, channel_ids, updated_at)
      VALUES (${org_id}, ${enabled}, ${JSON.stringify(enabled_events)}::jsonb, ${JSON.stringify(channel_ids)}::jsonb, now())
      ON CONFLICT (org_id) DO UPDATE SET
        enabled = EXCLUDED.enabled,
        enabled_events = EXCLUDED.enabled_events,
        channel_ids = EXCLUDED.channel_ids,
        updated_at = now()
    `;

    return { success: true, message: "System alert settings saved successfully" };
  });
}
