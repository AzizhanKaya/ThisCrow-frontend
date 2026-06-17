use tauri::{
    AppHandle, Emitter, Manager, Runtime,
    menu::{Menu, MenuItem, PredefinedMenuItem, Submenu},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
};

pub fn create_tray<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let status_online = MenuItem::with_id(app, "status_online", "Online", true, None::<&str>)?;
    let status_idle = MenuItem::with_id(app, "status_idle", "Idle", true, None::<&str>)?;
    let status_dnd = MenuItem::with_id(app, "status_dnd", "Do Not Disturb", true, None::<&str>)?;
    let status_menu = Submenu::with_id_and_items(
        app,
        "status",
        "Status",
        true,
        &[&status_online, &status_idle, &status_dnd],
    )?;

    let show = MenuItem::with_id(app, "show", "Show", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

    let menu = Menu::with_items(app, &[&status_menu, &show, &separator, &quit])?;

    let mut builder = TrayIconBuilder::with_id("main")
        .tooltip("ThisCrow")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "status_online" => emit_status(app, "Online"),
            "status_idle" => emit_status(app, "Idle"),
            "status_dnd" => emit_status(app, "Dnd"),
            "show" => show_main_window(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main_window(tray.app_handle());
            }
        });

    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }

    builder.build(app)?;
    Ok(())
}

fn emit_status<R: Runtime>(app: &AppHandle<R>, status: &str) {
    let _ = app.emit("tray_set_status", status);
}

fn show_main_window<R: Runtime>(app: &AppHandle<R>) {
    if let Some(win) = app.get_webview_window("app") {
        let _ = win.unminimize();
        let _ = win.show();
        let _ = win.set_focus();
    }
}
