-- Srevox Database Schema
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE organizations (
  org_id     TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name       TEXT NOT NULL,
  slug       TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE users (
  user_id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  org_id          TEXT REFERENCES organizations(org_id) ON DELETE CASCADE,
  email           TEXT UNIQUE NOT NULL,
  hashed_password TEXT NOT NULL,
  full_name       TEXT DEFAULT '',
  role            TEXT DEFAULT 'member',
  created_at      TIMESTAMPTZ DEFAULT now(),
  last_login_at       TIMESTAMPTZ,
  is_active           BOOLEAN DEFAULT TRUE,
  invited_by          TEXT,
  invite_token        TEXT,
  invite_expires_at   TIMESTAMPTZ,
  personal_channel_id TEXT
);

CREATE TABLE clusters (
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
);

CREATE TABLE channels (
  channel_id       TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  org_id           TEXT REFERENCES organizations(org_id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  type             TEXT NOT NULL,
  config_encrypted TEXT NOT NULL,
  enabled          BOOLEAN DEFAULT true,
  last_success_at  TIMESTAMPTZ,
  last_error       TEXT,
  created_at       TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE alert_rules (
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
);

CREATE TABLE incidents (
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
);

CREATE TABLE alerts_sent (
  alert_sent_id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  incident_id   TEXT REFERENCES incidents(incident_id) ON DELETE CASCADE,
  channel_id    TEXT REFERENCES channels(channel_id) ON DELETE SET NULL,
  channel_type  TEXT NOT NULL,
  status        TEXT NOT NULL,
  error_message TEXT,
  sent_at       TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE activity_log (
  activity_log_id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  org_id          TEXT,
  user_id         TEXT,
  action          TEXT NOT NULL,
  resource        TEXT,
  resource_id     TEXT,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_incidents_org_status ON incidents(org_id, status);
CREATE INDEX idx_incidents_cluster    ON incidents(cluster_id);
CREATE INDEX idx_incidents_first_seen ON incidents(first_seen_at DESC);
CREATE INDEX idx_clusters_org         ON clusters(org_id);
CREATE INDEX idx_rules_cluster        ON alert_rules(cluster_id);
CREATE INDEX idx_channels_org         ON channels(org_id);
CREATE INDEX idx_alerts_sent_incident ON alerts_sent(incident_id);
CREATE INDEX idx_activity_org         ON activity_log(org_id, created_at DESC);

-- Seed default org
INSERT INTO organizations (org_id, name, slug)
VALUES ('orgjncj44t4hb4', 'My Organization', 'my-org');

CREATE TABLE IF NOT EXISTS service_owners (
  service_owner_id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  org_id           TEXT REFERENCES organizations(org_id) ON DELETE CASCADE,
  cluster_id       TEXT REFERENCES clusters(cluster_id) ON DELETE CASCADE,
  namespace        TEXT,
  pod_prefix       TEXT,
  user_id          TEXT REFERENCES users(user_id) ON DELETE CASCADE,
  channel_id       TEXT REFERENCES channels(channel_id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_settings (
  user_id    TEXT PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
  provider   TEXT DEFAULT 'groq',
  model      TEXT DEFAULT 'llama-3.1-8b-instant',
  api_key    TEXT DEFAULT '',
  ollama_url TEXT DEFAULT 'http://localhost:11434',
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed default admin user (password: admin123)
INSERT INTO users (user_id, org_id, email, hashed_password, full_name, role, is_active)
VALUES (
  'usrjncj44t4hb4',
  'orgjncj44t4hb4',
  'admin@srevox.local',
  crypt('admin123', gen_salt('bf')),
  'Admin User',
  'admin',
  true
) ON CONFLICT (email) DO NOTHING;

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
);

CREATE TABLE IF NOT EXISTS resource_alerts (
  resource_alert_id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  org_id            TEXT REFERENCES organizations(org_id) ON DELETE CASCADE,
  cluster_id        TEXT REFERENCES clusters(cluster_id) ON DELETE CASCADE,
  resource_type     TEXT NOT NULL,
  threshold_pct     INT DEFAULT 80,
  target            TEXT DEFAULT 'all',
  target_name       TEXT DEFAULT '',
  severity          TEXT DEFAULT 'warning',
  enabled           BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_resource_alerts_org ON resource_alerts(org_id);

CREATE TABLE IF NOT EXISTS retention_policies (
  org_id          TEXT PRIMARY KEY REFERENCES organizations(org_id) ON DELETE CASCADE,
  activity_days   INT DEFAULT 0,
  incident_days   INT DEFAULT 0,
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS service_owner_settings (
  org_id                          TEXT PRIMARY KEY REFERENCES organizations(org_id) ON DELETE CASCADE,
  default_alert_source_channel_id TEXT,
  default_alert_cc                TEXT,
  default_alert_bcc               TEXT,
  created_at                      TIMESTAMPTZ DEFAULT now(),
  updated_at                      TIMESTAMPTZ DEFAULT now()
);
