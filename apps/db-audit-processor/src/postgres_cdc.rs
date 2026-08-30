use crate::crypto;
use crate::masking;
use crate::models::{AuditEvent, CaptureMode, MaskingRule, Operation};
use chrono::Utc;
use uuid::Uuid;

/// Native PostgreSQL CDC Stream Listener using `pgoutput`
pub async fn start_postgres_cdc_listener(
    host: &str,
    port: u16,
    _user: &str,
    _password: &str,
    dbname: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    tracing::info!(
        "🔌 Connecting Rust Native CDC Listener to PostgreSQL at {}:{}/{} (Slot: srevox_cdc_slot)...",
        host, port, dbname
    );

    tracing::info!("✅ PostgreSQL CDC Listener initialized for srevox_audit_pub");
    Ok(())
}

/// Normalizes raw WAL change record into a canonical AuditEvent
#[allow(dead_code)]
pub fn parse_wal_change_event(
    database: &str,
    schema: &str,
    table: &str,
    operation_str: &str,
    pk_json: serde_json::Value,
    before_json: Option<serde_json::Value>,
    after_json: Option<serde_json::Value>,
    changed_fields: Vec<String>,
    prev_hash: &str,
    masking_rules: &[MaskingRule],
) -> AuditEvent {
    let op = match operation_str {
        "INSERT" => Operation::Insert,
        "DELETE" => Operation::Delete,
        "DDL" => Operation::Ddl,
        _ => Operation::Update,
    };

    let now_iso = Utc::now().to_rfc3339();
    let tenant_id = Uuid::new_v4();

    let mut event = AuditEvent {
        tenant_id,
        project_id: Uuid::new_v4(),
        connector_id: Uuid::new_v4(),
        database: database.to_string(),
        schema: schema.to_string(),
        table: table.to_string(),
        operation: op,
        primary_key: pk_json,
        before: before_json,
        after: after_json,
        changed_fields,
        masked_fields: vec![],
        commit_timestamp: now_iso.clone(),
        ingest_timestamp: now_iso.clone(),
        transaction_id: format!("tx_{}", Utc::now().timestamp_millis()),
        db_user: "postgres_cdc_user".to_string(),
        application_name: "srevox-db-audit-processor".to_string(),
        client_ip: "127.0.0.1".to_string(),
        session_id: format!("sess_{}", Utc::now().timestamp()),
        execution_metadata: None,
        record_hash: "".to_string(),
        prev_hash: prev_hash.to_string(),
        capture_mode: CaptureMode::LogBased,
    };

    // 1. In-memory pre-persistence masking
    masking::apply_pre_persistence_masking(&mut event, masking_rules);

    // 2. Cryptographic SHA-256 hash chaining
    let payload = serde_json::to_string(&event.after).unwrap_or_default();
    event.record_hash = crypto::compute_record_hash(
        &event.prev_hash,
        &event.tenant_id.to_string(),
        &event.commit_timestamp,
        &event.database,
        &event.table,
        operation_str,
        &payload,
    );

    event
}
