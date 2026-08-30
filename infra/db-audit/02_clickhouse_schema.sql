-- =============================================================================
-- AI Database Audit & Change Intelligence Platform - ClickHouse Audit Storage Schema
-- =============================================================================

CREATE TABLE IF NOT EXISTS audit_events (
    tenant_id UUID,
    project_id UUID,
    connector_id UUID,
    database String,
    schema String,
    table String,
    operation Enum8('INSERT' = 1, 'UPDATE' = 2, 'DELETE' = 3, 'DDL' = 4),
    primary_key String, -- JSON encoded primary key object e.g. {"id":"123"}
    before String,      -- JSON encoded record state before change
    after String,       -- JSON encoded record state after change
    changed_fields Array(String),
    masked_fields Array(String),
    commit_timestamp DateTime64(3, 'UTC'),
    ingest_timestamp DateTime64(3, 'UTC') DEFAULT now64(3),
    transaction_id String,
    db_user String,
    application_name String,
    client_ip String,
    session_id String,
    execution_metadata String, -- JSON string for extra execution context
    record_hash String,        -- SHA-256(prev_hash + tenant_id + commit_timestamp + payload)
    prev_hash String,          -- Chained SHA-256 hash of previous row
    capture_mode Enum8('log_based' = 1, 'polling' = 2)
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(commit_timestamp)
PRIMARY KEY (tenant_id, database, schema, table)
ORDER BY (tenant_id, database, schema, table, commit_timestamp);
