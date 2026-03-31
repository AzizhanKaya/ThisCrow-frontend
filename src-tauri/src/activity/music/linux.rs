use super::{Music, MusicActivity};
use crate::error::Result;
use anyhow::anyhow;
use futures_util::StreamExt;
use std::convert::TryFrom;
use tauri::{AppHandle, Emitter};
use zbus::proxy;
use zbus::zvariant::{Array, Dict, Value};

#[proxy(
    interface = "org.freedesktop.DBus.Properties",
    default_service = "org.mpris.MediaPlayer2.spotify",
    default_path = "/org/mpris/MediaPlayer2"
)]
trait MPRISProperties {
    fn get(
        &self,
        interface_name: &str,
        property_name: &str,
    ) -> zbus::Result<zbus::zvariant::OwnedValue>;

    #[zbus(signal)]
    fn properties_changed(
        &self,
        interface_name: &str,
        changed_properties: std::collections::HashMap<String, zbus::zvariant::OwnedValue>,
        invalidated_properties: Vec<String>,
    ) -> zbus::Result<()>;
}

fn parse_metadata(metadata: &zbus::zvariant::OwnedValue) -> Music {
    let mut activity = Music::default();

    let value: &Value = metadata;

    if let Ok(dict) = <&Dict>::try_from(value) {
        if let Ok(Some(v)) = dict.get::<&str, &Value>(&"xesam:title") {
            if let Ok(s) = <&str>::try_from(v) {
                activity.title = s.to_string();
            }
        }

        if let Ok(Some(v)) = dict.get::<&str, &Value>(&"xesam:artist") {
            if let Ok(array) = <&Array>::try_from(v) {
                let artists: Vec<String> = array
                    .iter()
                    .filter_map(|item| <&str>::try_from(item).ok().map(|s| s.to_string()))
                    .collect();
                activity.artist = artists.join(", ");
            } else if let Ok(artist) = <&str>::try_from(v) {
                activity.artist = artist.to_string();
            }
        }

        if let Ok(Some(v)) = dict.get::<&str, &Value>(&"xesam:album") {
            if let Ok(s) = <&str>::try_from(v) {
                activity.album = s.to_string();
            }
        }

        if let Ok(Some(v)) = dict.get::<&str, &Value>(&"mpris:artUrl") {
            if let Ok(s) = <&str>::try_from(v) {
                activity.album_url = s.to_string();
            }
        }
    }

    activity
}

pub async fn monitor_music<R: tauri::Runtime>(app: AppHandle<R>) -> Result<()> {
    let connection = zbus::Connection::session().await.map_err(|e| anyhow!(e))?;

    let proxy = MPRISPropertiesProxy::new(&connection)
        .await
        .map_err(|e| anyhow!(e))?;

    if let Ok(status_val) = proxy
        .get("org.mpris.MediaPlayer2.Player", "PlaybackStatus")
        .await
    {
        if let Ok(status) = <&str>::try_from(&status_val) {
            if status == "Playing" {
                if let Ok(metadata) = proxy.get("org.mpris.MediaPlayer2.Player", "Metadata").await {
                    let activity = parse_metadata(&metadata);
                    let _ = app.emit("music_activity", MusicActivity::Playing(activity));
                }
            } else if status == "Paused" {
                if let Ok(metadata) = proxy.get("org.mpris.MediaPlayer2.Player", "Metadata").await {
                    let activity = parse_metadata(&metadata);
                    let _ = app.emit("music_activity", MusicActivity::Paused(activity));
                }
            } else {
                let _ = app.emit("music_activity", MusicActivity::Stopped);
            }
        }
    }

    let mut stream = proxy
        .receive_properties_changed()
        .await
        .map_err(|e| anyhow!(e))?;

    while let Some(signal) = stream.next().await {
        let args = signal.args().map_err(|e| anyhow!(e))?;

        if args.interface_name == "org.mpris.MediaPlayer2.Player" {
            if let Some(metadata) = args.changed_properties.get("Metadata") {
                let activity = parse_metadata(metadata);
                app.emit("music_activity", activity)
                    .map_err(|e| anyhow!(e))?;
            }
        }
    }

    Ok(())
}
