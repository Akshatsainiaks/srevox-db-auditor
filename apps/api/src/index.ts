import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import formbody from "@fastify/formbody";
import "dotenv/config";
import { readFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";

import authRoutes from "./routes/auth.js";
import channelRoutes from "./routes/channels.js";
import alertRuleRoutes from "./routes/alertRules.js";
import userRoutes from "./routes/users.js";
import serviceOwnerRoutes from "./routes/serviceOwners.js";
import preferencesRoutes from "./routes/preferences.js";
import retentionRoutes from "./routes/retention.js";
import sql from "./db/sql.js";
import bcrypt from "bcryptjs";
import groupRoutes from "./routes/groups.js";
import notificationGroupRoutes from "./routes/notificationGroups.js";
import notificationRoutes    from "./routes/notifications.js"; // Persistent notifications API route
import dbAuditRoutes from "./routes/dbAudit.js";
import activityRoutes from "./routes/activity.js";
import { PERMISSION_IDS } from "./middleware/rbac.js";
import { requestContainer } from "./services/activity.js";

const app = Fastify({
  pluginTimeout: 30000,
  trustProxy: true,
  logger: {
    level: "info",
    serializers: {
      req(request) {
        let url = request.url || "";
        if (url.includes("token=")) {
          url = url.replace(/([\?&]token=)[^&]+/, "$1••••••••");
        }
        return {
          method: request.method,
          url: url,
          hostname: request.hostname,
          remoteAddress: request.ip,
          remotePort: request.socket?.remotePort
        };
      }
    }
  }
});

app.addHook("onRequest", (request, reply, done) => {
  requestContainer.run(request, () => {
    done();
  });
});

async function start() {
  await app.register(cors, {
    origin: [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      process.env.FRONTEND_URL || "http://localhost:3000",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });

  await app.register(formbody);
  await app.register(jwt, {
    secret: process.env.BACKEND_SECRET_KEY || "dev_secret_change_in_production",
  });

  app.decorate("authenticate", async (req: any, reply: any) => {
    try {
      await req.jwtVerify();
      const payload = req.user as any;
      if (payload && payload.sub) {
        const [user] = await sql`
        SELECT user_id FROM users WHERE user_id = ${payload.sub} AND is_active = true
      `;
        if (!user) {
          return reply.status(401).send({ detail: "User session is invalid or inactive — please log in again" });
        }
      }
    } catch {
      return reply.status(401).send({ detail: "Unauthorized — please log in" });
    }
  });

  await app.register(authRoutes, { prefix: "/api/auth" });
  app.get("/api/clusters", async () => ({ clusters: [] }));
  await app.register(channelRoutes, { prefix: "/api/channels" });
  await app.register(alertRuleRoutes, { prefix: "/api/alert-rules" });
  app.get("/api/incidents", async () => ({ incidents: [], total: 0 }));
  app.get("/api/incidents/:id", async (req, reply) => reply.status(404).send({ detail: "Not found" }));
  await app.register(userRoutes, { prefix: "/api/users" });
  await app.register(serviceOwnerRoutes, { prefix: "/api/service-owners" });
  await app.register(preferencesRoutes, { prefix: "/api/preferences" });
  await app.register(retentionRoutes, { prefix: "/api/retention" });
  app.get("/api/resource-alerts", async () => ({ alerts: [] }));
  await app.register(groupRoutes, { prefix: "/api/groups" });
  await app.register(notificationGroupRoutes, { prefix: "/api/notification-groups" });
  await app.register(notificationRoutes, { prefix: "/api/notifications" });
  app.get("/api/machines", async () => ({ machines: [] }));
  await app.register(dbAuditRoutes, { prefix: "/api/db-audit" });
  await app.register(activityRoutes, { prefix: "/api/activities" });



  const __dirname = fileURLToPath(new URL(".", import.meta.url));
  
  function getCurrentVersion() {
    try {
      const pkg = JSON.parse(readFileSync(join(__dirname, "../package.json"), "utf8"));
      return pkg.version || "0.1.1";
    } catch {
      return "0.1.1";
    }
  }

  app.get("/health", async () => ({
    status: "ok", service: "srevox-db-auditor-api", version: getCurrentVersion(),
    timestamp: new Date().toISOString(),
  }));

  let cachedLatestVersion = "";
  let cacheTimestamp = 0;
  const CACHE_DURATION = 300 * 1000; // 5 mins

  app.get("/api/latest-version", async (req, reply) => {
    const installed_version = `v${getCurrentVersion()}`;
    const now = Date.now();
    if (cachedLatestVersion && (now - cacheTimestamp < CACHE_DURATION)) {
      return { version: cachedLatestVersion, installed_version, latest_version: cachedLatestVersion };
    }

    try {
      const res = await fetch("https://api.github.com/repos/Akshatsainiaks/srevox-db-auditor/tags", {
        headers: {
          "Accept": "application/vnd.github.v3+json",
          "User-Agent": "srevox-db-auditor-api"
        },
      });
      if (res.ok) {
        const data = await res.json() as any;
        if (Array.isArray(data) && data.length > 0) {
          const latest = data[0].name;
          if (latest) {
            cachedLatestVersion = latest;
            cacheTimestamp = now;
            return { version: latest, installed_version, latest_version: latest };
          }
        }
      }
    } catch (err: any) {
      console.warn("[api] Standalone tag check notice:", err.message);
    }

    // Default to installed version if repository tags do not exist yet
    return { version: installed_version, installed_version, latest_version: installed_version };
  });


  // ── Auto-migration — runs on every startup, safe to re-run ──────────────────
  async function runMigrations() {
    try {
      // 1. Ensure pgcrypto extension is active for gen_random_uuid()
      try {
        await sql`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`;
      } catch (err: any) {
        console.warn("pgcrypto extension warning:", err.message || err);
      }

      // 2. Safeguard: Cleanly drop any legacy Srevox Core infrastructure tables
      await sql`
        DROP TABLE IF EXISTS 
          cluster_nodes_history, 
          cluster_nodes, 
          cluster_pods, 
          clusters, 
          machine_telemetry_history, 
          machine_alert_rules, 
          machines, 
          resource_alerts, 
          user_ai_diagnoses, 
          incidents, 
          ai_settings CASCADE
      `;

      // 3. Drop legacy foreign key constraints that referenced dropped tables
      try { await sql`ALTER TABLE alert_rules DROP CONSTRAINT IF EXISTS alert_rules_cluster_id_fkey`; } catch {}
      try { await sql`ALTER TABLE alerts_sent DROP CONSTRAINT IF EXISTS alerts_sent_incident_id_fkey`; } catch {}
      try { await sql`ALTER TABLE user_notifications DROP CONSTRAINT IF EXISTS user_notifications_cluster_id_fkey`; } catch {}
      try { await sql`ALTER TABLE user_notifications DROP CONSTRAINT IF EXISTS user_notifications_incident_id_fkey`; } catch {}
      try { await sql`ALTER TABLE service_owners DROP CONSTRAINT IF EXISTS service_owners_cluster_id_fkey`; } catch {}

      // 4. Create the 20 DB Auditor Tables
      // Table 1: organizations
      await sql`
        CREATE TABLE IF NOT EXISTS organizations (
          org_id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          name              TEXT NOT NULL,
          slug              TEXT UNIQUE NOT NULL,
          created_at        TIMESTAMPTZ DEFAULT now(),
          security_password TEXT DEFAULT 'admin123'
        )
      `;
      await sql`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS security_password TEXT DEFAULT 'admin123'`;
      await sql`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS default_alert_source_channel_id TEXT`;
      await sql`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS default_alert_cc TEXT`;
      await sql`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS default_alert_bcc TEXT`;
      await sql`
        INSERT INTO organizations (org_id, name, slug)
        VALUES ('orgjncj44t4hb4', 'Srevox DB Auditor Organization', 'srevox-db-auditor')
        ON CONFLICT (org_id) DO UPDATE SET name = EXCLUDED.name, slug = EXCLUDED.slug
      `;

      // Table 2: users
      await sql`
        CREATE TABLE IF NOT EXISTS users (
          user_id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          org_id              TEXT REFERENCES organizations(org_id) ON DELETE CASCADE,
          email               TEXT NOT NULL,
          hashed_password     TEXT NOT NULL,
          full_name           TEXT DEFAULT '',
          role                TEXT DEFAULT 'member',
          created_at          TIMESTAMPTZ DEFAULT now(),
          last_login_at       TIMESTAMPTZ,
          is_active           BOOLEAN DEFAULT TRUE,
          invited_by          TEXT,
          invite_token        TEXT,
          invite_expires_at   TIMESTAMPTZ,
          personal_channel_id TEXT,
          permissions         JSONB DEFAULT '{}'::jsonb
        )
      `;
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}'::jsonb`;
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS personal_channel_id TEXT`;
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE`;
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS invited_by TEXT`;
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS invite_token TEXT`;
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS invite_expires_at TIMESTAMPTZ`;
      try {
        await sql.unsafe(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key`);
        await sql.unsafe(`ALTER TABLE users ADD CONSTRAINT users_email_org_id_key UNIQUE (email, org_id)`);
      } catch {}

      // Table 3: user_organizations
      await sql`
        CREATE TABLE IF NOT EXISTS user_organizations (
          user_id    TEXT,
          org_id     TEXT REFERENCES organizations(org_id) ON DELETE CASCADE,
          role       TEXT NOT NULL DEFAULT 'member',
          created_at TIMESTAMPTZ DEFAULT now(),
          PRIMARY KEY (user_id, org_id)
        )
      `;
      await sql`
        INSERT INTO user_organizations (user_id, org_id, role)
        SELECT user_id, org_id, role FROM users
        ON CONFLICT (user_id, org_id) DO NOTHING
      `;

      // Table 4: groups
      await sql`
        CREATE TABLE IF NOT EXISTS groups (
          group_id    TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          org_id      TEXT REFERENCES organizations(org_id) ON DELETE CASCADE,
          name        TEXT NOT NULL,
          description TEXT DEFAULT '',
          permissions JSONB DEFAULT '{}'::jsonb,
          created_at  TIMESTAMPTZ DEFAULT now()
        )
      `;

      // Table 5: group_members
      await sql`
        CREATE TABLE IF NOT EXISTS group_members (
          group_id   TEXT REFERENCES groups(group_id) ON DELETE CASCADE,
          user_id    TEXT REFERENCES users(user_id) ON DELETE CASCADE,
          created_at TIMESTAMPTZ DEFAULT now(),
          PRIMARY KEY (group_id, user_id)
        )
      `;

      // Table 6: invitations
      await sql`
        CREATE TABLE IF NOT EXISTS invitations (
          invite_id  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          org_id     TEXT REFERENCES organizations(org_id) ON DELETE CASCADE,
          email      TEXT NOT NULL,
          role       TEXT NOT NULL DEFAULT 'member',
          token      TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
          invited_by TEXT REFERENCES users(user_id) ON DELETE SET NULL,
          created_at TIMESTAMPTZ DEFAULT now(),
          expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
          accepted   BOOLEAN DEFAULT FALSE
        )
      `;

      // Table 7: channels
      await sql`
        CREATE TABLE IF NOT EXISTS channels (
          channel_id        TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          org_id            TEXT REFERENCES organizations(org_id) ON DELETE CASCADE,
          name              TEXT NOT NULL,
          type              TEXT NOT NULL,
          config_encrypted  TEXT NOT NULL,
          enabled           BOOLEAN DEFAULT true,
          last_success_at   TIMESTAMPTZ,
          last_error        TEXT,
          created_at        TIMESTAMPTZ DEFAULT now(),
          channel_type      TEXT DEFAULT 'normal',
          is_global_default BOOLEAN DEFAULT false
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS idx_channels_org ON channels(org_id)`;

      // Table 8: alert_rules
      await sql`
        CREATE TABLE IF NOT EXISTS alert_rules (
          rule_id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          org_id                 TEXT REFERENCES organizations(org_id) ON DELETE CASCADE,
          cluster_id             TEXT,
          name                   TEXT NOT NULL,
          description            TEXT DEFAULT '',
          namespaces             JSONB DEFAULT '[]'::jsonb,
          pod_labels             JSONB DEFAULT '{}'::jsonb,
          crash_reasons          JSONB DEFAULT '["CrashLoopBackOff","OOMKilled","Error","BackOff","ImagePullBackOff"]'::jsonb,
          min_restarts           INT DEFAULT 3,
          cooldown_minutes       INT DEFAULT 15,
          severity               TEXT DEFAULT 'warning',
          channel_ids            JSONB DEFAULT '[]'::jsonb,
          enabled                BOOLEAN DEFAULT true,
          created_at             TIMESTAMPTZ DEFAULT now(),
          only_increase_restarts BOOLEAN DEFAULT TRUE
        )
      `;

      // Table 9: alerts_sent
      await sql`
        CREATE TABLE IF NOT EXISTS alerts_sent (
          alert_sent_id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          incident_id   TEXT,
          channel_id    TEXT REFERENCES channels(channel_id) ON DELETE SET NULL,
          channel_type  TEXT NOT NULL,
          status        TEXT NOT NULL,
          error_message TEXT,
          sent_at       TIMESTAMPTZ DEFAULT now()
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS idx_alerts_sent_channel ON alerts_sent(channel_id)`;

      // Table 10: user_alert_preferences
      await sql`
        CREATE TABLE IF NOT EXISTS user_alert_preferences (
          preference_id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          org_id                    TEXT REFERENCES organizations(org_id) ON DELETE CASCADE,
          user_id                   TEXT REFERENCES users(user_id) ON DELETE CASCADE,
          channel_id                TEXT REFERENCES channels(channel_id) ON DELETE SET NULL,
          severities                JSONB DEFAULT '["critical","warning","info"]'::jsonb,
          crash_reasons             JSONB DEFAULT '[]'::jsonb,
          namespaces                JSONB DEFAULT '[]'::jsonb,
          quiet_hours_enabled       BOOLEAN DEFAULT FALSE,
          quiet_hours_start         TEXT,
          quiet_hours_end           TEXT,
          notify_resolved           BOOLEAN DEFAULT TRUE,
          notify_acknowledged       BOOLEAN DEFAULT TRUE,
          enabled                   BOOLEAN DEFAULT TRUE,
          created_at                TIMESTAMPTZ DEFAULT now(),
          updated_at                TIMESTAMPTZ DEFAULT now(),
          notifications_muted       BOOLEAN DEFAULT false,
          notifications_muted_until TIMESTAMPTZ,
          UNIQUE(user_id)
        )
      `;

      // Table 11: user_notifications
      await sql`
        CREATE TABLE IF NOT EXISTS user_notifications (
          notification_id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          org_id          TEXT REFERENCES organizations(org_id) ON DELETE CASCADE,
          user_id         TEXT REFERENCES users(user_id) ON DELETE CASCADE,
          incident_id     TEXT,
          cluster_id      TEXT,
          title           TEXT NOT NULL,
          sub             TEXT NOT NULL,
          severity        TEXT DEFAULT 'warning',
          type            TEXT DEFAULT 'crash',
          is_read         BOOLEAN DEFAULT false,
          is_dismissed    BOOLEAN DEFAULT false,
          created_at      TIMESTAMPTZ DEFAULT now()
        )
      `;

      // Table 12: notification_groups
      await sql`
        CREATE TABLE IF NOT EXISTS notification_groups (
          group_id   TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          org_id     TEXT REFERENCES organizations(org_id) ON DELETE CASCADE,
          name       TEXT NOT NULL,
          emails     JSONB DEFAULT '[]'::jsonb,
          created_at TIMESTAMPTZ DEFAULT now()
        )
      `;

      // Table 13: service_owners
      await sql`
        CREATE TABLE IF NOT EXISTS service_owners (
          service_owner_id        TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          org_id                  TEXT REFERENCES organizations(org_id) ON DELETE CASCADE,
          cluster_id              TEXT,
          namespace               TEXT,
          pod_prefix              TEXT,
          user_id                 TEXT,
          channel_ids             JSONB DEFAULT '[]'::jsonb,
          channel_id              TEXT,
          created_at              TIMESTAMPTZ DEFAULT now(),
          user_ids                JSONB DEFAULT '[]'::jsonb,
          alert_source_channel_id TEXT,
          alert_recipients        JSONB DEFAULT '[]'::jsonb,
          alert_cc                TEXT,
          alert_bcc               TEXT,
          alert_mail_template_id  TEXT,
          alert_crash_reasons     JSONB DEFAULT '[]'::jsonb,
          group_ids               JSONB DEFAULT '[]'::jsonb
        )
      `;

      // Table 14: service_owner_settings
      await sql`
        CREATE TABLE IF NOT EXISTS service_owner_settings (
          org_id                          TEXT PRIMARY KEY REFERENCES organizations(org_id) ON DELETE CASCADE,
          default_alert_source_channel_id TEXT,
          default_alert_cc                TEXT,
          default_alert_bcc               TEXT,
          created_at                      TIMESTAMPTZ DEFAULT now(),
          updated_at                      TIMESTAMPTZ DEFAULT now()
        )
      `;

      // Table 15: system_alert_settings
      await sql`
        CREATE TABLE IF NOT EXISTS system_alert_settings (
          org_id          TEXT PRIMARY KEY REFERENCES organizations(org_id) ON DELETE CASCADE,
          enabled         BOOLEAN DEFAULT true,
          enabled_events  JSONB DEFAULT '["db_connected", "db_disconnected", "db_error"]'::jsonb,
          channel_ids     JSONB DEFAULT '[]'::jsonb,
          created_at      TIMESTAMPTZ DEFAULT now(),
          updated_at      TIMESTAMPTZ DEFAULT now()
        )
      `;

      // Table 16: activity_log
      await sql`
        CREATE TABLE IF NOT EXISTS activity_log (
          activity_log_id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          org_id          TEXT,
          user_id         TEXT,
          action          TEXT NOT NULL,
          resource        TEXT,
          resource_id     TEXT,
          metadata        JSONB DEFAULT '{}'::jsonb,
          created_at      TIMESTAMPTZ DEFAULT now()
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS idx_activity_org ON activity_log(org_id, created_at DESC)`;

      // Table 17: retention_policies
      await sql`
        CREATE TABLE IF NOT EXISTS retention_policies (
          org_id                  TEXT PRIMARY KEY REFERENCES organizations(org_id) ON DELETE CASCADE,
          activity_days           INT DEFAULT 0,
          incident_days           INT DEFAULT 0,
          updated_at              TIMESTAMPTZ DEFAULT now(),
          purge_interval_hours    INT DEFAULT 4,
          last_logs_purge_at      TIMESTAMPTZ,
          last_incidents_purge_at TIMESTAMPTZ,
          db_audit_days           INT DEFAULT 90,
          last_audit_purge_at     TIMESTAMPTZ
        )
      `;

      // Table 18: retention_runs
      await sql`
        CREATE TABLE IF NOT EXISTS retention_runs (
          run_id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          org_id         TEXT REFERENCES organizations(org_id) ON DELETE CASCADE,
          run_type       TEXT NOT NULL,
          items_purged   INT NOT NULL,
          completed_at   TIMESTAMPTZ DEFAULT now(),
          purged_details JSONB DEFAULT '[]'::jsonb,
          status         TEXT DEFAULT 'completed'
        )
      `;

      // Table 19: db_audit_connectors
      await sql`
        CREATE TABLE IF NOT EXISTS db_audit_connectors (
          id                 TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          connector_id       TEXT,
          org_id             TEXT REFERENCES organizations(org_id) ON DELETE CASCADE,
          name               TEXT NOT NULL,
          db_type            TEXT NOT NULL,
          capture_mode       TEXT DEFAULT 'log_based',
          host               TEXT,
          port               INT,
          database_name      TEXT,
          username           TEXT,
          password           TEXT,
          status             TEXT DEFAULT 'connected',
          audit_scope        TEXT DEFAULT 'all',
          target_tables      TEXT,
          enable_pii_masking BOOLEAN DEFAULT true,
          last_sync_at       TIMESTAMPTZ DEFAULT now(),
          created_at         TIMESTAMPTZ DEFAULT now()
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS idx_db_audit_connectors_org ON db_audit_connectors(org_id)`;

      // Table 20: db_audit_events
      await sql`
        CREATE TABLE IF NOT EXISTS db_audit_events (
          event_id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          id               TEXT,
          org_id           TEXT REFERENCES organizations(org_id) ON DELETE CASCADE,
          connector_id     TEXT,
          database_name    TEXT,
          schema_name      TEXT DEFAULT 'public',
          table_name       TEXT,
          operation        TEXT,
          actor            TEXT DEFAULT 'srevox',
          client_ip        TEXT,
          primary_key      JSONB,
          column_types     JSONB DEFAULT '{}'::jsonb,
          before_state     JSONB,
          after_state      JSONB,
          changed_fields   JSONB DEFAULT '[]'::jsonb,
          masked_fields    JSONB DEFAULT '[]'::jsonb,
          commit_timestamp TIMESTAMPTZ DEFAULT now(),
          created_at       TIMESTAMPTZ DEFAULT now(),
          record_hash      TEXT,
          capture_mode     TEXT DEFAULT 'log_based',
          change_origin    TEXT
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS idx_db_audit_events_connector ON db_audit_events(connector_id, created_at DESC)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_db_audit_events_table ON db_audit_events(table_name, created_at DESC)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_db_audit_events_created ON db_audit_events(created_at DESC)`;

      // Ensure all extended columns exist on DB Auditor tables
      try {
        await sql`ALTER TABLE db_audit_connectors ADD COLUMN IF NOT EXISTS connector_id TEXT`;
        await sql`ALTER TABLE db_audit_connectors ADD COLUMN IF NOT EXISTS capture_mode TEXT DEFAULT 'log_based'`;
        await sql`ALTER TABLE db_audit_connectors ADD COLUMN IF NOT EXISTS audit_scope TEXT DEFAULT 'all'`;
        await sql`ALTER TABLE db_audit_connectors ADD COLUMN IF NOT EXISTS target_tables TEXT`;
        await sql`ALTER TABLE db_audit_connectors ADD COLUMN IF NOT EXISTS enable_pii_masking BOOLEAN DEFAULT true`;
        await sql`ALTER TABLE db_audit_connectors ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMPTZ DEFAULT now()`;

        await sql`ALTER TABLE db_audit_events ADD COLUMN IF NOT EXISTS id TEXT`;
        await sql`ALTER TABLE db_audit_events ADD COLUMN IF NOT EXISTS connector_id TEXT`;
        await sql`ALTER TABLE db_audit_events ADD COLUMN IF NOT EXISTS actor TEXT DEFAULT 'srevox'`;
        await sql`ALTER TABLE db_audit_events ADD COLUMN IF NOT EXISTS client_ip TEXT`;
        await sql`ALTER TABLE db_audit_events ADD COLUMN IF NOT EXISTS column_types JSONB DEFAULT '{}'::jsonb`;
        await sql`ALTER TABLE db_audit_events ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now()`;

        // Purge any internal table records from audit events
        await sql`
          DELETE FROM db_audit_events 
          WHERE table_name IN (
            'users', 'organizations', 'groups', 'group_members', 'user_sessions', 
            'schema_migrations', 'schema_version', 'channels', 'service_owners', 
            'invitations', 'activity_log', 'service_owner_settings'
          )
        `;
      } catch (err) {
        console.warn("[migrations] column extension note:", err.message);
      }

      
      // 5. Initialize ClickHouse audit schema if ClickHouse is configured
      try {
        const chUrl = process.env.CLICKHOUSE_URL || "http://clickhouse:8123";
        const chTableSql = `
          CREATE TABLE IF NOT EXISTS audit_events (
            tenant_id UUID,
            project_id UUID,
            connector_id UUID,
            database String,
            schema String,
            table String,
            operation Enum8('INSERT' = 1, 'UPDATE' = 2, 'DELETE' = 3, 'DDL' = 4),
            primary_key String,
            before String,
            after String,
            changed_fields Array(String),
            masked_fields Array(String),
            commit_timestamp DateTime64(3, 'UTC'),
            ingest_timestamp DateTime64(3, 'UTC') DEFAULT now64(3),
            transaction_id String,
            db_user String,
            application_name String,
            client_ip String,
            session_id String,
            execution_metadata String,
            record_hash String,
            prev_hash String,
            capture_mode Enum8('log_based' = 1, 'polling' = 2)
          )
          ENGINE = MergeTree()
          PARTITION BY toYYYYMM(commit_timestamp)
          PRIMARY KEY (tenant_id, database, schema, table)
          ORDER BY (tenant_id, database, schema, table, commit_timestamp);
        `;
        await fetch(`${chUrl}/?query=${encodeURIComponent(chTableSql)}`, {
          method: "POST"
        }).then(r => {
          if (r.ok) console.log("✅ ClickHouse audit_events table verified");
        }).catch(() => {});
      } catch (err: any) {
        // Non-blocking: ClickHouse will initialize when reachable
      }

      console.log("✅ DB Auditor migrations complete (20 active tables verified)");
    } catch (e: any) {
      console.error("Migration error:", e.message);
    }
  }

  async function seedDefaults() {
    try {
      const [existing] = await sql`
      SELECT user_id FROM users WHERE email = 'admin@srevox.local' LIMIT 1
    `;
      if (!existing) {
        const hashed = await bcrypt.hash("admin123", 12);
        await sql`
        INSERT INTO users (user_id, org_id, email, hashed_password, full_name, role)
        VALUES (
          'usrjncj44t4hb4',
          'orgjncj44t4hb4',
          'admin@srevox.local',
          ${hashed},
          'Admin User',
          'admin'
        ) ON CONFLICT DO NOTHING
      `;
        console.log("✅ Default admin: admin@srevox.local / admin123");
      }
    } catch (err) {
      console.warn("[seed] skipped:", err);
    }
  }

  const PORT = Number(process.env.API_PORT || process.env.PORT || 7001);
  try {
    await runMigrations();
    await seedDefaults();
    await app.listen({ port: PORT, host: "0.0.0.0" });
    console.log(`🚀 Srevox API running on http://localhost:${PORT}`);

    // Infrastructure node evaluation loop disabled for DB Auditor
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();