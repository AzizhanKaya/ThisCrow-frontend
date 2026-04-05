use tokio::sync::watch;

#[cfg(target_os = "windows")]
mod windows;
#[cfg(target_os = "windows")]
pub use windows::*;

#[cfg(target_os = "linux")]
mod linux;
#[cfg(target_os = "linux")]
pub use linux::*;

pub async fn start_steam_tracker() {
    println!("[Steam Tracker] Başlatıldı");

    let initial_state = get_current_appid();
    let (tx, mut rx) = watch::channel(initial_state);

    match *rx.borrow() {
        Some(id) => println!("[Steam Tracker] İlk Durum: Oyun çalışıyor (AppID: {})", id),
        None => println!("[Steam Tracker] İlk Durum: Oyun çalışmıyor"),
    }

    tokio::spawn(async move {
        start_os_watcher(tx).await;
    });

    while rx.changed().await.is_ok() {
        let current_id = *rx.borrow();
        match current_id {
            Some(id) => println!("[Steam Tracker] Durum Değişti: Oyun açıldı (AppID: {})", id),
            None => println!("[Steam Tracker] Durum Değişti: Oyun kapandı"),
        }
    }
}
