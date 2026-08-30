use axum::{
    extract::{State, Query},
    http::{StatusCode, HeaderMap},
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::postgres::PgPoolOptions;
use sqlx::{Pool, Postgres, Row};
use std::env;
use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};
use jsonwebtoken::{decode, DecodingKey, Validation, Algorithm};
use chrono::{DateTime, Utc};

struct AppState {
    db: Pool<Postgres>,
    jwt_secret: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct Claims {
    sub: String,
    org_id: String,
    role: String,
    email: String,
    scope: Option<String>,
    exp: usize,
}

#[derive(Debug, Deserialize)]
struct CreateActivity {
    org_id: String,
    user_id: Option<String>,
    action: String,
    resource: Option<String>,
    resource_id: Option<String>,
    metadata: Option<Value>,
}

#[derive(Debug, Deserialize)]
struct ActivityQuery {
    user_id: Option<String>,
    group_id: Option<String>,
    duration: Option<String>,
    search: Option<String>,
    activity_id: Option<String>,
    limit: Option<i64>,
    offset: Option<i64>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
struct ActivityLogItem {
    activity_log_id: String,
    org_id: String,
    user_id: Option<String>,
    action: String,
    resource: Option<String>,
    resource_id: Option<String>,
    metadata: Option<Value>,
    created_at: DateTime<Utc>,
    user_name: Option<String>,
    user_email: Option<String>,
}

#[tokio::main]
async fn main() {
    // Load .env from local or api parent directory
    dotenvy::from_path("./.env").ok();
    dotenvy::from_path("../api/.env").ok();
    dotenvy::from_path("../.env").ok();
    dotenvy::from_path("../../.env").ok();
    dotenvy::dotenv().ok();

    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    let pg_host = env::var("POSTGRES_HOST").unwrap_or_else(|_| "localhost".to_string());
    let pg_port = env::var("POSTGRES_PORT").unwrap_or_else(|_| "5432".to_string());
    let pg_db = env::var("POSTGRES_DB").unwrap_or_else(|_| "srevox".to_string());
    let pg_user = env::var("POSTGRES_USER").unwrap_or_else(|_| "srevox".to_string());
    let pg_pass = env::var("POSTGRES_PASSWORD").unwrap_or_else(|_| "srevox_dev".to_string());
    let jwt_secret = env::var("BACKEND_SECRET_KEY").unwrap_or_else(|_| "change_me_in_production_min_32_chars".to_string());

    let db_url = format!("postgres://{}:{}@{}:{}/{}", pg_user, pg_pass, pg_host, pg_port, pg_db);
    println!("🔌 Connecting to database...");

    let pool = PgPoolOptions::new()
        .max_connections(20)
        .connect(&db_url)
        .await
        .expect("❌ Failed to connect to PostgreSQL");

    println!("✅ Connected to database");

    let state = Arc::new(AppState {
        db: pool,
        jwt_secret,
    });

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/api/activities", post(create_activity).get(get_activities).delete(delete_activities))
        .route("/api/activities/health", get(health_check))
        .layer(cors)
        .with_state(state);

    let app_port = env::var("ACTIVITY_PORT").unwrap_or_else(|_| "5005".to_string());
    let addr = format!("0.0.0.0:{}", app_port);
    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    println!("🚀 Rust Activity Service running on http://localhost:{}", app_port);
    axum::serve(listener, app).await.unwrap();
}

async fn health_check() -> &'static str {
    "OK"
}

// Extractor helper to verify token and extract claims
fn authenticate_request(headers: &HeaderMap, secret: &str) -> Result<Claims, (StatusCode, Json<Value>)> {
    let token = headers
        .get("X-Sudo-Token")
        .or_else(|| headers.get("Authorization"))
        .and_then(|val| val.to_str().ok())
        .and_then(|auth_str| {
            if auth_str.starts_with("Bearer ") {
                Some(&auth_str[7..])
            } else {
                Some(auth_str)
            }
        });

    let token_str = match token {
        Some(t) => t,
        None => {
            return Err((
                StatusCode::UNAUTHORIZED,
                Json(serde_json::json!({ "detail": "Authentication token missing" })),
            ))
        }
    };

    let mut validation = Validation::new(Algorithm::HS256);
    validation.validate_exp = true;
    let key = DecodingKey::from_secret(secret.as_bytes());

    match decode::<Claims>(token_str, &key, &validation) {
        Ok(token_data) => {
            let claims = token_data.claims;
            // Check that they unlocked sudo mode
            if claims.scope.as_deref() != Some("sudo") {
                return Err((
                    StatusCode::FORBIDDEN,
                    Json(serde_json::json!({ "detail": "Sudo authentication required. Please verify password." })),
                ));
            }
            Ok(claims)
        }
        Err(_) => Err((
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({ "detail": "Invalid or expired session token" })),
        )),
    }
}

fn generate_activity_id() -> String {
    let mut id = String::with_capacity(16);
    id.push_str("act");
    let chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let nanosec = chrono::Utc::now().timestamp_nanos_opt().unwrap_or(1234567) as u64;
    let mut seed = nanosec;
    for _ in 0..12 {
        seed = seed.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
        let idx = (seed % chars.len() as u64) as usize;
        id.push(chars.chars().nth(idx).unwrap());
    }
    id
}

async fn create_activity(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<CreateActivity>,
) -> impl IntoResponse {
    let metadata_value = payload.metadata.unwrap_or(serde_json::Value::Null);
    let log_id = generate_activity_id();

    let result = sqlx::query(
        r#"
        INSERT INTO activity_log (activity_log_id, org_id, user_id, action, resource, resource_id, metadata)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING activity_log_id
        "#,
    )
    .bind(&log_id)
    .bind(&payload.org_id)
    .bind(&payload.user_id)
    .bind(&payload.action)
    .bind(&payload.resource)
    .bind(&payload.resource_id)
    .bind(&metadata_value)
    .fetch_one(&state.db)
    .await;

    match result {
        Ok(row) => {
            let returned_id: String = row.get("activity_log_id");
            (
                StatusCode::CREATED,
                Json(serde_json::json!({ "activity_log_id": returned_id, "success": true })),
            )
        }
        Err(err) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "detail": format!("Database error: {}", err) })),
        ),
    }
}

async fn get_activities(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<ActivityQuery>,
) -> impl IntoResponse {
    // Authenticate and verify sudo permission
    let claims = match authenticate_request(&headers, &state.jwt_secret) {
        Ok(c) => c,
        Err(err_response) => return err_response.into_response(),
    };

    let limit = query.limit.unwrap_or(50);
    let offset = query.offset.unwrap_or(0);

    // Build duration condition
    let duration_filter = query.duration.unwrap_or_else(|| "all".to_string());
    let since_time = match duration_filter.as_str() {
        "24h" => Some(Utc::now() - chrono::Duration::hours(24)),
        "7d" => Some(Utc::now() - chrono::Duration::days(7)),
        "30d" => Some(Utc::now() - chrono::Duration::days(30)),
        _ => None,
    };

    let search_pattern = query.search.map(|s| format!("%{}%", s.to_lowercase()));

    // DB query retrieving activity items filtered by user, group, duration, and search parameters
    let items_res = sqlx::query_as::<_, ActivityLogItem>(
        r#"
        SELECT 
            al.activity_log_id,
            al.org_id,
            al.user_id,
            al.action,
            al.resource,
            al.resource_id,
            al.metadata,
            al.created_at,
            u.full_name as user_name,
            u.email      as user_email
        FROM activity_log al
        LEFT JOIN users u ON al.user_id = u.user_id
        WHERE al.org_id = $1
          AND al.action != 'view_audit_logs_settings'
          AND ($2::text IS NULL OR al.user_id = $2)
          AND ($3::text IS NULL OR al.user_id IN (SELECT user_id FROM group_members WHERE group_id = $3))
          AND ($4::timestamptz IS NULL OR al.created_at >= $4)
          AND (
            $5::text IS NULL OR 
            LOWER(al.action) LIKE $5 OR 
            LOWER(al.resource) LIKE $5 OR 
            LOWER(COALESCE(u.full_name, '')) LIKE $5 OR 
            LOWER(COALESCE(u.email, '')) LIKE $5
          )
          AND ($8::text IS NULL OR al.activity_log_id = $8)
        ORDER BY al.created_at DESC
        LIMIT $6 OFFSET $7
        "#
      )
      .bind(&claims.org_id)
      .bind(query.user_id)
      .bind(query.group_id)
      .bind(since_time)
      .bind(search_pattern)
      .bind(limit)
      .bind(offset)
      .bind(query.activity_id)
      .fetch_all(&state.db)
      .await;

    match items_res {
        Ok(items) => (StatusCode::OK, Json(serde_json::json!({ "activities": items }))).into_response(),
        Err(err) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "detail": format!("Failed to query logs: {}", err) })),
        ).into_response(),
    }
}

#[derive(Debug, Deserialize)]
struct DeleteActivitiesRequest {
    activity_log_ids: Option<Vec<String>>,
    clear_all: Option<bool>,
}

async fn delete_activities(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(payload): Json<DeleteActivitiesRequest>,
) -> impl IntoResponse {
    // Authenticate and verify sudo permission
    let claims = match authenticate_request(&headers, &state.jwt_secret) {
        Ok(c) => c,
        Err(err_response) => return err_response.into_response(),
    };

    let clear_all = payload.clear_all.unwrap_or(false);

    if clear_all {
        let result = sqlx::query("DELETE FROM activity_log WHERE org_id = $1")
            .bind(&claims.org_id)
            .execute(&state.db)
            .await;

        match result {
            Ok(_) => (
                StatusCode::OK,
                Json(serde_json::json!({ "success": true, "message": "All activity logs deleted successfully" })),
            ).into_response(),
            Err(err) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "detail": format!("Database error: {}", err) })),
            ).into_response(),
        }
    } else if let Some(ids) = payload.activity_log_ids {
        if ids.is_empty() {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({ "detail": "No log IDs specified" })),
            ).into_response();
        }

        let result = sqlx::query("DELETE FROM activity_log WHERE org_id = $1 AND activity_log_id = ANY($2)")
            .bind(&claims.org_id)
            .bind(&ids)
            .execute(&state.db)
            .await;

        match result {
            Ok(_) => (
                StatusCode::OK,
                Json(serde_json::json!({ "success": true, "message": "Selected activity logs deleted successfully" })),
            ).into_response(),
            Err(err) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "detail": format!("Database error: {}", err) })),
            ).into_response(),
        }
    } else {
        (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "detail": "Must specify activity_log_ids or clear_all" })),
        ).into_response()
    }
}
