use crate::error::Result;
use serde::Deserialize;
use serde::Serialize;
use std::env;
use std::fmt;
use std::path::PathBuf;
use which::which;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Browser {
    Chrome,
    Chromium,
    Safari,
    Brave,
    Opera,
}

impl fmt::Display for Browser {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Browser::Chrome => write!(f, "Chrome"),
            Browser::Chromium => write!(f, "Chromium"),
            Browser::Safari => write!(f, "Safari"),
            Browser::Brave => write!(f, "Brave"),
            Browser::Opera => write!(f, "Opera"),
        }
    }
}

impl Browser {
    pub fn path(&self) -> Result<PathBuf> {
        #[cfg(target_os = "windows")]
        {
            let exe_names = match self {
                Browser::Chrome => vec!["chrome.exe"],
                Browser::Chromium => vec!["chrome.exe", "chromium.exe"],
                Browser::Brave => vec!["brave.exe"],
                Browser::Opera => vec!["opera.exe", "launcher.exe"],
                Browser::Safari => vec!["safari.exe"],
            };

            for exe in exe_names {
                if let Some(path) = self.find_in_registry(exe) {
                    if path.exists() {
                        return Ok(path);
                    }
                }
            }

            // Fallback to common paths
            let pf = env::var("PROGRAMFILES").unwrap_or_else(|_| "C:\\Program Files".to_string());
            let pfx86 = env::var("PROGRAMFILES(X86)").unwrap_or_else(|_| "C:\\Program Files (x86)".to_string());
            let local = env::var("LOCALAPPDATA").unwrap_or_else(|_| "".to_string());

            let search_dirs = vec![pf, pfx86, local];
            let relative_paths = match self {
                Browser::Chrome => vec!["Google\\Chrome\\Application\\chrome.exe"],
                Browser::Chromium => vec!["Chromium\\Application\\chrome.exe"],
                Browser::Brave => vec!["BraveSoftware\\Brave-Browser\\Application\\brave.exe"],
                Browser::Opera => vec![
                    "Opera\\launcher.exe",
                    "Programs\\Opera\\launcher.exe",
                    "Opera Software\\Opera Stable\\launcher.exe",
                ],
                Browser::Safari => vec![],
            };

            for dir in search_dirs {
                if dir.is_empty() {
                    continue;
                }
                for rel in &relative_paths {
                    let full = PathBuf::from(&dir).join(rel);
                    if full.exists() {
                        return Ok(full);
                    }
                }
            }
        }

        Ok(match self {
            Browser::Chrome => which("chrome")
                .or_else(|_| which("google-chrome"))
                .or_else(|_| which("google-chrome-stable")),
            Browser::Chromium => which("chromium").or_else(|_| which("chromium-browser")),
            Browser::Safari => which("safari"),
            Browser::Brave => which("brave").or_else(|_| which("brave-browser")),
            Browser::Opera => which("opera").or_else(|_| which("opera-browser")),
        }
        .map_err(|e| anyhow::anyhow!(e))?)
    }

    #[cfg(target_os = "windows")]
    fn find_in_registry(&self, exe_name: &str) -> Option<PathBuf> {
        use winreg::enums::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE};
        use winreg::RegKey;

        let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
        let hkcu = RegKey::predef(HKEY_CURRENT_USER);

        let subkey = format!(
            "SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\{}",
            exe_name
        );

        hkcu.open_subkey(&subkey)
            .or_else(|_| hklm.open_subkey(&subkey))
            .ok()
            .and_then(|key| key.get_value::<String, _>("").ok())
            .map(PathBuf::from)
    }
}

#[tauri::command]
pub fn get_browsers() -> Vec<Browser> {
    let all_browsers = vec![
        Browser::Chrome,
        Browser::Chromium,
        Browser::Safari,
        Browser::Brave,
        Browser::Opera,
    ];

    all_browsers
        .into_iter()
        .filter(|browser| browser.path().is_ok())
        .collect()
}

impl Browser {
    #[cfg(target_os = "linux")]
    pub fn data_path(&self) -> Option<PathBuf> {
        use std::path::PathBuf;

        let home = env::var("HOME").ok()?;

        let base = match self {
            Browser::Chrome => format!("{}/.config/google-chrome", home),
            Browser::Chromium => format!("{}/.config/chromium", home),
            Browser::Brave => format!("{}/.config/BraveSoftware/Brave-Browser", home),
            Browser::Opera => format!("{}/.config/opera", home),
            Browser::Safari => return None,
        };

        Some(PathBuf::from(base))
    }

    #[cfg(target_os = "windows")]
    pub fn data_path(&self) -> Option<PathBuf> {
        use std::path::PathBuf;

        let local = env::var("LOCALAPPDATA").ok()?;

        let base = match self {
            Browser::Chrome => format!("{}/Google/Chrome/User Data", local),
            Browser::Chromium => format!("{}/Chromium/User Data", local),
            Browser::Brave => format!("{}/BraveSoftware/Brave-Browser/User Data", local),
            Browser::Opera => {
                let appdata = env::var("APPDATA").ok()?;
                let roaming = PathBuf::from(appdata);
                let base = roaming
                    .parent()
                    .map(|p| p.join("Local").join("Opera Software").join("Opera Stable"))?;
                return Some(base);
            }
            Browser::Safari => return None,
        };

        Some(PathBuf::from(base))
    }

    #[cfg(target_os = "macos")]
    pub fn data_path(&self) -> Option<PathBuf> {
        use std::path::PathBuf;

        let home = env::var("HOME").ok()?;

        let base = match self {
            Browser::Chrome => format!("{}/Library/Application Support/Google/Chrome", home),
            Browser::Chromium => format!("{}/Library/Application Support/Chromium", home),
            Browser::Brave => format!(
                "{}/Library/Application Support/BraveSoftware/Brave-Browser",
                home
            ),
            Browser::Opera => format!(
                "{}/Library/Application Support/com.operasoftware.Opera",
                home
            ),
            Browser::Safari => format!("{}/Library/Safari", home),
        };

        Some(PathBuf::from(base))
    }
}
