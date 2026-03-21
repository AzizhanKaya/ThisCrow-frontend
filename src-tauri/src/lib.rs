use tokio::sync::Mutex;

mod error;
pub use error::Result;

mod browser;
use browser::get_browsers;

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![])
        .run(tauri::generate_context!())
        .expect("Tauri başlatılamadı");
}
