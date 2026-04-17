use serde::Serialize;

#[derive(Debug, serde::Serialize, Clone)]
#[serde(rename_all = "snake_case")]
#[serde(tag = "music", content = "payload")]
pub enum MusicActivity {
    Playing(Music),
    Seek(i64),
    Paused,
    Stopped,
}

#[derive(Debug, Serialize, Clone, Default)]
pub struct Music {
    pub title: String,
    pub artist: String,
    pub album: String,
    pub album_url: String,
    pub length: u64,
    pub offset: i64,
    pub paused: bool,
}

#[cfg(target_os = "linux")]
mod linux;
#[cfg(target_os = "linux")]
pub use linux::*;

#[cfg(target_os = "windows")]
mod windows;
#[cfg(target_os = "windows")]
pub use windows::*;

#[cfg(not(any(target_os = "linux", target_os = "windows")))]
pub fn monitor_music() {
    unimplemented!("Music monitoring is not implemented for this operating system.");
}

#[tauri::command]
pub async fn get_current_music() -> Option<MusicActivity> {
    #[cfg(target_os = "linux")]
    {
        return current_music().await;
    }

    #[cfg(not(target_os = "linux"))]
    None
}
