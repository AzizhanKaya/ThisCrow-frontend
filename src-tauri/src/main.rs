#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    unsafe {
        std::env::set_var("GST_DEBUG", "0");
        std::env::set_var("GST_DEBUG_FILE", "/dev/null");
        std::env::set_var("G_MESSAGES_DEBUG", "none");
        std::env::set_var("NO_AT_BRIDGE", "1");

        if std::env::var("WAYLAND_DISPLAY").is_ok() {
            std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
        }
    }

    thiscrow_lib::install_stderr_filter();
    thiscrow_lib::run();
}
