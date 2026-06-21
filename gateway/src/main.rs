use axum::{
    Router,
    extract::State,
    http::{HeaderMap, HeaderValue, Method, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, post},
};
use reqwest::Client;
use serde::Deserialize;
use std::{net::SocketAddr, sync::Arc};
use tokio_stream::StreamExt;
use tower_http::cors::{Any, CorsLayer};
use tracing::info;

#[derive(Clone)]
struct AppState {
    http: Client,
    nlweb_url: String,
}

#[derive(Deserialize)]
struct SearchRequest {
    query: String,
    #[serde(default = "default_site")]
    site: String,
}

fn default_site() -> String {
    "furnova.com".to_string()
}

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt()
        .with_env_filter(
            std::env::var("RUST_LOG").unwrap_or_else(|_| "info,furnova_gateway=debug".into()),
        )
        .init();

    let nlweb_port = std::env::var("NLWEB_PORT").unwrap_or_else(|_| "8000".into());
    let nlweb_url = format!("http://127.0.0.1:{nlweb_port}");

    let state = Arc::new(AppState {
        http: Client::builder()
            .timeout(std::time::Duration::from_secs(120))
            .build()
            .expect("HTTP client"),
        nlweb_url,
    });

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
        .allow_headers(Any);

    let app = Router::new()
        .route("/health", get(health))
        .route("/search", post(search_proxy))
        .with_state(state)
        .layer(cors);

    let gateway_port: u16 = std::env::var("GATEWAY_PORT")
        .unwrap_or_else(|_| "3000".into())
        .parse()
        .expect("Puerto válido");

    let addr = SocketAddr::from(([127, 0, 0, 1], gateway_port));
    info!("Gateway escuchando en http://{addr}");

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

async fn health() -> &'static str {
    "ok"
}

/// Proxy SSE: recibe la query del frontend, la reenvía a NLWeb y hace streaming
/// de vuelta al cliente sin bufferizar la respuesta completa.
async fn search_proxy(
    State(state): State<Arc<AppState>>,
    axum::Json(payload): axum::Json<SearchRequest>,
) -> Response {
    let nlweb_body = serde_json::json!({
        "query": payload.query,
        "site":  payload.site,
        "meta":  { "version": "0.55" }
    });

    let upstream = state
        .http
        .post(format!("{}/ask", state.nlweb_url))
        .header("Content-Type", "application/json")
        .json(&nlweb_body)
        .send()
        .await;

    match upstream {
        Err(e) => {
            tracing::error!("Error conectando con NLWeb: {e}");
            (StatusCode::BAD_GATEWAY, format!("NLWeb unreachable: {e}")).into_response()
        }
        Ok(resp) => {
            let status = resp.status();
            let mut headers = HeaderMap::new();
            headers.insert("Content-Type", HeaderValue::from_static("text/event-stream"));
            headers.insert("Cache-Control", HeaderValue::from_static("no-cache"));
            headers.insert("X-Accel-Buffering", HeaderValue::from_static("no"));

            // Stream de bytes del upstream directamente al cliente
            let byte_stream = resp.bytes_stream().map(|chunk| {
                chunk.map_err(|e| std::io::Error::new(std::io::ErrorKind::BrokenPipe, e))
            });

            let body = axum::body::Body::from_stream(byte_stream);
            (status, headers, body).into_response()
        }
    }
}
