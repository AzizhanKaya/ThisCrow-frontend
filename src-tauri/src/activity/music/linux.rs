use super::{Music, MusicActivity};
use anyhow::Result;
use futures_util::StreamExt;
use std::collections::HashMap;
use std::convert::TryFrom;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter};
use zbus::fdo::DBusProxy;
use zbus::proxy;
use zbus::zvariant::{Array, Dict, Value};

const PLAYER_INTERFACE: &str = "org.mpris.MediaPlayer2.Player";
const PLAYBACK_STATUS: &str = "PlaybackStatus";
const METADATA: &str = "Metadata";
const POSITION: &str = "Position";

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
        changed_properties: HashMap<String, zbus::zvariant::OwnedValue>,
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

fn current_time_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis() as i64
}

fn emit_activity<R: tauri::Runtime>(app: &AppHandle<R>, activity: MusicActivity) {
    println!("Music activity: {:?}", activity);
    let _ = app.emit("music_activity", activity.clone());
}

fn parse_metadata(metadata: &Value) -> Music {
    let mut activity = Music::default();

    let Ok(dict) = <&Dict>::try_from(metadata as &Value) else {
        return activity;
    };

    let get_string = |key: &str| -> Option<String> {
        let value = dict.get::<&str, &Value>(&key).ok().flatten()?;
        <&str>::try_from(value).ok().map(|s| s.to_string())
    };

    if let Some(title) = get_string("xesam:title") {
        activity.title = title;
    }

    if let Some(album) = get_string("xesam:album") {
        activity.album = album;
    }

    if let Some(url) = get_string("mpris:artUrl") {
        activity.album_url = url;
    }

    if let Ok(Some(v)) = dict.get::<&str, &Value>(&"mpris:length") {
        if let Ok(length_us) = <u64>::try_from(v) {
            activity.length = length_us / 1_000_000;
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

    activity
}

async fn get_playback_status(proxy: &MPRISPropertiesProxy<'_>) -> String {
    proxy
        .get(PLAYER_INTERFACE, PLAYBACK_STATUS)
        .await
        .ok()
        .and_then(|v| <&str>::try_from(&v).ok().map(|s| s.to_string()))
        .unwrap_or_else(|| "Stopped".to_string())
}

async fn get_current_position(proxy: &MPRISPropertiesProxy<'_>) -> Option<i64> {
    let pos_val = proxy.get(PLAYER_INTERFACE, POSITION).await.ok()?;
    let pos_us = <i64>::try_from(&pos_val).ok()?;
    Some(pos_us / 1000)
}

async fn build_music<'a>(
    proxy: &MPRISPropertiesProxy<'_>,
    metadata: &Value<'_>,
    status: &str,
) -> Music {
    let mut music = parse_metadata(metadata);
    music.paused = status == "Paused";

    if let Some(pos_ms) = get_current_position(proxy).await {
        if music.paused {
            music.offset = pos_ms;
        } else {
            music.offset = current_time_ms() - pos_ms;
        }
    }

    music
}

pub async fn current_music() -> Option<MusicActivity> {
    let connection = zbus::Connection::session().await.ok()?;
    let proxy = MPRISPropertiesProxy::new(&connection).await.ok()?;

    let status = get_playback_status(&proxy).await;

    match status.as_str() {
        "Playing" | "Paused" => {
            let metadata_val = proxy.get(PLAYER_INTERFACE, METADATA).await.ok()?;
            let music = build_music(&proxy, &metadata_val, &status).await;
            Some(MusicActivity::Playing(music))
        }
        _ => None,
    }
}

pub async fn monitor_music<R: tauri::Runtime>(app: AppHandle<R>) -> Result<()> {
    let connection = zbus::Connection::session()
        .await
        .map_err(anyhow::Error::from)?;

    let properties_proxy = MPRISPropertiesProxy::new(&connection)
        .await
        .map_err(anyhow::Error::from)?;

    let player_proxy = MPRISPlayerProxy::new(&connection)
        .await
        .map_err(anyhow::Error::from)?;

    let mut properties_stream = properties_proxy
        .receive_properties_changed()
        .await
        .map_err(anyhow::Error::from)?;

    let mut seeked_stream = player_proxy
        .receive_seeked()
        .await
        .map_err(anyhow::Error::from)?;

    let dbus_proxy = DBusProxy::new(&connection)
        .await
        .map_err(anyhow::Error::from)?;

    let mut name_owner_stream = dbus_proxy
        .receive_name_owner_changed()
        .await
        .map_err(anyhow::Error::from)?;

    let mut last_position: i64 = 0;
    let mut last_seek_time = Instant::now();

    loop {
        tokio::select! {
            Some(signal) = properties_stream.next() => {
                let Ok(args) = signal.args() else { continue };

                if args.interface_name != PLAYER_INTERFACE {
                    continue;
                }

                if let Some(metadata_val) = args.changed_properties.get(METADATA) {
                    let status = get_playback_status(&properties_proxy).await;
                    let music = build_music(&properties_proxy, metadata_val, &status).await;
                    emit_activity(&app, MusicActivity::Playing(music));
                    continue;
                }

               if let Some(status_val) = args.changed_properties.get(PLAYBACK_STATUS) {
                    if let Ok(status) = <&str>::try_from(status_val) {
                        match status {
                            "Playing" => {
                                if let Ok(meta_val) = properties_proxy.get(PLAYER_INTERFACE, METADATA).await {
                                    let music = build_music(&properties_proxy, &meta_val, status).await;
                                    emit_activity(&app, MusicActivity::Playing(music));
                                }
                            },
                            "Paused" => emit_activity(&app, MusicActivity::Paused),
                            "Stopped" => emit_activity(&app, MusicActivity::Stopped),
                            _ => {}
                        }
                    }
                }
            },

            Some(signal) = name_owner_stream.next() => {
            if let Ok(args) = signal.args() {
                if args.name() == "org.mpris.MediaPlayer2.spotify" && args.new_owner().is_none() {
                    emit_activity(&app, MusicActivity::Stopped);
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

                if position / 1000 == last_position / 1000 && now.duration_since(last_seek_time) < Duration::from_millis(500) {
                    continue;
                }

                last_position = position;
                last_seek_time = now;

                let offset = current_time_ms() - position;

                println!("Music activity: {:?}", MusicActivity::Seek(offset));
                let _ = app.emit("music_activity", MusicActivity::Seek(offset));
            }
        }
    }
}
