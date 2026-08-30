use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CaptureMode {
    LogBased,
    Polling,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "UPPERCASE")]
pub enum Operation {
    Insert,
    Update,
    Delete,
    Ddl,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditEvent {
    pub tenant_id: Uuid,
    pub project_id: Uuid,
    pub connector_id: Uuid,
    pub database: String,
    pub schema: String,
    pub table: String,
    pub operation: Operation,
    pub primary_key: serde_json::Value,
    pub before: Option<serde_json::Value>,
    pub after: Option<serde_json::Value>,
    pub changed_fields: Vec<String>,
    pub masked_fields: Vec<String>,
    pub commit_timestamp: String, // ISO 8601 UTC
    pub ingest_timestamp: String, // ISO 8601 UTC
    pub transaction_id: String,
    pub db_user: String,
    pub application_name: String,
    pub client_ip: String,
    pub session_id: String,
    pub execution_metadata: Option<serde_json::Value>,
    pub record_hash: String,
    pub prev_hash: String,
    pub capture_mode: CaptureMode,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MaskingRule {
    pub target_schema: String,
    pub target_table: String,
    pub target_column: String,
    pub mask_type: String, // "redact" | "sha256" | "replacement"
    pub replacement: String,
}
