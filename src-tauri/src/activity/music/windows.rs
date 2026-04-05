use super::{Music, MusicActivity};
use crate::error::Result;
use anyhow::anyhow;
use tauri::{AppHandle, Emitter};
use windows::Foundation::TypedEventHandler;
use windows::Media::Control::{
    GlobalSystemMediaTransportControlsSessionManager,
    GlobalSystemMediaTransportControlsSessionPlaybackStatus,
};

pub async fn monitor_music<R: tauri::Runtime>(app: AppHandle<R>) -> Result<()> {
    let manager = GlobalSystemMediaTransportControlsSessionManager::RequestAsync()
        .map_err(|e| anyhow!(e))?
        .await
        .map_err(|e| anyhow!(e))?;

    let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel();

    let tx_session = tx.clone();
    manager
        .CurrentSessionChanged(&TypedEventHandler::new(move |_, _| {
            let _ = tx_session.send(());
            Ok(())
        }))
        .map_err(|e| anyhow!(e))?;

    let mut current_session_id = String::new();

    let _ = tx.send(());

    while let Some(_) = rx.recv().await {
        if let Ok(session) = manager.GetCurrentSession() {
            let source_app = session
                .SourceAppUserModelId()
                .unwrap_or_default()
                .to_string();

            if source_app != current_session_id {
                current_session_id = source_app;

                let tx_props = tx.clone();
                let _ = session.MediaPropertiesChanged(&TypedEventHandler::new(move |_, _| {
                    let _ = tx_props.send(());
                    Ok(())
                }));

                let tx_playback = tx.clone();
                let _ = session.PlaybackInfoChanged(&TypedEventHandler::new(move |_, _| {
                    let _ = tx_playback.send(());
                    Ok(())
                }));
            }

            let status = session
                .GetPlaybackInfo()
                .and_then(|info| info.PlaybackStatus())
                .unwrap_or(GlobalSystemMediaTransportControlsSessionPlaybackStatus::Closed);

            let mut activity = Music::default();

            if let Ok(op) = session.TryGetMediaPropertiesAsync() {
                if let Ok(properties) = op.await {
                    activity.title = properties.Title().unwrap_or_default().to_string();
                    activity.artist = properties.Artist().unwrap_or_default().to_string();
                    activity.album = properties.AlbumTitle().unwrap_or_default().to_string();
                }
            }

            let music_activity = match status {
                GlobalSystemMediaTransportControlsSessionPlaybackStatus::Playing => {
                    MusicActivity::Playing(activity)
                }
                GlobalSystemMediaTransportControlsSessionPlaybackStatus::Paused => {
                    MusicActivity::Paused
                }
                _ => MusicActivity::Stopped,
            };

            let _ = app.emit("music_activity", music_activity);
        } else {
            current_session_id.clear();
            let _ = app.emit("music_activity", MusicActivity::Stopped);
        }
    }

    Ok(())
}
