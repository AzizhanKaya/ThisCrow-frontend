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

mod tray;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(win) = app.get_webview_window("app") {
                let _ = win.show();
                let _ = win.unminimize();
                let _ = win.set_focus();
            }
        }))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_http::init())
        .setup(|app| {
            tray::create_tray(app.handle())?;

            if let Some(win) = app.get_webview_window("app") {
                #[cfg(target_os = "linux")]
                {
                    use webkit2gtk::{
                        CookieAcceptPolicy, CookieManagerExt, WebContextExt, WebViewExt,
                    };
                    if let Err(e) = win.with_webview(|webview| {
                        if let Some(cookie_manager) = webview
                            .inner()
                            .context()
                            .and_then(|ctx| ctx.cookie_manager())
                        {
                            cookie_manager.set_accept_policy(CookieAcceptPolicy::Always);
                        }
                    }) {
                        println!("Failed to set cookie accept policy: {}", e);
                    }


                    if std::env::var("WAYLAND_DISPLAY").is_ok() {
                        let win_nudge = win.clone();
                        tauri::async_runtime::spawn(async move {
                            tokio::time::sleep(std::time::Duration::from_millis(1000)).await;
                            if let Ok(size) = win_nudge.inner_size() {
                                let _ = win_nudge
                                    .set_size(tauri::PhysicalSize::new(size.width + 1, size.height + 1));
                                let _ = win_nudge.set_size(size);
                            }
                        });
                    }

                }

                #[cfg(target_os = "macos")]
                {
                    use cocoa::base::{NO, id, nil};
                    use objc::{msg_send, runtime::BOOL, sel, sel_impl};
                    if let Err(e) = win.with_webview(|webview| unsafe {
                        let wk_webview = webview.inner() as id;
                        let configuration: id = msg_send![wk_webview, configuration];
                        let data_store: id = msg_send![configuration, websiteDataStore];
                        if data_store != nil {
                            let selector = sel!(_setResourceLoadStatisticsEnabled:);
                            let responds: BOOL = msg_send![data_store, respondsToSelector: selector];
                            if responds != NO {
                                let _: () = msg_send![data_store, _setResourceLoadStatisticsEnabled: NO];
                            } else {
                                println!("WKWebsiteDataStore does not respond to _setResourceLoadStatisticsEnabled:");
                            }
                        }
                    }) {
                        println!("Failed to relax macOS cookie policy: {}", e);
                    }
                }

                #[cfg(any(target_os = "linux", target_os = "windows"))]
                if let Err(e) = win.set_decorations(false) {
                    println!("Failed to disable window decorations: {}", e);
                }

                #[cfg(target_os = "macos")]
                apply_macos_overlay_titlebar(&win);

                
            }

            let handle_update = app.handle().clone();

            tauri::async_runtime::spawn(async move {
                match handle_update.updater() {
                    Ok(updater) => match updater.check().await {
                        Ok(Some(update)) => {
                            println!("Update available: {}", update.version);

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

                if let Some(win) = handle_update.get_webview_window("app") {
                    if let Err(e) = win.show() {
                        println!("Failed to show main window: {}", e);
                    }
                }
            });

            let handle_music = app.handle().clone();

            tauri::async_runtime::spawn(async move {
                if let Err(e) = activity::music::monitor_music(handle_music).await {
                    println!("Music monitoring failed: {:#?}", e);
                }
            });

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
            activity::music::get_current_music,
            open_url
        ])
        .run(tauri::generate_context!())
        .expect("Tauri could not start");
}

#[tauri::command]
fn open_url(url: String) -> std::result::Result<(), String> {
    #[cfg(target_os = "macos")]
    let res = std::process::Command::new("open").arg(&url).spawn();

    #[cfg(target_os = "windows")]
    let res = std::process::Command::new("cmd")
        .args(["/c", "start", "", &url])
        .spawn();

    #[cfg(target_os = "linux")]
    let res = std::process::Command::new("xdg-open").arg(&url).spawn();

    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    let res = Err(std::io::Error::new(
        std::io::ErrorKind::Other,
        "Unsupported platform",
    ));

    res.map(|_| ()).map_err(|e| e.to_string())
}

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
