use crate::Result;
use crate::party::browsers::Browser;
use anyhow::{Context, anyhow};
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::process::Command;
use std::sync::atomic::{AtomicUsize, Ordering};
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::fs;
use tokio::sync::oneshot;
use tokio_tungstenite::connect_async;
use tokio_tungstenite::tungstenite::Message as WsMessage;
use url::Url;

pub struct WatchState {
    pub tx: flume::Sender<Request>,
    pub rx: flume::Receiver<Request>,
}

pub struct Request {
    pub id: usize,
    pub payload: String,
    pub response_tx: Option<oneshot::Sender<Value>>,
}

#[derive(Serialize, Deserialize)]
pub enum PartyPlatform {
    Netflix,
    Prime,
}

impl PartyPlatform {
    fn url(&self) -> &str {
        match self {
            PartyPlatform::Netflix => "https://www.netflix.com",
            PartyPlatform::Prime => "https://www.primevideo.com",
        }
    }
}

static MSG_ID: AtomicUsize = AtomicUsize::new(1);

#[tauri::command]
pub async fn open_party(
    app: AppHandle,
    browser: Browser,
    platform: PartyPlatform,
    state: State<'_, WatchState>,
) -> Result<()> {
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

    let mut browser_process = Command::new(browser.path()?)
        .args([
            "--remote-debugging-port=9222",
            &format!("--app={}", platform.url()),
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

    let init_commands = [
        serde_json::json!({"id": MSG_ID.fetch_add(1, Ordering::SeqCst), "method": "Runtime.enable" }),
        serde_json::json!({"id": MSG_ID.fetch_add(1, Ordering::SeqCst), "method": "Runtime.addBinding", "params": { "name": "sendToTauri" } }),
        serde_json::json!({
            "id": MSG_ID.fetch_add(1, Ordering::SeqCst),
            "method": "Runtime.evaluate",
            "params": {
                "expression": include_str!("scripts/watching.js"),
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

    tokio::spawn(async move {
        let mut pending_requests: HashMap<usize, oneshot::Sender<serde_json::Value>> =
            HashMap::new();

        loop {
            tokio::select! {
                Ok(req) = rx.recv_async() => {
                    if let Some(tx) = req.response_tx {
                        pending_requests.insert(req.id, tx);
                    }

                    if write.send(WsMessage::Text(req.payload)).await.is_err() {
                        break;
                    }
                }
                Some(Ok(msg)) = read.next() => {
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
                    if cdp_msg.get("method").and_then(|m| m.as_str()) != Some("Runtime.bindingCalled") {
                        continue;
                    }

                    let Some(params) = cdp_msg.get("params") else { continue; };
                    if params.get("name").and_then(|n| n.as_str()) != Some("sendToTauri") { continue; }
                    let Some(payload_str) = params.get("payload").and_then(|p| p.as_str()) else { continue; };

                    #[derive(Serialize, Deserialize, Clone, Debug)]
                    #[serde(tag = "type")]
                    enum Message {
                        Watch{id: usize},
                        Unwatch,
                        JumpTo { offset: f64, play: bool },
                        Error(String),
                    }

                    let Ok(msg) = serde_json::from_str::<Message>(payload_str) else {
                        println!("Unknown struct: {}", payload_str);
                        continue;
                    };

                    match msg {
                        Message::Watch{..} | Message::JumpTo{..} | Message::Unwatch => {
                            println!("Watch Party Event: {:?}", msg);
                            if let Err(e) = app.emit("watch_party", msg) {
                                println!("Failed to emit event: {}", e);
                            }
                        }
                        Message::Error(error) => {
                            println!("Watch Party Error: {}", error);
                            if let Err(e) = browser_process.kill() {
                                println!("Failed to kill browser process: {}", e);
                            }
                        }
                    }
                }
                else => break,
            }
        }
        println!("WebSocket connection closed.");
    });

    Ok(())
}

#[tauri::command]
pub async fn jump_to(offset: f64, play: bool, state: State<'_, WatchState>) -> Result<()> {
    let tx = state.tx.clone();

    let js_code = include_str!("scripts/jump_to.js")
        .replace("OFFSET", &offset.to_string())
        .replace("PLAY", &play.to_string());

    let req_id = MSG_ID.fetch_add(1, Ordering::SeqCst);

    let payload = serde_json::json!({
        "id": req_id,
        "method": "Runtime.evaluate",
        "params": {
            "expression": js_code,
            "awaitPromise": true
        }
    });

    let (resp_tx, resp_rx) = tokio::sync::oneshot::channel();

    tx.send_async(Request {
        id: req_id,
        payload: payload.to_string(),
        response_tx: Some(resp_tx),
    })
    .await
    .context("Failed to send command to background worker")?;

    let cdp_response = resp_rx
        .await
        .context("Background worker dropped the response channel")?;

    if let Some(err) = cdp_response.get("error") {
        return Err(anyhow::anyhow!("CDP Error while jumping: {}", err).into());
    }

    if let Some(result) = cdp_response.get("result") {
        if let Some(exception) = result.get("exceptionDetails") {
            return Err(anyhow::anyhow!("JS Execution Error: {}", exception).into());
        }
    }

    println!("Jump command executed successfully!");

    Ok(())
}

#[tauri::command]
pub async fn locate_video(video_id: usize, state: State<'_, WatchState>) -> Result<()> {
    let tx = state.tx.clone();

    let js_code = include_str!("scripts/locate.js").replace("MOVIE_ID", &video_id.to_string());

    let req_id = MSG_ID.fetch_add(1, Ordering::SeqCst);
    let payload = serde_json::json!({
        "id": req_id,
        "method": "Runtime.evaluate",
        "params": {
            "expression": js_code,
            "awaitPromise": false
        }
    });

    let (resp_tx, resp_rx) = tokio::sync::oneshot::channel();

    tx.send_async(Request {
        id: req_id,
        payload: payload.to_string(),
        response_tx: Some(resp_tx),
    })
    .await
    .context("Failed to send locate command to background worker")?;

    let cdp_response = resp_rx
        .await
        .context("Background worker dropped the response channel")?;

    if let Some(err) = cdp_response.get("error") {
        return Err(anyhow::anyhow!("CDP Error while locating: {}", err).into());
    }

    if let Some(result) = cdp_response.get("result") {
        if let Some(exception) = result.get("exceptionDetails") {
            return Err(anyhow::anyhow!("JS Execution Error: {}", exception).into());
        }
    }

    println!("Successfully routed to video ID: {}", video_id);

    Ok(())
}
