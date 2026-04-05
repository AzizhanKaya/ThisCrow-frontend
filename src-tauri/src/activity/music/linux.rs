use super::{Music, MusicActivity};
use crate::error::Result;
use anyhow::anyhow;
use futures_util::StreamExt;
use std::convert::TryFrom;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
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

#[proxy(
    interface = "org.mpris.MediaPlayer2.Player",
    default_service = "org.mpris.MediaPlayer2.spotify",
    default_path = "/org/mpris/MediaPlayer2"
)]
trait MPRISPlayer {
    #[zbus(signal)]
    fn seeked(&self, position: i64) -> zbus::Result<()>;
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

        if let Ok(Some(v)) = dict.get::<&str, &Value>(&"mpris:length") {
            if let Ok(length_us) = <u64>::try_from(v) {
                activity.length = length_us / 1_000_000;
            }
        }
    }

    activity
}

pub async fn monitor_music<R: tauri::Runtime>(app: AppHandle<R>) -> Result<()> {
    let connection = zbus::Connection::session().await.map_err(|e| anyhow!(e))?;

    let properties_proxy = MPRISPropertiesProxy::new(&connection)
        .await
        .map_err(|e| anyhow!(e))?;

    let player_proxy = MPRISPlayerProxy::new(&connection)
        .await
        .map_err(|e| anyhow!(e))?;

    if let Ok(status_val) = properties_proxy
        .get("org.mpris.MediaPlayer2.Player", "PlaybackStatus")
        .await
    {
        if let Ok(status) = <&str>::try_from(&status_val) {
            if status == "Playing" || status == "Paused" {
                if let Ok(metadata) = properties_proxy
                    .get("org.mpris.MediaPlayer2.Player", "Metadata")
                    .await
                {
                    let activity = parse_metadata(&metadata);

                    let activity_enum = if status == "Playing" {
                        MusicActivity::Playing(activity)
                    } else {
                        MusicActivity::Paused
                    };
                    let _ = app.emit("music_activity", activity_enum);
                }
            }
        }
    }

    let mut properties_stream = properties_proxy
        .receive_properties_changed()
        .await
        .map_err(|e| anyhow!(e))?;

    let mut seeked_stream = player_proxy
        .receive_seeked()
        .await
        .map_err(|e| anyhow!(e))?;

    let mut last_position: i64 = 0;
    let mut last_seek_time = Instant::now();

    loop {
        tokio::select! {
            Some(signal) = properties_stream.next() => {
                let args = match signal.args() {
                    Ok(a) => a,
                    Err(e) => {
                        eprintln!("Signal args error: {}", e);
                        continue;
                    }
                };

                if args.interface_name == "org.mpris.MediaPlayer2.Player" {
                    if let Some(metadata) = args.changed_properties.get("Metadata") {
                        let activity = parse_metadata(metadata);

                        let _ = app.emit("music_activity", MusicActivity::Playing(activity));
                    }

                    if let Some(status_val) = args.changed_properties.get("PlaybackStatus") {
                        if let Ok(status) = <&str>::try_from(status_val) {

                            if let Ok(metadata) = properties_proxy.get("org.mpris.MediaPlayer2.Player", "Metadata").await {
                                let activity = parse_metadata(&metadata);

                                if status == "Playing" {
                                    let _ = app.emit("music_activity", MusicActivity::Playing(activity));
                                } else {
                                    let _ = app.emit("music_activity", MusicActivity::Paused);
                                }
                            }
                        }
                    }
                }
            },

            Some(signal) = seeked_stream.next() => {
                let args = match signal.args() {
                    Ok(a) => a,
                    Err(e) => {
                        eprintln!("Seeked signal error: {}", e);
                        continue;
                    }
                };

                let position = args.position / 1000;
                let now = Instant::now();

                if position / 1000 == last_position / 1000
                && now.duration_since(last_seek_time) < Duration::from_millis(500) {
                    continue;
                }

                last_position = position;
                last_seek_time = now;

                let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis() as i64;
                let offset = now - position;

                let _ = app.emit("music_activity", MusicActivity::Seek(offset));
            }
        }
    }
}
