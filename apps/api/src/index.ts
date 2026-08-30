import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import formbody from "@fastify/formbody";
import "dotenv/config";
import { readFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";

import authRoutes from "./routes/auth.js";
import clusterRoutes from "./routes/clusters.js";
import channelRoutes from "./routes/channels.js";
import alertRuleRoutes from "./routes/alertRules.js";
import incidentRoutes from "./routes/incidents.js";
import userRoutes from "./routes/users.js";
import serviceOwnerRoutes from "./routes/serviceOwners.js";
import preferencesRoutes from "./routes/preferences.js";
import retentionRoutes from "./routes/retention.js";
import sql from "./db/sql.js";
import bcrypt from "bcryptjs";
import infrastructureRoutes from "./routes/infrastructure.js";
import aiSettingsRoutes from './routes/aiSettings.js';
import resourceAlertRoutes from "./routes/resourceAlerts.js";
import groupRoutes from "./routes/groups.js";
import notificationGroupRoutes from "./routes/notificationGroups.js";
import notificationRoutes    from "./routes/notifications.js"; // Persistent notifications API route
import systemAlertSettingsRoutes from "./routes/systemAlertSettings.js";
import machineRoutes from "./routes/machines.js";
import dbAuditRoutes from "./routes/dbAudit.js";
import { checkClusterNodesAndMetrics } from "./services/infraEvaluator.js";
import { PERMISSION_IDS } from "./middleware/rbac.js";
import { requestContainer } from "./services/activity.js";

const app = Fastify({
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
  await app.register(clusterRoutes, { prefix: "/api/clusters" });
  await app.register(channelRoutes, { prefix: "/api/channels" });
  await app.register(alertRuleRoutes, { prefix: "/api/alert-rules" });
  await app.register(incidentRoutes, { prefix: "/api/incidents" });
  await app.register(userRoutes, { prefix: "/api/users" });
  await app.register(serviceOwnerRoutes, { prefix: "/api/service-owners" });
  await app.register(preferencesRoutes, { prefix: "/api/preferences" });
  await app.register(retentionRoutes, { prefix: "/api/retention" });
  await app.register(infrastructureRoutes, { prefix: "/api/infrastructure" });
  await app.register(resourceAlertRoutes, { prefix: "/api/resource-alerts" });
  await app.register(aiSettingsRoutes, { prefix: "/api/ai-settings" });
  await app.register(groupRoutes, { prefix: "/api/groups" });
  await app.register(notificationGroupRoutes, { prefix: "/api/notification-groups" });
  await app.register(notificationRoutes, { prefix: "/api/notifications" });
  await app.register(systemAlertSettingsRoutes, { prefix: "/api/system-alert-settings" });
  await app.register(machineRoutes, { prefix: "/api/machines" });
  await app.register(dbAuditRoutes, { prefix: "/api/db-audit" });

  const __dirname = fileURLToPath(new URL(".", import.meta.url));
  const pkg = JSON.parse(readFileSync(join(__dirname, "../package.json"), "utf8"));
  const API_VERSION = pkg.version;

  app.get("/health", async () => ({
    status: "ok", service: "srevox-api", version: API_VERSION,
    timestamp: new Date().toISOString(),
  }));

  let cachedLatestVersion = "";
  let cacheTimestamp = 0;
  const CACHE_DURATION = 3600 * 1000; // 1 hour

  app.get("/api/latest-version", { onRequest: [(app as any).authenticate] }, async (req, reply) => {
    const installed_version = `v${API_VERSION}`;
    const now = Date.now();
    if (cachedLatestVersion && (now - cacheTimestamp < CACHE_DURATION)) {
      return { version: cachedLatestVersion, installed_version };
    }

    try {
      const res = await fetch("https://api.github.com/repos/Akshatsainiaks/srevox-setup/tags", {
        headers: {
          "Accept": "application/vnd.github.v3+json",
          "User-Agent": "srevox-api"
        },
      });
      if (res.ok) {
        const data = await res.json() as any;
        if (Array.isArray(data) && data.length > 0) {
          const latest = data[0].name; // tag name is "name" in tags endpoint
          if (latest) {
            cachedLatestVersion = latest;
            cacheTimestamp = now;
            return { version: latest, installed_version };
          }
        }
      }
    } catch (err: any) {
      console.error("[api] Failed to fetch latest version from GitHub tags:", err.message);
    }

    return { version: cachedLatestVersion || installed_version, installed_version };
  });


  // ── Auto-migration — runs on every startup, safe to re-run ──────────────────
  async function runMigrations() {
    try {
      // Ensure pgcrypto extension is active for gen_random_uuid()
      try {
        await sql`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`;
      } catch (err: any) {
        console.warn("pgcrypto extension warning:", err.message || err);
      }

      // Create main tables programmatically if they do not exist
      await sql`
      CREATE TABLE IF NOT EXISTS organizations (
        org_id     TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        name       TEXT NOT NULL,
        slug       TEXT UNIQUE NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `;

      await sql`
      CREATE TABLE IF NOT EXISTS users (
        user_id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        org_id          TEXT REFERENCES organizations(org_id) ON DELETE CASCADE,
        email           TEXT UNIQUE NOT NULL,
        hashed_password TEXT NOT NULL,
        full_name       TEXT DEFAULT '',
        role            TEXT DEFAULT 'member',
        created_at      TIMESTAMPTZ DEFAULT now(),
        last_login_at   TIMESTAMPTZ,
        is_active       BOOLEAN DEFAULT TRUE,
        invited_by      TEXT,
        invite_token    TEXT,
        invite_expires_at TIMESTAMPTZ,
        personal_channel_id TEXT
      )
    `;

      await sql`
      CREATE TABLE IF NOT EXISTS clusters (
        cluster_id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        org_id               TEXT REFERENCES organizations(org_id) ON DELETE CASCADE,
        name                 TEXT NOT NULL,
        connection_type      TEXT NOT NULL,
        kubeconfig_encrypted TEXT,
        agent_token          TEXT UNIQUE,
        api_server_url       TEXT,
        cloud_provider       TEXT DEFAULT 'other',
        k8s_version          TEXT,
        status               TEXT DEFAULT 'pending',
        last_seen_at         TIMESTAMPTZ,
        error_message        TEXT,
        created_at           TIMESTAMPTZ DEFAULT now()
      )
    `;

      await sql`
      CREATE TABLE IF NOT EXISTS channels (
        channel_id       TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        org_id           TEXT REFERENCES organizations(org_id) ON DELETE CASCADE,
        name             TEXT NOT NULL,
        type             TEXT NOT NULL,
        config_encrypted TEXT NOT NULL,
        enabled          BOOLEAN DEFAULT true,
        last_success_at  TIMESTAMPTZ,
        last_error       TEXT,
        created_at       TIMESTAMPTZ DEFAULT now()
      )
    `;

      await sql`
      CREATE TABLE IF NOT EXISTS alert_rules (
        rule_id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        org_id           TEXT REFERENCES organizations(org_id) ON DELETE CASCADE,
        cluster_id       TEXT REFERENCES clusters(cluster_id) ON DELETE CASCADE,
        name             TEXT NOT NULL,
        description      TEXT DEFAULT '',
        namespaces       JSONB DEFAULT '[]',
        pod_labels       JSONB DEFAULT '{}',
        crash_reasons    JSONB DEFAULT '["CrashLoopBackOff","OOMKilled","Error","BackOff","ImagePullBackOff"]',
        min_restarts     INT DEFAULT 3,
        cooldown_minutes INT DEFAULT 15,
        severity         TEXT DEFAULT 'warning',
        channel_ids      JSONB DEFAULT '[]',
        enabled          BOOLEAN DEFAULT true,
        created_at       TIMESTAMPTZ DEFAULT now()
      )
    `;

      await sql`
      CREATE TABLE IF NOT EXISTS incidents (
        incident_id     TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        org_id          TEXT REFERENCES organizations(org_id) ON DELETE CASCADE,
        cluster_id      TEXT REFERENCES clusters(cluster_id) ON DELETE SET NULL,
        rule_id         TEXT REFERENCES alert_rules(rule_id) ON DELETE SET NULL,
        pod_name        TEXT NOT NULL,
        namespace       TEXT NOT NULL,
        container_name  TEXT,
        crash_reason    TEXT NOT NULL,
        restart_count   INT DEFAULT 0,
        exit_code       INT,
        pod_labels      JSONB DEFAULT '{}',
        raw_event       JSONB DEFAULT '{}',
        severity        TEXT DEFAULT 'warning',
        status          TEXT DEFAULT 'open',
        acknowledged_by TEXT,
        resolved_by     TEXT,
        ai_diagnosis    JSONB,
        ai_diagnosed_at TIMESTAMPTZ,
        first_seen_at   TIMESTAMPTZ DEFAULT now(),
        last_seen_at    TIMESTAMPTZ DEFAULT now(),
        resolved_at     TIMESTAMPTZ
      )
    `;

      await sql`
      CREATE TABLE IF NOT EXISTS alerts_sent (
        alert_sent_id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        incident_id   TEXT REFERENCES incidents(incident_id) ON DELETE CASCADE,
        channel_id    TEXT REFERENCES channels(channel_id) ON DELETE SET NULL,
        channel_type  TEXT NOT NULL,
        status        TEXT NOT NULL,
        error_message TEXT,
        sent_at       TIMESTAMPTZ DEFAULT now()
      )
    `;

      await sql`
      CREATE TABLE IF NOT EXISTS activity_log (
        activity_log_id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        org_id          TEXT,
        user_id         TEXT,
        action          TEXT NOT NULL,
        resource        TEXT,
        resource_id     TEXT,
        metadata        JSONB DEFAULT '{}',
        created_at      TIMESTAMPTZ DEFAULT now()
      )
    `;

      await sql`
      CREATE TABLE IF NOT EXISTS user_alert_preferences (
        preference_id       TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        org_id              TEXT REFERENCES organizations(org_id) ON DELETE CASCADE,
        user_id             TEXT REFERENCES users(user_id) ON DELETE CASCADE,
        channel_id          TEXT REFERENCES channels(channel_id) ON DELETE SET NULL,
        severities          JSONB DEFAULT '["critical","warning","info"]',
        crash_reasons       JSONB DEFAULT '[]',
        namespaces          JSONB DEFAULT '[]',
        quiet_hours_enabled BOOLEAN DEFAULT FALSE,
        quiet_hours_start   TEXT,
        quiet_hours_end     TEXT,
        notify_resolved     BOOLEAN DEFAULT TRUE,
        notify_acknowledged BOOLEAN DEFAULT TRUE,
        enabled             BOOLEAN DEFAULT TRUE,
        created_at          TIMESTAMPTZ DEFAULT now(),
        updated_at          TIMESTAMPTZ DEFAULT now(),
        UNIQUE(user_id)
      )
    `;

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

      // Create primary indexes programmatically if they do not exist
      await sql`CREATE INDEX IF NOT EXISTS idx_incidents_org_status ON incidents(org_id, status)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_incidents_cluster    ON incidents(cluster_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_incidents_first_seen ON incidents(first_seen_at DESC)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_clusters_org         ON clusters(org_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_rules_cluster        ON alert_rules(cluster_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_channels_org         ON channels(org_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_alerts_sent_incident ON alerts_sent(incident_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_activity_org         ON activity_log(org_id, created_at DESC)`;

      // Seed default organization
      await sql`ALTER TABLE organizations DROP COLUMN IF EXISTS plan`;
      await sql`ALTER TABLE organizations DROP COLUMN IF EXISTS org_code`;
      await sql`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS security_password TEXT DEFAULT 'admin123'`;
      await sql`
      INSERT INTO organizations (org_id, name, slug)
      VALUES ('orgjncj44t4hb4', 'My Organization', 'my-org')
      ON CONFLICT (org_id) DO NOTHING
    `;

      // Helper to rename id to [entity]_id if it exists
      const renameIfIdExists = async (table: string, newCol: string) => {
        try {
          await sql.unsafe(`ALTER TABLE ${table} RENAME COLUMN id TO ${newCol}`);
          console.log(`Renamed column id to ${newCol} in table ${table}`);
        } catch (err: any) {
          // Ignore if 'id' column does not exist or already renamed
        }
      };

      // Helper to rename any column if it exists
      const renameColumnIfExists = async (table: string, oldCol: string, newCol: string) => {
        try {
          await sql.unsafe(`ALTER TABLE ${table} RENAME COLUMN ${oldCol} TO ${newCol}`);
          console.log(`Renamed column ${oldCol} to ${newCol} in table ${table}`);
        } catch (err: any) {
          // Ignore if column does not exist
        }
      };

      await renameIfIdExists("organizations", "org_id");
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}'`;
      await sql`
      UPDATE users 
      SET permissions = (permissions#>>'{}')::jsonb
      WHERE jsonb_typeof(permissions) = 'string'
    `;
      await sql`
      UPDATE users
      SET permissions = COALESCE(
        (
          SELECT jsonb_object_agg(val, true)
          FROM jsonb_array_elements_text(permissions) AS val
        ),
        '{}'::jsonb
      )
      WHERE jsonb_typeof(permissions) = 'array'
    `;

      // Migrate legacy object-based permissions to ID-based dictionary structure
      try {
        const usersWithPermissions = await sql`
        SELECT user_id, permissions FROM users WHERE permissions IS NOT NULL
      `;
        for (const user of usersWithPermissions) {
          const perms = user.permissions;
          if (perms && typeof perms === "object" && !Array.isArray(perms) && Object.keys(perms).length > 0) {
            const firstKey = Object.keys(perms)[0];
            const isOldFormat = firstKey in PERMISSION_IDS;
            if (isOldFormat) {
              const newPermsObj: Record<string, any[]> = {};
              for (const [action, val] of Object.entries(perms)) {
                const mapEntry = (PERMISSION_IDS as any)[action];
                if (!mapEntry) continue;

                const { categoryId, id } = mapEntry;
                if (!newPermsObj[categoryId]) {
                  newPermsObj[categoryId] = [];
                }

                if (typeof val === "boolean") {
                  newPermsObj[categoryId].push({ id, value: val });
                } else if (val && typeof val === "object" && !Array.isArray(val)) {
                  const resources = Object.entries(val).map(([resId, resVal]) => ({
                    id: resId,
                    value: resVal === true
                  }));
                  newPermsObj[categoryId].push({
                    id,
                    value: true,
                    resources
                  });
                }
              }
              await sql`
              UPDATE users SET permissions = ${sql.json(newPermsObj)} WHERE user_id = ${user.user_id}
            `;
              console.log(`[migration] Migrated user ${user.user_id} permissions to static ID-based JSON structure`);
            }
          }
        }
        await sql`ALTER TABLE users ALTER COLUMN permissions SET DEFAULT '{}'::jsonb`;
      } catch (migErr: any) {
        console.warn("[migration] Failed to normalize user permissions:", migErr.message || migErr);
      }
      await renameIfIdExists("users", "user_id");
      await renameIfIdExists("clusters", "cluster_id");
      await renameIfIdExists("channels", "channel_id");
      await renameIfIdExists("alert_rules", "rule_id");
      await sql`ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS only_increase_restarts BOOLEAN DEFAULT TRUE`;
      await renameIfIdExists("incidents", "incident_id");
      await renameIfIdExists("alerts_sent", "alert_sent_id");
      await renameIfIdExists("activity_log", "activity_log_id");
      await renameIfIdExists("service_owners", "service_owner_id");
      await renameIfIdExists("user_alert_preferences", "preference_id");
      await renameIfIdExists("resource_alerts", "resource_alert_id");
      await renameIfIdExists("invitations", "invite_id");

      await renameColumnIfExists("service_owners", "owner_user_id", "user_id");

      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS personal_channel_id TEXT`;
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE`;
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS invited_by TEXT`;
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS invite_token TEXT`;
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS invite_expires_at TIMESTAMPTZ`;
      await sql`ALTER TABLE user_alert_preferences ADD COLUMN IF NOT EXISTS org_id TEXT`;
      await sql`ALTER TABLE user_alert_preferences ADD COLUMN IF NOT EXISTS severities JSONB DEFAULT '["critical","warning","info"]'`;
      await sql`ALTER TABLE user_alert_preferences ADD COLUMN IF NOT EXISTS crash_reasons JSONB DEFAULT '[]'`;
      await sql`ALTER TABLE user_alert_preferences ADD COLUMN IF NOT EXISTS namespaces JSONB DEFAULT '[]'`;
      await sql`ALTER TABLE user_alert_preferences ADD COLUMN IF NOT EXISTS quiet_hours_start TEXT`;
      await sql`ALTER TABLE user_alert_preferences ADD COLUMN IF NOT EXISTS quiet_hours_end TEXT`;
      await sql`ALTER TABLE user_alert_preferences ADD COLUMN IF NOT EXISTS quiet_hours_enabled BOOLEAN DEFAULT FALSE`;
      await sql`ALTER TABLE user_alert_preferences ADD COLUMN IF NOT EXISTS notify_resolved BOOLEAN DEFAULT TRUE`;
      await sql`ALTER TABLE user_alert_preferences ADD COLUMN IF NOT EXISTS notify_acknowledged BOOLEAN DEFAULT TRUE`;
      await sql`ALTER TABLE user_alert_preferences ADD COLUMN IF NOT EXISTS enabled BOOLEAN DEFAULT TRUE`;
      await sql`ALTER TABLE user_alert_preferences ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now()`;
      await sql`
      CREATE TABLE IF NOT EXISTS resource_alerts (
        resource_alert_id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        org_id TEXT, cluster_id TEXT, resource_type TEXT NOT NULL,
        threshold_pct INT DEFAULT 80, target TEXT DEFAULT 'all',
        target_name TEXT DEFAULT '', severity TEXT DEFAULT 'warning',
        enabled BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      )`;
      await sql`ALTER TABLE resource_alerts ALTER COLUMN cluster_id TYPE TEXT USING cluster_id::text`;
      await sql`ALTER TABLE resource_alerts ALTER COLUMN threshold_pct TYPE NUMERIC USING threshold_pct::numeric`;
      await sql`ALTER TABLE resource_alerts ADD COLUMN IF NOT EXISTS channel_ids JSONB DEFAULT '[]'`;
      await sql`ALTER TABLE resource_alerts ADD COLUMN IF NOT EXISTS mute_until TIMESTAMPTZ DEFAULT NULL`;
      await sql`ALTER TABLE resource_alerts ADD COLUMN IF NOT EXISTS repeat_interval_mins INT DEFAULT 15`;
      await sql`ALTER TABLE resource_alerts ADD COLUMN IF NOT EXISTS repeat_enabled BOOLEAN DEFAULT true`;
      await sql`ALTER TABLE resource_alerts ADD COLUMN IF NOT EXISTS memory_threshold_pct NUMERIC DEFAULT NULL`;
      await sql`ALTER TABLE resource_alerts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now()`;

      // Migrations for Machine (Host Server / VM) Monitoring
      await sql`
      CREATE TABLE IF NOT EXISTS machines (
        machine_id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        hostname VARCHAR(255),
        ip_address VARCHAR(128),
        os VARCHAR(128),
        arch VARCHAR(64),
        agent_token VARCHAR(255) UNIQUE NOT NULL,
        cpu_cores INT DEFAULT 1,
        total_memory_bytes BIGINT DEFAULT 0,
        total_disk_bytes BIGINT DEFAULT 0,
        status VARCHAR(32) DEFAULT 'pending',
        error_message TEXT,
        last_heartbeat_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

      await sql`
      CREATE TABLE IF NOT EXISTS machine_telemetry_history (
        id BIGSERIAL PRIMARY KEY,
        machine_id VARCHAR(64) NOT NULL REFERENCES machines(machine_id) ON DELETE CASCADE,
        cpu_usage_pct NUMERIC(5,2) DEFAULT 0,
        memory_used_bytes BIGINT DEFAULT 0,
        memory_usage_pct NUMERIC(5,2) DEFAULT 0,
        disk_used_bytes BIGINT DEFAULT 0,
        disk_usage_pct NUMERIC(5,2) DEFAULT 0,
        network_rx_bytes_sec BIGINT DEFAULT 0,
        network_tx_bytes_sec BIGINT DEFAULT 0,
        load_avg_1m NUMERIC(6,2) DEFAULT 0,
        load_avg_5m NUMERIC(6,2) DEFAULT 0,
        load_avg_15m NUMERIC(6,2) DEFAULT 0,
        recorded_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

      await sql`
      CREATE INDEX IF NOT EXISTS idx_machine_telemetry_history_machine_rec 
        ON machine_telemetry_history(machine_id, recorded_at DESC)
    `;

      await sql`
      CREATE TABLE IF NOT EXISTS machine_alert_rules (
        rule_id VARCHAR(64) PRIMARY KEY,
        org_id VARCHAR(64),
        machine_id VARCHAR(64) DEFAULT '*',
        metric VARCHAR(32) NOT NULL,
        operator VARCHAR(8) DEFAULT '>',
        threshold_pct NUMERIC(5,2) NOT NULL,
        severity VARCHAR(32) DEFAULT 'warning',
        repeat_enabled BOOLEAN DEFAULT true,
        repeat_interval_mins INT DEFAULT 15,
        channel_ids JSONB DEFAULT '[]'::jsonb,
        enabled BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
      await sql`ALTER TABLE machines ADD COLUMN IF NOT EXISTS org_id VARCHAR(64)`;
      await sql`ALTER TABLE machines ADD COLUMN IF NOT EXISTS top_cpu_processes JSONB DEFAULT '[]'::jsonb`;
      await sql`ALTER TABLE machines ADD COLUMN IF NOT EXISTS top_mem_processes JSONB DEFAULT '[]'::jsonb`;
      await sql`ALTER TABLE machine_alert_rules ADD COLUMN IF NOT EXISTS org_id VARCHAR(64)`;

      await sql`
      CREATE TABLE IF NOT EXISTS service_owners (
        service_owner_id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        org_id TEXT, cluster_id TEXT, namespace TEXT,
        pod_prefix TEXT, user_id TEXT,
        channel_ids JSONB DEFAULT '[]', channel_id TEXT, created_at TIMESTAMPTZ DEFAULT now()
      )`;
      await sql`ALTER TABLE service_owners ADD COLUMN IF NOT EXISTS channel_ids JSONB DEFAULT '[]'`;
      await sql`ALTER TABLE service_owners ADD COLUMN IF NOT EXISTS channel_id TEXT`;
      await sql`ALTER TABLE service_owners ALTER COLUMN namespace DROP NOT NULL`;
      await sql`ALTER TABLE service_owners ALTER COLUMN pod_prefix DROP NOT NULL`;
      await sql`ALTER TABLE service_owners ADD COLUMN IF NOT EXISTS user_ids JSONB DEFAULT '[]'`;
      await sql`UPDATE service_owners SET user_ids = jsonb_build_array(user_id) WHERE user_id IS NOT NULL AND (user_ids IS NULL OR user_ids = '[]'::jsonb)`;
      await sql`ALTER TABLE service_owners ADD COLUMN IF NOT EXISTS alert_source_channel_id TEXT`;
      await sql`ALTER TABLE service_owners ADD COLUMN IF NOT EXISTS alert_recipients JSONB DEFAULT '[]'`;
      await sql`ALTER TABLE service_owners ADD COLUMN IF NOT EXISTS alert_cc TEXT`;
      await sql`ALTER TABLE service_owners ADD COLUMN IF NOT EXISTS alert_bcc TEXT`;
      await sql`ALTER TABLE service_owners ADD COLUMN IF NOT EXISTS alert_mail_template_id TEXT`;
      await sql`ALTER TABLE service_owners ADD COLUMN IF NOT EXISTS alert_crash_reasons JSONB DEFAULT '[]'`;
      await sql`ALTER TABLE service_owners ADD COLUMN IF NOT EXISTS group_ids JSONB DEFAULT '[]'`;
      await sql`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS default_alert_source_channel_id TEXT`;
      await sql`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS default_alert_cc TEXT`;
      await sql`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS default_alert_bcc TEXT`;

      // Create cluster nodes and history tables
      await sql`
      CREATE TABLE IF NOT EXISTS cluster_nodes (
        cluster_id TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        status TEXT NOT NULL,
        cpu_cores NUMERIC NOT NULL,
        memory_gb NUMERIC NOT NULL,
        cpu_usage_pct NUMERIC NOT NULL,
        memory_usage_pct NUMERIC NOT NULL,
        pods_running INT NOT NULL,
        pods_capacity INT NOT NULL,
        age TEXT NOT NULL,
        PRIMARY KEY (cluster_id, name)
      )
    `;

      await sql`
      CREATE TABLE IF NOT EXISTS cluster_nodes_history (
        history_id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        cluster_id TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        status TEXT NOT NULL,
        cpu_cores NUMERIC NOT NULL,
        memory_gb NUMERIC NOT NULL,
        cpu_usage_pct NUMERIC NOT NULL,
        memory_usage_pct NUMERIC NOT NULL,
        pods_running INT NOT NULL,
        pods_capacity INT NOT NULL,
        age TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `;

      await sql`
      CREATE TABLE IF NOT EXISTS cluster_pods (
        cluster_id TEXT NOT NULL,
        name TEXT NOT NULL,
        namespace TEXT NOT NULL,
        node TEXT NOT NULL,
        status TEXT NOT NULL,
        cpu_usage_m INT NOT NULL,
        memory_usage_mi INT NOT NULL,
        restarts INT NOT NULL,
        age TEXT NOT NULL,
        PRIMARY KEY (cluster_id, namespace, name)
      )
    `;

      // Create service owner settings table
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

      // Migrate existing fallback configurations from organizations to service_owner_settings
      await sql`
      INSERT INTO service_owner_settings (org_id, default_alert_source_channel_id, default_alert_cc, default_alert_bcc)
      SELECT org_id, default_alert_source_channel_id, default_alert_cc, default_alert_bcc
      FROM organizations
      ON CONFLICT (org_id) DO NOTHING
    `;

      // Create system alert settings table
      await sql`
      CREATE TABLE IF NOT EXISTS system_alert_settings (
        org_id          TEXT PRIMARY KEY REFERENCES organizations(org_id) ON DELETE CASCADE,
        enabled         BOOLEAN DEFAULT true,
        enabled_events  JSONB DEFAULT '["cluster_connected", "cluster_disconnected", "cluster_deleted", "cluster_error"]',
        channel_ids     JSONB DEFAULT '[]',
        created_at      TIMESTAMPTZ DEFAULT now(),
        updated_at      TIMESTAMPTZ DEFAULT now()
      )
    `;

      // Mail routing & cluster migrations
      await sql`ALTER TABLE clusters ADD COLUMN IF NOT EXISTS sa_token TEXT`;
      await sql`ALTER TABLE channels ADD COLUMN IF NOT EXISTS channel_type TEXT DEFAULT 'normal'`;
      await sql`ALTER TABLE channels ADD COLUMN IF NOT EXISTS is_global_default BOOLEAN DEFAULT false`;
      await sql`UPDATE channels SET channel_type = 'normal' WHERE channel_type IS NULL`;
      await sql`UPDATE channels SET is_global_default = false WHERE is_global_default IS NULL`;

      await sql`
      CREATE TABLE IF NOT EXISTS notification_groups (
        group_id   TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        org_id     TEXT REFERENCES organizations(org_id) ON DELETE CASCADE,
        name       TEXT NOT NULL,
        emails     JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `;

      await sql`
      CREATE TABLE IF NOT EXISTS ai_settings (
        user_id TEXT PRIMARY KEY, provider TEXT DEFAULT 'groq',
        model TEXT DEFAULT 'llama-3.1-8b-instant',
        api_key TEXT DEFAULT '', ollama_url TEXT DEFAULT 'http://localhost:11434',
        updated_at TIMESTAMPTZ DEFAULT now()
      )`;
      await sql`ALTER TABLE ai_settings ADD COLUMN IF NOT EXISTS api_key_groq TEXT DEFAULT ''`;
      await sql`ALTER TABLE ai_settings ADD COLUMN IF NOT EXISTS api_key_openai TEXT DEFAULT ''`;
      await sql`ALTER TABLE ai_settings ADD COLUMN IF NOT EXISTS api_key_anthropic TEXT DEFAULT ''`;
      await sql`UPDATE ai_settings SET api_key_groq = api_key WHERE provider = 'groq' AND (api_key_groq = '')`;
      await sql`UPDATE ai_settings SET api_key_openai = api_key WHERE provider = 'openai' AND (api_key_openai = '')`;
      await sql`UPDATE ai_settings SET api_key_anthropic = api_key WHERE provider = 'anthropic' AND (api_key_anthropic = '')`;
      await sql`ALTER TABLE ai_settings ADD COLUMN IF NOT EXISTS model_groq TEXT DEFAULT 'llama-3.1-8b-instant'`;
      await sql`ALTER TABLE ai_settings ADD COLUMN IF NOT EXISTS model_openai TEXT DEFAULT 'gpt-4o-mini'`;
      await sql`ALTER TABLE ai_settings ADD COLUMN IF NOT EXISTS model_anthropic TEXT DEFAULT 'claude-sonnet-4-5'`;
      await sql`ALTER TABLE ai_settings ADD COLUMN IF NOT EXISTS model_ollama TEXT DEFAULT 'llama3'`;
      await sql`
      UPDATE ai_settings SET
        model_groq = CASE WHEN provider = 'groq' THEN model ELSE model_groq END,
        model_openai = CASE WHEN provider = 'openai' THEN model ELSE model_openai END,
        model_anthropic = CASE WHEN provider = 'anthropic' THEN model ELSE model_anthropic END,
        model_ollama = CASE WHEN provider = 'ollama' THEN model ELSE model_ollama END
    `;
      await sql`
      CREATE TABLE IF NOT EXISTS user_ai_diagnoses (
        user_id TEXT,
        incident_id TEXT REFERENCES incidents(incident_id) ON DELETE CASCADE,
        ai_diagnosis JSONB,
        ai_diagnosed_at TIMESTAMPTZ DEFAULT now(),
        PRIMARY KEY (user_id, incident_id)
      )`;

      await sql`ALTER TABLE clusters ADD COLUMN IF NOT EXISTS master_nodes_ready INT DEFAULT 0`;
      await sql`ALTER TABLE clusters ADD COLUMN IF NOT EXISTS master_nodes_total INT DEFAULT 0`;
      await sql`ALTER TABLE clusters ADD COLUMN IF NOT EXISTS worker_nodes_ready INT DEFAULT 0`;
      await sql`ALTER TABLE clusters ADD COLUMN IF NOT EXISTS worker_nodes_total INT DEFAULT 0`;
      await sql`ALTER TABLE clusters ADD COLUMN IF NOT EXISTS master_alerts_enabled BOOLEAN DEFAULT TRUE`;
      await sql`ALTER TABLE clusters ADD COLUMN IF NOT EXISTS worker_alerts_enabled BOOLEAN DEFAULT TRUE`;
      await sql`ALTER TABLE clusters ADD COLUMN IF NOT EXISTS node_cpu_threshold INT DEFAULT 85`;
      await sql`ALTER TABLE clusters ADD COLUMN IF NOT EXISTS node_memory_threshold INT DEFAULT 90`;
      await sql`ALTER TABLE clusters ADD COLUMN IF NOT EXISTS agent_ca_cert TEXT`;
      await sql`ALTER TABLE clusters ADD COLUMN IF NOT EXISTS skip_tls_verify BOOLEAN DEFAULT FALSE`;
      await sql`ALTER TABLE clusters DROP CONSTRAINT IF EXISTS clusters_agent_token_key`;
      await sql`ALTER TABLE clusters ADD COLUMN IF NOT EXISTS metrics_status TEXT DEFAULT 'disabled'`;
      await sql`ALTER TABLE clusters ADD COLUMN IF NOT EXISTS metrics_error TEXT`;

      await sql`ALTER TABLE incidents DROP CONSTRAINT IF EXISTS incidents_cluster_id_fkey`;
      await sql`ALTER TABLE incidents ADD CONSTRAINT incidents_cluster_id_fkey FOREIGN KEY (cluster_id) REFERENCES clusters(cluster_id) ON DELETE SET NULL`;
      await sql`ALTER TABLE incidents DROP CONSTRAINT IF EXISTS incidents_rule_id_fkey`;
      await sql`ALTER TABLE incidents ADD CONSTRAINT incidents_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES alert_rules(rule_id) ON DELETE SET NULL`;
      await sql`ALTER TABLE alerts_sent DROP CONSTRAINT IF EXISTS alerts_sent_channel_id_fkey`;
      await sql`ALTER TABLE alerts_sent ADD CONSTRAINT alerts_sent_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES channels(channel_id) ON DELETE SET NULL`;

      await sql`
      CREATE TABLE IF NOT EXISTS user_organizations (
        user_id TEXT,
        org_id TEXT,
        role TEXT NOT NULL DEFAULT 'member',
        created_at TIMESTAMPTZ DEFAULT now(),
        PRIMARY KEY (user_id, org_id)
      )`;

      await sql`
      INSERT INTO user_organizations (user_id, org_id, role)
      SELECT user_id, org_id, role FROM users
      ON CONFLICT (user_id, org_id) DO NOTHING
    `;

      try {
        await sql.unsafe(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key`);
        await sql.unsafe(`ALTER TABLE users ADD CONSTRAINT users_email_org_id_key UNIQUE (email, org_id)`);
        console.log("✅ Modified users table uniqueness constraint to composite (email, org_id)");
      } catch (err: any) {
        // Ignore if constraint already modified/added
      }

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

      await sql`
      CREATE TABLE IF NOT EXISTS group_members (
        group_id   TEXT REFERENCES groups(group_id) ON DELETE CASCADE,
        user_id    TEXT REFERENCES users(user_id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT now(),
        PRIMARY KEY (group_id, user_id)
      )
    `;

      await sql`
      CREATE TABLE IF NOT EXISTS retention_policies (
        org_id          TEXT PRIMARY KEY REFERENCES organizations(org_id) ON DELETE CASCADE,
        activity_days   INT DEFAULT 0,
        incident_days   INT DEFAULT 0,
        updated_at      TIMESTAMPTZ DEFAULT now()
      )
    `;

      await sql`
      CREATE TABLE IF NOT EXISTS retention_runs (
        run_id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        org_id          TEXT REFERENCES organizations(org_id) ON DELETE CASCADE,
        run_type        TEXT NOT NULL,
        items_purged    INT NOT NULL,
        completed_at    TIMESTAMPTZ DEFAULT now()
      )
    `;

      await sql`
      ALTER TABLE retention_policies 
      ADD COLUMN IF NOT EXISTS purge_interval_hours INT DEFAULT 4,
      ADD COLUMN IF NOT EXISTS last_logs_purge_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS last_incidents_purge_at TIMESTAMPTZ
    `;

      await sql`
      ALTER TABLE retention_runs 
      ADD COLUMN IF NOT EXISTS purged_details JSONB DEFAULT '[]'::jsonb
    `;

      await sql`
      CREATE TABLE IF NOT EXISTS user_notifications (
        notification_id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        org_id          TEXT REFERENCES organizations(org_id) ON DELETE CASCADE,
        user_id         TEXT REFERENCES users(user_id) ON DELETE CASCADE,
        incident_id     TEXT,
        cluster_id      TEXT REFERENCES clusters(cluster_id) ON DELETE SET NULL,
        title           TEXT NOT NULL,
        sub             TEXT NOT NULL,
        severity        TEXT DEFAULT 'warning',
        type            TEXT DEFAULT 'crash',
        is_read         BOOLEAN DEFAULT false,
        is_dismissed    BOOLEAN DEFAULT false,
        created_at      TIMESTAMPTZ DEFAULT now()
      )
    `;

      // Drop constraint to keep incident_id text references intact when an incident is deleted
      await sql`
      ALTER TABLE user_notifications 
      DROP CONSTRAINT IF EXISTS user_notifications_incident_id_fkey
    `;

      await sql`
      ALTER TABLE user_notifications 
      ADD COLUMN IF NOT EXISTS cluster_id TEXT REFERENCES clusters(cluster_id) ON DELETE SET NULL
    `;

      await sql`ALTER TABLE user_alert_preferences ADD COLUMN IF NOT EXISTS notifications_muted BOOLEAN DEFAULT false`;
      await sql`ALTER TABLE user_alert_preferences ADD COLUMN IF NOT EXISTS notifications_muted_until TIMESTAMPTZ`;

      console.log("✅ Migrations complete");
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
          'admin@srevox.local', ${hashed}, 'Admin User', 'admin'
        ) ON CONFLICT DO NOTHING
      `;
        console.log("✅ Default admin: admin@srevox.local / admin123");
      }
    } catch (err) {
      console.warn("[seed] skipped:", err);
    }
  }

  const PORT = Number(process.env.API_PORT || 4000);
  try {
    await runMigrations();
    await seedDefaults();
    await app.listen({ port: PORT, host: "0.0.0.0" });
    console.log(`🚀 Srevox API running on http://localhost:${PORT}`);

    // Run infrastructure nodes evaluation loop every 60 seconds
    setInterval(() => {
      checkClusterNodesAndMetrics().catch((err: any) => {
        console.error("[infra-evaluator] interval check error:", err.message);
      });
    }, 60000);

    // Initial check on startup
    checkClusterNodesAndMetrics().catch((err: any) => {
      console.error("[infra-evaluator] startup check error:", err.message);
    });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();