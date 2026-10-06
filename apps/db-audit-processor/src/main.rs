mod crypto;
mod masking;
mod models;
mod postgres_cdc;

use chrono::Utc;
use models::{AuditEvent, CaptureMode, Operation};
use std::env;
use uuid::Uuid;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt::init();
    tracing::info!("🚀 Starting Srevox Rust Streaming Audit Processor (Phase 1)...");

    let clickhouse_url = env::var("CLICKHOUSE_URL").unwrap_or_else(|_| "http://localhost:8123".to_string());
    tracing::info!("ClickHouse Endpoint: {}", clickhouse_url);

    // Initialize Native PostgreSQL CDC Stream Listener dynamically
    let pg_host = env::var("POSTGRES_HOST").unwrap_or_default();
    let pg_user = env::var("POSTGRES_USER").unwrap_or_else(|_| "srevox".to_string());
    let pg_pass = env::var("POSTGRES_PASSWORD").unwrap_or_default();
    let pg_db = env::var("POSTGRES_DB").unwrap_or_default();
    let pg_port: u16 = env::var("POSTGRES_PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(5432);

    if !pg_host.is_empty() {
        let _ = postgres_cdc::start_postgres_cdc_listener(&pg_host, pg_port, &pg_user, &pg_pass, &pg_db).await;
    } else {
        tracing::info!("📡 Srevox CDC Processor initialized — awaiting dynamic connector registrations");
    }

    // Sample Audit Event Normalization & Pipeline Test
    let mut event = AuditEvent {
        tenant_id: Uuid::new_v4(),
        project_id: Uuid::new_v4(),
        connector_id: Uuid::new_v4(),
        database: "prod_db".to_string(),
        schema: "public".to_string(),
        table: "users".to_string(),
        operation: Operation::Update,
        primary_key: serde_json::json!({"id": 101}),
        before: Some(serde_json::json!({"id": 101, "email": "user@example.com", "ssn": "000-12-3456"})),
        after: Some(serde_json::json!({"id": 101, "email": "user_new@example.com", "ssn": "000-12-3456"})),
        changed_fields: vec!["email".to_string()],
        masked_fields: vec![],
        commit_timestamp: Utc::now().to_rfc3339(),
        ingest_timestamp: Utc::now().to_rfc3339(),
        transaction_id: "tx_9981".to_string(),
        db_user: "app_user".to_string(),
        application_name: "srevox-backend".to_string(),
        client_ip: "10.0.0.45".to_string(),
        session_id: "sess_102".to_string(),
        execution_metadata: None,
        record_hash: "".to_string(),
        prev_hash: "GENESIS_HASH_00000000000000000000000000000000000000000000000000000000".to_string(),
        capture_mode: CaptureMode::LogBased,
    };

    // Apply memory masking
    let masking_rules = vec![models::MaskingRule {
        target_schema: "public".to_string(),
        target_table: "users".to_string(),
        target_column: "ssn".to_string(),
        mask_type: "redact".to_string(),
        replacement: "***-**-****".to_string(),
    }];

    masking::apply_pre_persistence_masking(&mut event, &masking_rules);

    // Compute cryptographic hash
    let payload = serde_json::to_string(&event.after)?;
    event.record_hash = crypto::compute_record_hash(
        &event.prev_hash,
        &event.tenant_id.to_string(),
        &event.commit_timestamp,
        &event.database,
        &event.table,
        "UPDATE",
        &payload,
    );

    tracing::info!("✅ Test Event Masked Fields: {:?}", event.masked_fields);
    tracing::info!("🔐 Computed Cryptographic Record Hash: {}", event.record_hash);
    tracing::info!("📡 Srevox Streaming Audit Engine actively listening... (Press Ctrl+C to stop)");

    // Keep streaming listener running continuously
    tokio::signal::ctrl_c().await?;
    tracing::info!("🛑 Shutting down Rust Streaming Audit Processor.");

    Ok(())
}
