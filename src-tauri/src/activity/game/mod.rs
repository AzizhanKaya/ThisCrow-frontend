use serde::Serialize;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter};
use tokio::sync::watch;

#[derive(Debug, serde::Serialize, Clone)]
#[serde(rename_all = "snake_case")]
#[serde(tag = "game", content = "payload")]
pub enum GameActivity {
    Playing(Game),
    Stopped,
}

#[derive(Debug, Serialize, Clone, Default)]
pub struct Game {
    pub app_id: u64,
    pub start_time: i64,
    pub name: String,
    pub header_image: String,
    pub short_description: String,
    pub background: String,
}

#[cfg(target_os = "windows")]
mod windows;
#[cfg(target_os = "windows")]
pub use windows::*;

#[cfg(target_os = "linux")]
mod linux;
#[cfg(target_os = "linux")]
pub use linux::*;

#[cfg(any(target_os = "linux", target_os = "windows"))]
pub async fn start_steam_tracker<R: tauri::Runtime>(app: AppHandle<R>) {
    let initial_state = get_current_appid();
    let (tx, mut rx) = watch::channel(initial_state);

    tokio::spawn(async move {
        start_os_watcher(tx).await;
    });

    while rx.changed().await.is_ok() {
        let current_id = *rx.borrow();
        match current_id {
            Some(id) => {
                println!("Game Activity: AppID {}", id);
                let (name, header_image, short_description, background) =
                    if let Some(info) = fetch_steam_game_info(id).await {
                        (info.0, info.1, info.2, info.3)
                    } else {
                        (String::new(), String::new(), String::new(), String::new())
                    };

                let _ = app.emit(
                    "game_activity",
                    GameActivity::Playing(Game {
                        app_id: id as u64,
                        start_time: SystemTime::now()
                            .duration_since(UNIX_EPOCH)
                            .unwrap()
                            .as_millis() as i64,
                        name,
                        header_image,
                        short_description,
                        background,
                    }),
                );
            }
            None => {
                println!("Game Activity: Stopped");
                let _ = app.emit("game_activity", GameActivity::Stopped);
            }
        }
    }
}

async fn fetch_steam_game_info(app_id: u32) -> Option<(String, String, String, String)> {
    let url = format!(
        "https://store.steampowered.com/api/appdetails?appids={}",
        app_id
    );
    let response = reqwest::get(&url)
        .await
        .ok()?
        .json::<serde_json::Value>()
        .await
        .ok()?;

    if let Some(app_data) = response.get(app_id.to_string()) {
        if app_data
            .get("success")
            .and_then(|v| v.as_bool())
            .unwrap_or(false)
        {
            let data = app_data.get("data")?;
            return Some((
                data.get("name")?.as_str()?.to_string(),
                data.get("header_image")?.as_str()?.to_string(),
                data.get("short_description")?.as_str()?.to_string(),
                data.get("background")?.as_str()?.to_string(),
            ));
        }
    }
    None
}

#[tauri::command]
pub fn get_current_appid() -> Option<u32> {
    #[cfg(target_os = "linux")]
    {
        return linux::get_current_appid();
    }
    #[cfg(target_os = "windows")]
    {
        return windows::get_current_appid();
    }
    #[cfg(not(any(target_os = "linux", target_os = "windows")))]
    None
}

#[tauri::command]
pub async fn get_current_game() -> Option<Game> {
    let id = get_current_appid()?;
    println!("Initial Game Check: AppID {}", id);
    let (name, header_image, short_description, background) =
        if let Some(info) = fetch_steam_game_info(id).await {
            (info.0, info.1, info.2, info.3)
        } else {
            (String::new(), String::new(), String::new(), String::new())
        };

    Some(Game {
        app_id: id as u64,
        start_time: SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as i64,
        name,
        header_image,
        short_description,
        background,
    })
}
