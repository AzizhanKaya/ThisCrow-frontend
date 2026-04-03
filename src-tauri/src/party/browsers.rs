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
