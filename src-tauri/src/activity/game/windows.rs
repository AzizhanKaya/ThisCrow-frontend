use tokio::sync::watch;

pub fn get_current_appid() -> Option<u32> {
    use winreg::RegKey;
    use winreg::enums::*;
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    if let Ok(steam_key) = hkcu.open_subkey("Software\\Valve\\Steam") {
        if let Ok(app_id) = steam_key.get_value::<u32, _>("RunningAppID") {
            if app_id > 0 {
                return Some(app_id);
            }
        }
    }
    None
}

pub async fn start_os_watcher(tx: watch::Sender<Option<u32>>) {
    use windows::Win32::System::Registry::{
        HKEY, REG_NOTIFY_CHANGE_LAST_SET, RegNotifyChangeKeyValue,
    };
    use winreg::RegKey;

    tokio::task::spawn_blocking(move || {
        let hkcu = RegKey::predef(winreg::enums::HKEY_CURRENT_USER);
        if let Ok(steam_key) = hkcu.open_subkey("Software\\Valve\\Steam") {
            let raw_handle = steam_key.raw_handle() as isize;
            loop {
                unsafe {
                    let _ = RegNotifyChangeKeyValue(
                        HKEY(raw_handle),
                        false,
                        REG_NOTIFY_CHANGE_LAST_SET,
                        None,
                        false,
                    );
                }
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
    });
}
