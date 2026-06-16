use tauri::Manager;
use tauri::WebviewUrl;
use tauri::WebviewWindowBuilder;
use tauri_plugin_updater::UpdaterExt;
use tokio::sync::Mutex;

mod error;
pub use error::Result;

mod activity;
mod log_filter;
pub use log_filter::install_stderr_filter;

mod party;

#[cfg(target_os = "macos")]
fn apply_macos_overlay_titlebar(window: &tauri::WebviewWindow) {
    use cocoa::appkit::{NSWindow, NSWindowStyleMask, NSWindowTitleVisibility};
    use cocoa::base::{YES, id};

    let ns_window = match window.ns_window() {
        Ok(handle) => handle as id,
        Err(e) => {
            println!("Failed to get NSWindow handle: {}", e);
            return;
        }
    };

    unsafe {
        let mut style_mask = ns_window.styleMask();
        style_mask.insert(NSWindowStyleMask::NSFullSizeContentViewWindowMask);
        ns_window.setStyleMask_(style_mask);
        ns_window.setTitlebarAppearsTransparent_(YES);
        ns_window.setTitleVisibility_(NSWindowTitleVisibility::NSWindowTitleHidden);
    }
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_os::init())
        .setup(|app| {
            if let Some(win) = app.get_webview_window("app") {
                #[cfg(any(target_os = "linux", target_os = "windows"))]
                if let Err(e) = win.set_decorations(false) {
                    println!("Failed to disable window decorations: {}", e);
                }

                #[cfg(target_os = "macos")]
                apply_macos_overlay_titlebar(&win);

                if let Err(e) = win.show() {
                    println!("Failed to show main window: {}", e);
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
                        Ok(None) => println!("Application is already up to date."),
                        Err(e) => println!("Update check failed: {}", e),
                    },
                    Err(e) => println!("Updater plugin error: {}", e),
                }
            });

            #[cfg(any(target_os = "linux", target_os = "windows", target_os = "macos"))]
            {
                let handle_music = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    if let Err(e) = activity::music::monitor_music(handle_music).await {
                        println!("Music monitoring failed: {:#?}", e);
                    }
                });
            }

            #[cfg(any(target_os = "linux", target_os = "windows"))]
            {
                let handle_game = app.handle().clone();
                tauri::async_runtime::spawn(activity::game::start_steam_tracker(handle_game));
            }

            Ok(())
        })
        .manage({
            let (tx, rx) = flume::unbounded();
            party::watch::WatchState {
                tx,
                rx,
                session: Mutex::new(None),
            }
        })
        .invoke_handler(tauri::generate_handler![
            party::browsers::get_browsers,
            party::watch::open_party,
            party::watch::close_party,
            party::watch::apply_state,
            activity::game::get_current_game,
            activity::music::get_current_music
        ])
        .run(tauri::generate_context!())
        .expect("Tauri could not start");
}
