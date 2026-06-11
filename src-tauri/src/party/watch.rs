use crate::Result;
use crate::party::browsers::Browser;
use anyhow::{Context, anyhow};
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::process::{Child, Command};
use std::sync::atomic::{AtomicUsize, Ordering};
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::fs;
use tokio::sync::Mutex;
use tokio::sync::oneshot;
use tokio_tungstenite::connect_async;
use tokio_tungstenite::tungstenite::Message as WsMessage;
use url::Url;

const NETFLIX_URL: &str = "https://www.netflix.com";

pub struct WatchState {
    pub tx: flume::Sender<Request>,
    pub rx: flume::Receiver<Request>,
    pub session: Mutex<Option<Session>>,
}

pub struct Session {
    pub browser: Child,
    pub shutdown: oneshot::Sender<()>,
}

pub struct Request {
    pub id: usize,
    pub payload: String,
    pub response_tx: Option<oneshot::Sender<Value>>,
}

static MSG_ID: AtomicUsize = AtomicUsize::new(1);

#[tauri::command]
pub async fn open_party(
    app: AppHandle,
    browser: Browser,
    state: State<'_, WatchState>,
) -> Result<()> {
    println!("[Watch Party] open_party");

    {
        let mut session = state.session.lock().await;
        if session.is_some() {
            return Err(anyhow!("A watch party browser is already open").into());
        }
        *session = None;
    }

    let mut data_dir = app
        .path()
        .app_data_dir()
        .context("Failed to locate application data directory")?;

    data_dir.push("browser-profile");

    if !data_dir.exists() {
        fs::create_dir_all(&data_dir)
            .await
            .context("Failed to create browser profile directory")?;
    }

    let browser_process = Command::new(browser.path()?)
        .args([
            "--remote-debugging-port=9222",
            &format!("--app={}", NETFLIX_URL),
            &format!("--user-data-dir={}", data_dir.display()),
        ])
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .spawn()
        .context("Failed to launch browser process")?;

    tokio::time::sleep(std::time::Duration::from_secs(2)).await;

    let client = reqwest::Client::new();

    let res = client
        .get("http://127.0.0.1:9222/json")
        .send()
        .await
        .context("Failed to connect to browser debugging port")?;

    let targets: Vec<Value> = res
        .json()
        .await
        .context("Failed to parse browser target list")?;

    let mut ws_url = None;
    for target in targets {
        if let Some(url) = target.get("url").and_then(|u| u.as_str()) {
            if url.contains("netflix.com") {
                ws_url = target
                    .get("webSocketDebuggerUrl")
                    .and_then(|u| u.as_str())
                    .map(|s| s.to_string());
                break;
            }
        }
    }

    let ws_url = ws_url.ok_or_else(|| anyhow!("Netflix tab not found"))?;

    let (ws_stream, _) = connect_async(Url::parse(&ws_url).context("Invalid WebSocket URL")?)
        .await
        .context("Failed to establish WebSocket connection with the browser")?;

    let (mut write, mut read) = ws_stream.split();

    let watching_src = include_str!("scripts/watching.js");
    let init_commands = [
        serde_json::json!({"id": MSG_ID.fetch_add(1, Ordering::SeqCst), "method": "Runtime.enable" }),
        serde_json::json!({"id": MSG_ID.fetch_add(1, Ordering::SeqCst), "method": "Page.enable" }),
        serde_json::json!({"id": MSG_ID.fetch_add(1, Ordering::SeqCst), "method": "Runtime.addBinding", "params": { "name": "sendToTauri" } }),
        serde_json::json!({
            "id": MSG_ID.fetch_add(1, Ordering::SeqCst),
            "method": "Page.addScriptToEvaluateOnNewDocument",
            "params": { "source": watching_src }
        }),
        serde_json::json!({
            "id": MSG_ID.fetch_add(1, Ordering::SeqCst),
            "method": "Runtime.evaluate",
            "params": {
                "expression": watching_src,
                "awaitPromise": true
            }
        }),
    ];

    for cmd in init_commands {
        if write.send(WsMessage::Text(cmd.to_string())).await.is_err() {
            println!("Failed to send init bindings");
        }
    }

    let rx = state.rx.clone();
    let (shutdown_tx, mut shutdown_rx) = oneshot::channel::<()>();

    {
        let mut session = state.session.lock().await;
        *session = Some(Session {
            browser: browser_process,
            shutdown: shutdown_tx,
        });
    }

    tokio::spawn(async move {
        let mut pending_requests: HashMap<usize, oneshot::Sender<serde_json::Value>> =
            HashMap::new();
        let mut external_shutdown = false;

        loop {
            tokio::select! {
                _ = &mut shutdown_rx => {
                    external_shutdown = true;
                    break;
                }
                Ok(req) = rx.recv_async() => {
                    if let Some(tx) = req.response_tx {
                        pending_requests.insert(req.id, tx);
                    }

                    if write.send(WsMessage::Text(req.payload)).await.is_err() {
                        break;
                    }
                }
                msg_opt = read.next() => {
                    let Some(Ok(msg)) = msg_opt else { break; };
                    let WsMessage::Text(text) = msg else {
                        continue;
                    };

                    let Ok(cdp_msg) = serde_json::from_str::<serde_json::Value>(&text) else {
                        continue;
                    };

                    if let Some(id) = cdp_msg.get("id").and_then(|i| i.as_u64()) {
                        if let Some(sender) = pending_requests.remove(&(id as usize)) {
                            let _ = sender.send(cdp_msg.clone());
                            continue;
                        }
                    }

                    let method = cdp_msg.get("method").and_then(|m| m.as_str()).unwrap_or("");

                    if method == "Page.frameNavigated" {
                        if let Some(frame) = cdp_msg
                            .get("params")
                            .and_then(|p| p.get("frame"))
                        {
                            let is_main = frame.get("parentId").is_none();
                            if is_main {
                                let url = frame.get("url").and_then(|u| u.as_str()).unwrap_or("?");
                                if !url.is_empty() && url != "about:blank" {
                                    println!("[Watch Party] nav → {}", url);
                                }
                            }
                        }
                        continue;
                    }

                    if method != "Runtime.bindingCalled" {
                        continue;
                    }

                    let Some(params) = cdp_msg.get("params") else { continue; };
                    if params.get("name").and_then(|n| n.as_str()) != Some("sendToTauri") { continue; }
                    let Some(payload_str) = params.get("payload").and_then(|p| p.as_str()) else { continue; };

                    #[derive(Serialize, Deserialize, Clone, Debug)]
                    #[serde(tag = "type")]
                    enum Message {
                        Watch {
                            video_id: usize,
                            offset: f64,
                            playing: bool,
                            title: String,
                            duration: f64,
                            thumbnail: String,
                        },
                        HeartBeat {
                            offset: f64,
                            playing: bool,
                        },
                        Error(String),
                        Log { text: String },
                    }

                    let Ok(msg) = serde_json::from_str::<Message>(payload_str) else {
                        println!("Unknown struct: {}", payload_str);
                        continue;
                    };

                    match msg {
                        Message::Log { text } => {
                            println!("[Watch Party] {}", text);
                        }
                        Message::Watch { .. } | Message::HeartBeat { .. } => {
                            if let Err(e) = app.emit("watch_party", msg) {
                                println!("[Watch Party] emit fail: {}", e);
                            }
                        }
                        Message::Error(error) => {
                            println!("[Watch Party] error: {}", error);
                        }
                    }
                }
            }
        }
        if !external_shutdown {
            println!("[Watch Party] browser closed");
            let watch_state = app.state::<WatchState>();
            let session_opt = {
                let mut guard = watch_state.session.lock().await;
                guard.take()
            };
            if let Some(mut session) = session_opt {
                let _ = session.browser.kill();
                let _ = session.browser.wait();
            }
            if let Err(e) = app.emit("watch_party_closed", ()) {
                println!("[Watch Party] emit fail: {}", e);
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub async fn close_party(state: State<'_, WatchState>) -> Result<()> {
    println!("[Watch Party] close_party");

    if let Some(mut session) = state.session.lock().await.take() {
        let _ = session.shutdown.send(());
        session.browser.kill().context("close browser process")?;
        session.browser.wait().context("wait for browser process")?;
    }
    Ok(())
}

#[tauri::command]
pub async fn apply_state(
    video: usize,
    offset: f64,
    playing: bool,
    state: State<'_, WatchState>,
) -> Result<String> {
    let tx = state.tx.clone();

    let js_code = format!(
        "window.__watchPartyApplyState({}, {}, {})",
        video, offset, playing
    );

    let req_id = MSG_ID.fetch_add(1, Ordering::SeqCst);

    let payload = serde_json::json!({
        "id": req_id,
        "method": "Runtime.evaluate",
        "params": {
            "expression": js_code,
            "awaitPromise": true,
            "returnByValue": true,
        }
    });

    let (resp_tx, resp_rx) = tokio::sync::oneshot::channel();

    tx.send_async(Request {
        id: req_id,
        payload: payload.to_string(),
        response_tx: Some(resp_tx),
    })
    .await
    .context("Failed to send apply_state to background worker")?;

    let cdp_response = resp_rx
        .await
        .context("Background worker dropped the response channel")?;

    if let Some(err) = cdp_response.get("error") {
        println!("[Watch Party] apply_state CDP error: {}", err);
        return Err(anyhow::anyhow!("CDP Error while applying state: {}", err).into());
    }

    if let Some(result) = cdp_response.get("result") {
        if let Some(exception) = result.get("exceptionDetails") {
            println!("[Watch Party] apply_state JS exception: {}", exception);
            return Err(anyhow::anyhow!("JS Execution Error: {}", exception).into());
        }
        let value = result
            .get("result")
            .and_then(|r| r.get("value"))
            .and_then(|v| v.as_str())
            .unwrap_or("ok")
            .to_string();
        println!("[Watch Party] apply_state: {}", value);
        return Ok(value);
    }

    Ok("ok".to_string())
}
