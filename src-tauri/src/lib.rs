use futures_util::{SinkExt, StreamExt};
use serde_json::Value;
use std::process::Command;
use tauri::{Manager, State};
use tokio::sync::{Mutex, mpsc};
use tokio_tungstenite::connect_async;
use tokio_tungstenite::tungstenite::Message;
use url::Url;

// 1. UYGULAMA DURUMU (STATE)
// Arka plandaki açık WebSocket'e mesaj gönderebilmek için bir kanal (Sender) saklıyoruz.
pub struct CdpState {
    tx: Mutex<Option<mpsc::Sender<String>>>,
}

// 2. CHROME BAŞLATMA (Aynı kalıyor)
#[tauri::command]
fn launch_netflix() -> Result<String, String> {
    Command::new("google-chrome-stable")
        .args([
            "--remote-debugging-port=9222",
            "--app=https://www.netflix.com",
            "--user-data-dir=/tmp/netflix-party-profile",
        ])
        .spawn()
        .map_err(|e| format!("Chrome başlatılamadı: {}", e))?;
    Ok("Netflix açıldı.".to_string())
}

// 3. BAĞLANTIYI KUR VE AÇIK TUT (Sadece video açılınca 1 kez çağrılacak)
#[tauri::command]
async fn connect_to_netflix(state: State<'_, CdpState>) -> Result<String, String> {
    // Sekmeleri al
    let client = reqwest::Client::new();
    let res = client
        .get("http://127.0.0.1:9222/json")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let targets: Vec<Value> = res.json().await.map_err(|e| e.to_string())?;

    // Netflix sekmesini bul
    let mut ws_url = String::new();
    for target in targets {
        if let Some(url) = target.get("url").and_then(|u| u.as_str()) {
            if url.contains("netflix.com") {
                ws_url = target["webSocketDebuggerUrl"].as_str().unwrap().to_string();
                break;
            }
        }
    }

    if ws_url.is_empty() {
        return Err("Netflix sekmesi bulunamadı! Video açık mı?".to_string());
    }

    // Arka planda WebSocket'e asenkron bağlan
    let (ws_stream, _) = connect_async(Url::parse(&ws_url).unwrap())
        .await
        .map_err(|e| format!("Bağlantı hatası: {}", e))?;

    let (mut write, _read) = ws_stream.split(); // Okuma ve yazma kanallarını ayır

    // Uygulama içi haberleşme kanalı (MPSC) oluştur
    let (tx, mut rx) = mpsc::channel::<String>(32);

    // TX'i (kumandayı) Tauri'nin genel State'ine kaydet
    *state.tx.lock().await = Some(tx);

    // Arka planda sonsuz bir görev (Thread) başlat.
    // Bu görev, Tauri'den gelen komutları bekler ve açık olan WebSocket'ten Chrome'a yollar.
    tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if write.send(Message::Text(msg)).await.is_err() {
                println!("WebSocket'e mesaj gönderilemedi, bağlantı kopmuş olabilir.");
                break;
            }
        }
    });

    Ok("Kalıcı bağlantı başarıyla kuruldu!".to_string())
}

// 4. AÇIK BAĞLANTIDAN KOMUT GÖNDER (İstediğin kadar, sıfır gecikme ile çağırabilirsin)
#[tauri::command]
async fn seek_netflix(milliseconds: u32, state: State<'_, CdpState>) -> Result<String, String> {
    let tx_guard = state.tx.lock().await;

    if let Some(tx) = tx_guard.as_ref() {
        let js_code = format!(
            r#"(() => {{
                try {{
                    const videoPlayer = window.netflix.appContext.state.playerApp.getAPI().videoPlayer;
                    const sessionId = videoPlayer.getAllPlayerSessionIds()[0];
                    const player = videoPlayer.getVideoPlayerBySessionId(sessionId);
                    player.seek({}); 
                }} catch(e) {{}}
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

        // Mesajı açık olan kanala (arka plan görevine) fırlat
        tx.send(payload.to_string())
            .await
            .map_err(|e| e.to_string())?;

        Ok(format!(
            "{} ms saniyeye atlama komutu fırlatıldı.",
            milliseconds
        ))
    } else {
        Err("Bağlantı henüz kurulmamış! Önce connect_to_netflix çağrılmalı.".to_string())
    }
}

// 5. TAURI SETUP
pub fn run() {
    tauri::Builder::default()
        // State'i başlatıyoruz
        .manage(CdpState {
            tx: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            launch_netflix,
            connect_to_netflix,
            seek_netflix
        ])
        .run(tauri::generate_context!())
        .expect("Tauri başlatılamadı");
}
