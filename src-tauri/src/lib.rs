use tauri::Manager;
use tauri::WebviewUrl;
use tauri::WebviewWindowBuilder;
use tauri_plugin_updater::UpdaterExt;

mod error;
pub use error::Result;

mod activity;

mod party;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            #[cfg(target_os = "linux")]
            {
                use tauri::Manager;
                use webkit2gtk::{PermissionRequestExt, SettingsExt, WebViewExt};

                if let Some(window) = app.get_webview_window("app") {
                    let _ = window.with_webview(|webview| {
                        let inner = webview.inner();
                        if let Some(settings) = inner.settings() {
                            settings.set_enable_webrtc(true);
                            settings.set_enable_media_stream(true);
                        }

                        inner.connect_permission_request(|_, request| {
                            request.allow();
                            true
                        });
                    });
                } else {
                    println!("App window not found.");
                }
            }

            let handle_update = app.handle().clone();

            tauri::async_runtime::spawn(async move {
                let app_window = handle_update.get_webview_window("app");

                match handle_update.updater() {
                    Ok(updater) => match updater.check().await {
                        Ok(Some(update)) => {
                            println!("Update available: {}", update.version);

                            if let Some(ref win) = app_window {
                                let _ = win.hide();
                            }

                            let _ = WebviewWindowBuilder::new(
                                &handle_update,
                                "updater",
                                WebviewUrl::App("updater.html".into()),
                            )
                            .title("ThisCrow Updater")
                            .inner_size(400.0, 300.0)
                            .decorations(false)
                            .transparent(true)
                            .always_on_top(true)
                            .center()
                            .build()
                            .expect("Updater window could not be created");
                        }
                        Ok(None) => {
                            println!("Application is already up to date.");
                            if let Some(ref win) = app_window {
                                if let Err(e) = win.show() {
                                    println!("Failed to show main window: {}", e);
                                }
                            }
                        }
                        Err(e) => println!("Update check failed: {}", e),
                    },
                    Err(e) => println!("Updater plugin error: {}", e),
                }
            });

            #[cfg(any(target_os = "linux", target_os = "windows"))]
            {
                let handle_music = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    if let Err(e) = activity::music::monitor_music(handle_music).await {
                        println!("Music monitoring failed: {:#?}", e);
                    }
                });
            }

            Ok(())
        })
        .manage({
            let (tx, rx) = flume::unbounded();
            party::watch::WatchState { tx, rx }
        })
        .invoke_handler(tauri::generate_handler![
            party::browsers::get_browsers,
            party::watch::open_party,
            party::watch::jump_to
        ])
        .run(tauri::generate_context!())
        .expect("Tauri could not start");
}
