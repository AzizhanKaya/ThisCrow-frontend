use crate::Result;
use anyhow::{Context, anyhow};
use futures_util::{SinkExt, StreamExt};
use serde_json::Value;
use std::process::Command;
use tauri::{AppHandle, Manager, State};
use tokio::fs;
use tokio::sync::{Mutex, mpsc};
use tokio_tungstenite::connect_async;
use tokio_tungstenite::tungstenite::Message;
use url::Url;

pub struct CdpState {
    pub tx: Mutex<Option<mpsc::Sender<String>>>,
}

#[tauri::command]
pub async fn open_browser(app: AppHandle, path: String, url: String) -> Result<String> {
    let mut data_dir = app
        .path()
        .app_data_dir()
        .context("Failed to locate application data directory")?;

    data_dir.push("browser-profile");

    fs::create_dir_all(&data_dir)
        .await
        .context("Failed to create browser profile directory")?;

    Command::new(path)
        .args([
            "--remote-debugging-port=9222",
            &format!("--app={url}"),
            &format!("--user-data-dir={}", data_dir.display()),
        ])
        .spawn()
        .context("Failed to launch browser process")?;

    Ok("Browser launched successfully.".into())
}

#[tauri::command]
pub async fn connect_to_netflix(state: State<'_, CdpState>) -> Result<String> {
    let client = reqwest::Client::new();

    // JSON endpoint'inden hedefleri çekiyoruz
    let res = client
        .get("http://127.0.0.1:9222/json")
        .send()
        .await
        .context("Failed to connect to browser debugging port (is the browser open?)")?;

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

    let ws_url =
        ws_url.ok_or_else(|| anyhow!("Netflix tab not found! Is a video currently open?"))?;

    let (ws_stream, _) = connect_async(Url::parse(&ws_url).context("Invalid WebSocket URL")?)
        .await
        .context("Failed to establish WebSocket connection with the browser")?;

    let (mut write, _) = ws_stream.split();
    let (tx, mut rx) = mpsc::channel::<String>(32);

    *state.tx.lock().await = Some(tx);

    tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if let Err(e) = write.send(Message::Text(msg)).await {
                println!("Failed to send message to WebSocket: {}", e);
                break;
            }
        }
    });

    Ok("Connection to Netflix established successfully!".into())
}

#[tauri::command]
pub async fn seek_netflix(milliseconds: u32, state: State<'_, CdpState>) -> Result<String> {
    let tx_guard = state.tx.lock().await;

    if let Some(tx) = tx_guard.as_ref() {
        let js_code = format!(
            r#"(() => {{
                try {{
                    const videoPlayer = window.netflix.appContext.state.playerApp.getAPI().videoPlayer;
                    const sessionId = videoPlayer.getAllPlayerSessionIds()[0];
                    const player = videoPlayer.getVideoPlayerBySessionId(sessionId);
                    player.seek({}); 
                }} catch(e) {{
                    console.error("Netflix Seek Error:", e);
                }}
            }})()"#,
            milliseconds
        );

        let payload = serde_json::json!({
            "id": 1,
            "method": "Runtime.evaluate",
            "params": {
                "expression": js_code
            }
        });

        tx.send(payload.to_string())
            .await
            .context("Failed to relay command to the background worker")?;

        Ok(format!("Seek command sent for {} ms.", milliseconds))
    } else {
        Err(anyhow!("Active connection not found! Please call connect_to_netflix first.").into())
    }
}
