use tauri::Manager;
use tauri::WebviewUrl;
use tauri::WebviewWindowBuilder;
use tauri_plugin_updater::UpdaterExt;

mod error;
pub use error::Result;

mod party;
use party::browsers::get_browsers;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            let handle = app.handle().clone();

            tauri::async_runtime::spawn(async move {
                let main_window = handle.get_webview_window("app");

                match handle.updater() {
                    Ok(updater) => match updater.check().await {
                        Ok(Some(update)) => {
                            println!("Update available: {}", update.version);

                            if let Some(ref win) = main_window {
                                let _ = win.hide();
                            }

                            let _ = WebviewWindowBuilder::new(
                                &handle,
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
                            if let Some(ref win) = main_window {
                                let _ = win.show();
                            }
                        }
                        Err(e) => {
                            eprintln!("Update check failed: {}", e);
                            if let Some(ref win) = main_window {
                                let _ = win.show();
                            }
                        }
                    },
                    Err(e) => {
                        eprintln!("Updater plugin error: {}", e);
                        if let Some(ref win) = main_window {
                            let _ = win.show();
                        }
                    }
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![])
        .run(tauri::generate_context!())
        .expect("Tauri could not start");
}
