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
                match handle.updater().unwrap().check().await {
                    Ok(Some(update)) => {
                        println!("Update available: {}", update.version);
                        let _ = WebviewWindowBuilder::new(
                            &handle,
                            "updater",
                            WebviewUrl::App("updater.html".into()),
                        )
                        .title("Updater")
                        .inner_size(400.0, 300.0)
                        .build()
                        .expect("Updater window could not be created");
                    }
                    Ok(None) => {
                        println!("Application is already up to date.");
                    }
                    Err(e) => {
                        eprintln!("Update check failed: {}", e);
                    }
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![])
        .run(tauri::generate_context!())
        .expect("Tauri could not start");
}
