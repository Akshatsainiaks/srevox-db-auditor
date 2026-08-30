use sha2::{Digest, Sha256};

/// Computes a SHA-256 record hash chained to the previous row hash.
pub fn compute_record_hash(
    prev_hash: &str,
    tenant_id: &str,
    commit_ts: &str,
    database: &str,
    table: &str,
    operation: &str,
    payload: &str,
) -> String {
    let mut hasher = Sha256::new();
    hasher.update(prev_hash.as_bytes());
    hasher.update(tenant_id.as_bytes());
    hasher.update(commit_ts.as_bytes());
    hasher.update(database.as_bytes());
    hasher.update(table.as_bytes());
    hasher.update(operation.as_bytes());
    hasher.update(payload.as_bytes());
    let result = hasher.finalize();
    hex::encode(result)
}
