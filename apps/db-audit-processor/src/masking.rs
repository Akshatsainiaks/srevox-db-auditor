use crate::models::{AuditEvent, MaskingRule};
use sha2::{Digest, Sha256};

pub fn apply_pre_persistence_masking(event: &mut AuditEvent, rules: &[MaskingRule]) {
    for rule in rules {
        if rule.target_schema != "*" && rule.target_schema != event.schema {
            continue;
        }
        if rule.target_table != "*" && rule.target_table != event.table {
            continue;
        }

        let col_name = &rule.target_column;

        // Masking in `after` JSON object
        if let Some(ref mut after_obj) = event.after {
            if let Some(val) = after_obj.get_mut(col_name) {
                if !event.masked_fields.contains(col_name) {
                    event.masked_fields.push(col_name.clone());
                }
                *val = mask_value(val, &rule.mask_type, &rule.replacement);
            }
        }

        // Masking in `before` JSON object
        if let Some(ref mut before_obj) = event.before {
            if let Some(val) = before_obj.get_mut(col_name) {
                if !event.masked_fields.contains(col_name) {
                    event.masked_fields.push(col_name.clone());
                }
                *val = mask_value(val, &rule.mask_type, &rule.replacement);
            }
        }
    }
}

fn mask_value(val: &serde_json::Value, mask_type: &str, replacement: &str) -> serde_json::Value {
    match mask_type {
        "sha256" => {
            let str_val = val.to_string();
            let mut hasher = Sha256::new();
            hasher.update(str_val.as_bytes());
            serde_json::Value::String(hex::encode(hasher.finalize()))
        }
        "redact" | _ => serde_json::Value::String(replacement.to_string()),
    }
}
