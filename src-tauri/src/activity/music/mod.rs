use serde::Serialize;

#[derive(Debug, Serialize, Clone)]
pub enum MusicActivity {
    Playing(Music),
    Paused(Music),
    Stopped,
}

#[derive(Debug, Serialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct Music {
    pub title: String,
    pub artist: String,
    pub album: String,
    pub album_url: String,
}

#[cfg(target_os = "linux")]
mod linux;
#[cfg(target_os = "linux")]
pub use linux::monitor_music;

#[cfg(target_os = "windows")]
mod windows;
#[cfg(target_os = "windows")]
pub use windows::monitor_music;

#[cfg(not(any(target_os = "linux", target_os = "windows")))]
pub fn monitor_music() {
    unimplemented!("Music monitoring is not implemented for this operating system.");
}
