use super::{Music, MusicActivity};
use crate::error::Result;
use anyhow::anyhow;
use tauri::{AppHandle, Emitter, Runtime};
use tokio::sync::mpsc;
use windows::Foundation::TypedEventHandler;
use windows::Media::Control::{
    GlobalSystemMediaTransportControlsSession, GlobalSystemMediaTransportControlsSessionManager,
    GlobalSystemMediaTransportControlsSessionPlaybackStatus as PlaybackStatus,
};
use windows::Storage::Streams::DataReader;

fn encode_base64(input: &[u8]) -> String {
    const ALPHABET: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity((input.len() + 2) / 3 * 4);
    let mut it = input.chunks_exact(3);
    for chunk in &mut it {
        let n = (chunk[0] as u32) << 16 | (chunk[1] as u32) << 8 | (chunk[2] as u32);
        out.push(ALPHABET[(n >> 18) as usize] as char);
        out.push(ALPHABET[((n >> 12) & 0x3F) as usize] as char);
        out.push(ALPHABET[((n >> 6) & 0x3F) as usize] as char);
        out.push(ALPHABET[(n & 0x3F) as usize] as char);
    }
    let rem = it.remainder();
    if rem.len() == 1 {
        let n = (rem[0] as u32) << 16;
        out.push(ALPHABET[(n >> 18) as usize] as char);
        out.push(ALPHABET[((n >> 12) & 0x3F) as usize] as char);
        out.push('=');
        out.push('=');
    } else if rem.len() == 2 {
        let n = (rem[0] as u32) << 16 | (rem[1] as u32) << 8;
        out.push(ALPHABET[(n >> 18) as usize] as char);
        out.push(ALPHABET[((n >> 12) & 0x3F) as usize] as char);
        out.push(ALPHABET[((n >> 6) & 0x3F) as usize] as char);
        out.push('=');
    }
    out
}

pub async fn monitor_music<R: Runtime>(app: AppHandle<R>) -> Result<()> {
    let manager = GlobalSystemMediaTransportControlsSessionManager::RequestAsync()
        .map_err(|e| anyhow!(e))?
        .await
        .map_err(|e| anyhow!(e))?;

    let (tx, mut rx) = mpsc::unbounded_channel::<()>();

    let tx_clone1 = tx.clone();
    let _current_session_changed_token = manager
        .CurrentSessionChanged(&TypedEventHandler::new(move |_, _| {
            let _ = tx_clone1.send(());
            Ok(())
        }))
        .map_err(|e| anyhow!(e))?;

    let tx_clone2 = tx.clone();
    let _sessions_changed_token = manager
        .SessionsChanged(&TypedEventHandler::new(move |_, _| {
            let _ = tx_clone2.send(());
            Ok(())
        }))
        .map_err(|e| anyhow!(e))?;

    let _ = tx.send(());

    let mut current_session: Option<GlobalSystemMediaTransportControlsSession> = None;
    let mut playback_token = None;
    let mut properties_token = None;

    while let Some(_) = rx.recv().await {
        let new_session = manager.GetCurrentSession().ok();

        let mut session_changed = false;
        match (&current_session, &new_session) {
            (Some(c), Some(n)) => {
                let current_id = c.SourceAppUserModelId().unwrap_or_default().to_string();
                let new_id = n.SourceAppUserModelId().unwrap_or_default().to_string();
                if current_id != new_id {
                    session_changed = true;
                }
            }
            (None, Some(_)) => session_changed = true,
            (Some(_), None) => session_changed = true,
            (None, None) => {}
        }

        if session_changed {
            if let Some(session) = current_session.take() {
                if let Some(token) = playback_token.take() {
                    let _ = session.RemovePlaybackInfoChanged(token);
                }
                if let Some(token) = properties_token.take() {
                    let _ = session.RemoveMediaPropertiesChanged(token);
                }
            }

            if let Some(session) = &new_session {
                let tx_playback = tx.clone();
                if let Ok(token) = session.PlaybackInfoChanged(&TypedEventHandler::new(
                    move |_, _| {
                        let _ = tx_playback.send(());
                        Ok(())
                    },
                )) {
                    playback_token = Some(token);
                }

                let tx_properties = tx.clone();
                if let Ok(token) = session.MediaPropertiesChanged(&TypedEventHandler::new(
                    move |_, _| {
                        let _ = tx_properties.send(());
                        Ok(())
                    },
                )) {
                    properties_token = Some(token);
                }

                current_session = Some(session.clone());
            }
        }

        if let Some(session) = &current_session {
            if let Ok(playback_info) = session.GetPlaybackInfo() {
                if let Ok(playback_status) = playback_info.PlaybackStatus() {
                    let is_playing = playback_status == PlaybackStatus::Playing;
                    let is_paused = playback_status == PlaybackStatus::Paused;

                    if is_playing || is_paused {
                        if let Ok(op) = session.TryGetMediaPropertiesAsync() {
                            if let Ok(properties) = op.await {
                                let title = properties.Title().unwrap_or_default().to_string();
                                let artist = properties.Artist().unwrap_or_default().to_string();
                                let album = properties.AlbumTitle().unwrap_or_default().to_string();

                                let mut album_url = String::new();
                                if let Ok(thumbnail_ref) = properties.Thumbnail() {
                                    if let Ok(stream_op) = thumbnail_ref.OpenReadAsync() {
                                        if let Ok(stream) = stream_op.await {
                                            if let Ok(size) = stream.Size() {
                                                if let Ok(reader) = DataReader::CreateDataReader(&stream) {
                                                    if let Ok(op) = reader.LoadAsync(size as u32) {
                                                        if let Ok(_) = op.await {
                                                            let mut buffer = vec![0u8; size as usize];
                                                            if let Ok(_) = reader.ReadBytes(&mut buffer) {
                                                                let b64 = encode_base64(&buffer);
                                                                let content_type = stream
                                                                    .ContentType()
                                                                    .unwrap_or_default()
                                                                    .to_string();
                                                                let mime = if content_type.is_empty() {
                                                                    "image/jpeg".to_string()
                                                                } else {
                                                                    content_type
                                                                };
                                                                album_url = format!("data:{};base64,{}", mime, b64);
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }

                                let activity = Music {
                                    title,
                                    artist,
                                    album,
                                    album_url,
                                };

                                let _ = app.emit(
                                    "music_activity",
                                    if is_playing {
                                        MusicActivity::Playing(activity)
                                    } else {
                                        MusicActivity::Paused(activity)
                                    },
                                );
                            }
                        }
                    } else {
                        let _ = app.emit("music_activity", MusicActivity::Stopped);
                    }
                }
            }
        } else {
            let _ = app.emit("music_activity", MusicActivity::Stopped);
        }
    }

    Ok(())
}
