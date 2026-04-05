use std::fs;
use tokio::sync::watch;

pub fn get_current_appid() -> Option<u32> {
    if let Ok(entries) = fs::read_dir("/proc") {
        for entry in entries.filter_map(Result::ok) {
            let path = entry.path().join("environ");

            if path.exists() {
                if let Ok(env_data) = fs::read(path) {
                    let env_str = String::from_utf8_lossy(&env_data);

                    for var in env_str.split('\0') {
                        if let Some(id_str) = var.strip_prefix("SteamAppId=") {
                            if let Ok(id) = id_str.parse::<u32>() {
                                if id > 0 {
                                    return Some(id);
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    None
}

pub async fn start_os_watcher(tx: watch::Sender<Option<u32>>) {
    use notify::{EventKind, RecursiveMode, Watcher};
    use std::path::PathBuf;
    use tokio::sync::mpsc;

    let (notify_tx, mut notify_rx) = mpsc::channel(1);
    let mut watcher = notify::recommended_watcher(move |res| {
        if let Ok(event) = res {
            let _ = notify_tx.blocking_send(event);
        }
    })
    .expect("Failed to start watcher");

    let home = std::env::var("HOME").expect("HOME not found");
    let logs_path = PathBuf::from(format!("{}/.local/share/Steam/logs", home));

    if logs_path.exists() {
        watcher
            .watch(&logs_path, RecursiveMode::NonRecursive)
            .expect("Failed to watch logs folder");
    }

    while let Some(event) = notify_rx.recv().await {
        if matches!(event.kind, EventKind::Modify(_) | EventKind::Create(_)) {
            let current_id = get_current_appid();
            if tx.is_closed() {
                break;
            }
            tx.send_if_modified(|val| {
                if *val != current_id {
                    *val = current_id;
                    true
                } else {
                    false
                }
            });
        }
    }
}
