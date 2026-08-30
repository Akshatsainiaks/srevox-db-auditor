import { FastifyInstance } from "fastify";
import sql from "../db/sql.js";
import { getUser } from "../middleware/rbac.js";

const parseArr = (v: unknown): string[] =>
  typeof v === "string" ? JSON.parse(v) : (Array.isArray(v) ? v : []);

export default async function preferencesRoutes(app: FastifyInstance) {

  // GET /api/preferences — get my preferences
  app.get("/", { onRequest: [(app as any).authenticate] }, async (req) => {
    const { sub, org_id } = getUser(req);

    const [pref] = await sql`
      SELECT * FROM user_alert_preferences
      WHERE user_id = ${sub}
    `;

    if (!pref) {
      // Return defaults
      return {
        preferences: {
          severities:           ["critical", "warning", "info"],
          crash_reasons:        [],
          namespaces:           [],
          quiet_hours_start:    null,
          quiet_hours_end:      null,
          notify_resolved:      false,
          notify_acknowledged:  false,
          enabled:              true,
          notifications_muted:  false,
          notifications_muted_until: null,
        },
      };
    }

    return {
      preferences: {
        ...pref,
        severities:    parseArr(pref.severities),
        crash_reasons: parseArr(pref.crash_reasons),
        namespaces:    parseArr(pref.namespaces),
        notifications_muted: pref.notifications_muted || false,
        notifications_muted_until: pref.notifications_muted_until || null,
      },
    };
  });

  // PUT /api/preferences — save my preferences (upsert)
  app.put("/", { onRequest: [(app as any).authenticate] }, async (req) => {
    const { sub, org_id } = getUser(req);
    const {
      severities          = ["critical", "warning", "info"],
      crash_reasons       = [],
      namespaces          = [],
      quiet_hours_start   = null,
      quiet_hours_end     = null,
      notify_resolved     = false,
      notify_acknowledged = false,
      enabled             = true,
      notifications_muted = false,
      notifications_muted_until = null,
    } = req.body as {
      severities?:          string[];
      crash_reasons?:       string[];
      namespaces?:          string[];
      quiet_hours_start?:   number | null;
      quiet_hours_end?:     number | null;
      notify_resolved?:     boolean;
      notify_acknowledged?: boolean;
      enabled?:             boolean;
      notifications_muted?: boolean;
      notifications_muted_until?: string | null;
    };

    await sql`
      INSERT INTO user_alert_preferences
        (user_id, org_id, severities, crash_reasons, namespaces,
         quiet_hours_start, quiet_hours_end,
         notify_resolved, notify_acknowledged, enabled, notifications_muted, notifications_muted_until, updated_at)
      VALUES
        (${sub}, ${org_id},
         ${JSON.stringify(severities)}, ${JSON.stringify(crash_reasons)},
         ${JSON.stringify(namespaces)},
         ${quiet_hours_start}, ${quiet_hours_end},
         ${notify_resolved}, ${notify_acknowledged}, ${enabled}, ${notifications_muted}, ${notifications_muted_until}, now())
      ON CONFLICT (user_id) DO UPDATE SET
        severities          = EXCLUDED.severities,
        crash_reasons       = EXCLUDED.crash_reasons,
        namespaces          = EXCLUDED.namespaces,
        quiet_hours_start   = EXCLUDED.quiet_hours_start,
        quiet_hours_end     = EXCLUDED.quiet_hours_end,
        notify_resolved     = EXCLUDED.notify_resolved,
        notify_acknowledged = EXCLUDED.notify_acknowledged,
        enabled             = EXCLUDED.enabled,
        notifications_muted = EXCLUDED.notifications_muted,
        notifications_muted_until = EXCLUDED.notifications_muted_until,
        updated_at          = now()
    `;

    return { message: "Preferences saved" };
  });

  // GET /api/preferences/all — admin: get all org members' preferences
  app.get("/all", { onRequest: [(app as any).authenticate] }, async (req) => {
    const { org_id } = getUser(req);

    const prefs = await sql`
      SELECT
        u.user_id, u.email, u.full_name, u.role,
        p.severities, p.crash_reasons, p.namespaces,
        p.quiet_hours_start, p.quiet_hours_end,
        p.notify_resolved, p.notify_acknowledged, p.enabled
      FROM users u
      LEFT JOIN user_alert_preferences p ON u.user_id = p.user_id
      WHERE u.org_id = ${org_id}
      ORDER BY u.created_at ASC
    `;

    return {
      preferences: prefs.map((p) => ({
        ...p,
        severities:    parseArr(p.severities    || '["critical","warning","info"]'),
        crash_reasons: parseArr(p.crash_reasons || '[]'),
        namespaces:    parseArr(p.namespaces    || '[]'),
      })),
    };
  });
}