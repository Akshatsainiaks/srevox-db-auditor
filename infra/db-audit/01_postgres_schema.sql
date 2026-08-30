-- =============================================================================
-- AI Database Audit & Change Intelligence Platform - PostgreSQL Metadata & RLS Schema
-- =============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tenants Table
CREATE TABLE IF NOT EXISTS audit_tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Projects Table
CREATE TABLE IF NOT EXISTS audit_projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES audit_tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    environment VARCHAR(50) NOT NULL DEFAULT 'production', -- production, staging, dev
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Connectors Table (Target DB Configurations with Vault Secret Reference)
CREATE TABLE IF NOT EXISTS audit_connectors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES audit_tenants(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES audit_projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    db_type VARCHAR(50) NOT NULL, -- postgresql, mysql, mssql, mongodb, tidb, oceanbase, clickhouse, vector_db
    capture_mode VARCHAR(20) NOT NULL DEFAULT 'log_based', -- log_based | polling
    vault_secret_path VARCHAR(512) NOT NULL, -- Path to AES-256 encrypted creds in Vault
    config JSONB NOT NULL DEFAULT '{}', -- host, port, database_name, schema_filter, etc.
    status VARCHAR(50) NOT NULL DEFAULT 'active', -- active, paused, error
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Masking Policies Table (Pre-Persistence Memory Masking Rules)
CREATE TABLE IF NOT EXISTS audit_masking_policies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES audit_tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    target_schema VARCHAR(255) DEFAULT '*',
    target_table VARCHAR(255) DEFAULT '*',
    target_column VARCHAR(255) NOT NULL,
    mask_type VARCHAR(50) NOT NULL, -- redact, sha256, regex_replace, partial_token
    pattern VARCHAR(512), -- Regex pattern if mask_type = regex_replace
    replacement VARCHAR(255) DEFAULT '***',
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. User RBAC Table
CREATE TABLE IF NOT EXISTS audit_user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES audit_tenants(id) ON DELETE CASCADE,
    user_email VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL, -- Owner, Admin, Auditor, Developer, Viewer
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_tenant_user UNIQUE(tenant_id, user_email)
);

-- =============================================================================
-- Row-Level Security (RLS) Policies (Defense-in-Depth)
-- =============================================================================

ALTER TABLE audit_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_connectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_masking_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_user_roles ENABLE ROW LEVEL SECURITY;

-- Tenant Isolation RLS Policies using session context 'app.current_tenant_id'
CREATE POLICY tenant_isolation_projects ON audit_projects
    FOR ALL USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

CREATE POLICY tenant_isolation_connectors ON audit_connectors
    FOR ALL USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

CREATE POLICY tenant_isolation_masking ON audit_masking_policies
    FOR ALL USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

CREATE POLICY tenant_isolation_user_roles ON audit_user_roles
    FOR ALL USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
