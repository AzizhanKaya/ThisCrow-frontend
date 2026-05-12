use super::{Music, MusicActivity};
use anyhow::Result;
use serde::Deserialize;
use std::time::{Instant, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter};
use tokio::sync::mpsc;
use windows::Foundation::TypedEventHandler;
use windows::Media::Control::{
    GlobalSystemMediaTransportControlsSession, GlobalSystemMediaTransportControlsSessionManager,
    GlobalSystemMediaTransportControlsSessionPlaybackStatus,
    GlobalSystemMediaTransportControlsSessionTimelineProperties,
};

enum MediaEvent {
    SessionsChanged,
    MetadataChanged,
    PlaybackChanged,
    TimelineChanged,
}

// Windows DateTime is in 100ns ticks since 1601-01-01 UTC.
// Unix epoch (1970-01-01) is 11_644_473_600 seconds later.
const WINDOWS_TO_UNIX_EPOCH_100NS: i64 = 116_444_736_000_000_000;

fn current_time_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}

fn emit_activity<R: tauri::Runtime>(app: &AppHandle<R>, activity: MusicActivity) {
    println!("Music activity: {:?}", activity);
    let _ = app.emit("music_activity", activity);
}

fn is_spotify(session: &GlobalSystemMediaTransportControlsSession) -> bool {
    session
        .SourceAppUserModelId()
        .ok()
        .map(|s| s.to_string().to_lowercase().contains("spotify"))
        .unwrap_or(false)
}

fn find_spotify_session(
    manager: &GlobalSystemMediaTransportControlsSessionManager,
) -> Option<GlobalSystemMediaTransportControlsSession> {
    let sessions = manager.GetSessions().ok()?;
    let size = sessions.Size().ok()?;
    for i in 0..size {
        if let Ok(session) = sessions.GetAt(i) {
            if is_spotify(&session) {
                return Some(session);
            }
        }
    }
    None
}

/// Returns (position_ms, last_updated_unix_ms) from the timeline.
/// `position_ms` is the position **as of `last_updated_unix_ms`**, not "now".
fn read_timeline(
    timeline: &GlobalSystemMediaTransportControlsSessionTimelineProperties,
) -> (i64, i64) {
    let position_ms = (timeline.Position().unwrap_or_default().Duration / 10_000) as i64;
    let last_updated_ticks = timeline
        .LastUpdatedTime()
        .map(|d| d.UniversalTime)
        .unwrap_or(0);
    let last_updated_ms = if last_updated_ticks == 0 {
        current_time_ms()
    } else {
        (last_updated_ticks - WINDOWS_TO_UNIX_EPOCH_100NS) / 10_000
    };
    (position_ms, last_updated_ms)
}

#[derive(Deserialize)]
struct ItunesResponse {
    results: Vec<ItunesResult>,
}

#[derive(Deserialize)]
struct ItunesResult {
    #[serde(rename = "artworkUrl100")]
    artwork_url_100: Option<String>,
}

async fn search_itunes_artwork(title: &str, artist: &str, album: &str) -> Option<String> {
    let mut query = String::new();
    if !title.is_empty() {
        query.push_str(title);
    }
    if !artist.is_empty() {
        if !query.is_empty() {
            query.push_str(" ");
        }
        query.push_str(artist);
    }
    if !album.is_empty() {
        if !query.is_empty() {
            query.push_str(" ");
        }
        query.push_str(album);
    }

    if query.is_empty() {
        return None;
    }

    let url = url::Url::parse_with_params(
        "https://itunes.apple.com/search",
        &[
            ("term", &query),
            ("entity", &"song".to_string()),
            ("limit", &"1".to_string()),
        ],
    )
    .ok()?;

    let client = reqwest::Client::new();
    if let Ok(resp) = client.get(url).send().await {
        if let Ok(data) = resp.json::<ItunesResponse>().await {
            if let Some(result) = data.results.first() {
                if let Some(mut url) = result.artwork_url_100.clone() {
                    url = url.replace("100x100bb", "256x256bb");
                    return Some(url);
                }
            }
        }
    }
    None
}

async fn build_music(session: &GlobalSystemMediaTransportControlsSession) -> Option<Music> {
    let mut music = Music::default();

    if let Ok(op) = session.TryGetMediaPropertiesAsync() {
        if let Ok(props) = op.await {
            music.title = props
                .Title()
                .ok()
                .map(|s| s.to_string())
                .unwrap_or_default();
            music.artist = props
                .Artist()
                .ok()
                .map(|s| s.to_string())
                .unwrap_or_default();
            music.album = props
                .AlbumTitle()
                .ok()
                .map(|s| s.to_string())
                .unwrap_or_default();

            if !music.title.is_empty() {
                music.album_url = search_itunes_artwork(&music.title, &music.artist, &music.album)
                    .await
                    .unwrap_or_default();
            }
        }
    }

    if let Ok(info) = session.GetPlaybackInfo() {
        if let Ok(status) = info.PlaybackStatus() {
            music.paused =
                status == GlobalSystemMediaTransportControlsSessionPlaybackStatus::Paused;
            if status == GlobalSystemMediaTransportControlsSessionPlaybackStatus::Stopped
                || status == GlobalSystemMediaTransportControlsSessionPlaybackStatus::Closed
            {
                return None;
            }
        }
    }

    if let Ok(timeline) = session.GetTimelineProperties() {
        let length_ms = timeline.EndTime().unwrap_or_default().Duration / 10_000;
        music.length = (length_ms / 1000) as u64;

        let (pos_ms, last_updated_ms) = read_timeline(&timeline);
        if music.paused {
            music.offset = pos_ms;
        } else {
            // Wall-clock time when the song would have started, anchored to
            // the snapshot time (LastUpdatedTime). This is invariant across
            // periodic timeline updates, so the UI doesn't jitter.
            music.offset = last_updated_ms - pos_ms;
        }
    }

    Some(music)
}

pub async fn current_music() -> Option<Music> {
    let manager = GlobalSystemMediaTransportControlsSessionManager::RequestAsync()
        .ok()?
        .await
        .ok()?;

    let session = find_spotify_session(&manager)?;

    let info = session.GetPlaybackInfo().ok()?;
    let status = info.PlaybackStatus().ok()?;

    match status {
        GlobalSystemMediaTransportControlsSessionPlaybackStatus::Playing
        | GlobalSystemMediaTransportControlsSessionPlaybackStatus::Paused => {
            let music = build_music(&session).await?;
            Some(music)
        }
        _ => None,
    }
}

pub async fn monitor_music<R: tauri::Runtime>(app: AppHandle<R>) -> Result<()> {
    let manager = GlobalSystemMediaTransportControlsSessionManager::RequestAsync()?.await?;

    let (tx, mut rx) = mpsc::unbounded_channel();

    let tx_sessions = tx.clone();
    manager.SessionsChanged(&TypedEventHandler::new(move |_, _| {
        let _ = tx_sessions.send(MediaEvent::SessionsChanged);
        Ok(())
    }))?;

    let attach_events = |session: &GlobalSystemMediaTransportControlsSession,
                         sender: mpsc::UnboundedSender<MediaEvent>| {
        let tx_props = sender.clone();
        let _ = session.MediaPropertiesChanged(&TypedEventHandler::new(move |_, _| {
            let _ = tx_props.send(MediaEvent::MetadataChanged);
            Ok(())
        }));

        let tx_playback = sender.clone();
        let _ = session.PlaybackInfoChanged(&TypedEventHandler::new(move |_, _| {
            let _ = tx_playback.send(MediaEvent::PlaybackChanged);
            Ok(())
        }));

        let tx_timeline = sender.clone();
        let _ = session.TimelinePropertiesChanged(&TypedEventHandler::new(move |_, _| {
            let _ = tx_timeline.send(MediaEvent::TimelineChanged);
            Ok(())
        }));
    };

    let mut last_emitted_offset: Option<i64> = None;
    let mut last_emit_time = Instant::now();
    let mut current_session: Option<GlobalSystemMediaTransportControlsSession> =
        find_spotify_session(&manager);

    if let Some(ref session) = current_session {
        attach_events(session, tx.clone());
    }

    loop {
        if let Some(event) = rx.recv().await {
            match event {
                MediaEvent::SessionsChanged => {
                    let new_session = find_spotify_session(&manager);
                    match (&current_session, &new_session) {
                        (None, Some(session)) => {
                            attach_events(session, tx.clone());
                            if let Some(music) = build_music(session).await {
                                last_emitted_offset = Some(music.offset);
                                emit_activity(&app, MusicActivity::Playing(music));
                            }
                        }
                        (Some(_), None) => {
                            last_emitted_offset = None;
                            emit_activity(&app, MusicActivity::Stopped);
                        }
                        _ => {}
                    }
                    current_session = new_session;
                }

                MediaEvent::MetadataChanged => {
                    if let Some(ref session) = current_session {
                        if let Some(music) = build_music(session).await {
                            last_emitted_offset = Some(music.offset);
                            emit_activity(&app, MusicActivity::Playing(music));
                        }
                    }
                }

                MediaEvent::PlaybackChanged => {
                    if let Some(ref session) = current_session {
                        if let Ok(info) = session.GetPlaybackInfo() {
                            if let Ok(status) = info.PlaybackStatus() {
                                match status {
                                    GlobalSystemMediaTransportControlsSessionPlaybackStatus::Playing => {
                                        if let Some(music) = build_music(session).await {
                                            last_emitted_offset = Some(music.offset);
                                            emit_activity(&app, MusicActivity::Playing(music));
                                        }
                                    }
                                    GlobalSystemMediaTransportControlsSessionPlaybackStatus::Paused => {
                                        last_emitted_offset = None;
                                        emit_activity(&app, MusicActivity::Paused);
                                    }
                                    GlobalSystemMediaTransportControlsSessionPlaybackStatus::Stopped
                                    | GlobalSystemMediaTransportControlsSessionPlaybackStatus::Closed => {
                                        last_emitted_offset = None;
                                        emit_activity(&app, MusicActivity::Stopped);
                                    }
                                    _ => {}
                                }
                            }
                        }
                    }
                }

                MediaEvent::TimelineChanged => {
                    let Some(ref session) = current_session else {
                        continue;
                    };
                    let Ok(timeline) = session.GetTimelineProperties() else {
                        continue;
                    };
                    let paused = session
                        .GetPlaybackInfo()
                        .and_then(|i| i.PlaybackStatus())
                        .map(|s| {
                            s == GlobalSystemMediaTransportControlsSessionPlaybackStatus::Paused
                        })
                        .unwrap_or(false);

                    let (pos_ms, last_updated_ms) = read_timeline(&timeline);
                    let offset_for_dedup = if paused {
                        pos_ms
                    } else {
                        last_updated_ms - pos_ms
                    };

                    // During steady playback, periodic timeline updates produce
                    // the same `offset` (song-start instant). Only emit when
                    // it shifts materially (>1s) — that's an actual seek.
                    let now = Instant::now();
                    if let Some(prev) = last_emitted_offset {
                        if (offset_for_dedup - prev).abs() < 1000
                            && now.duration_since(last_emit_time)
                                < std::time::Duration::from_millis(500)
                        {
                            continue;
                        }
                    }
                    last_emitted_offset = Some(offset_for_dedup);
                    last_emit_time = now;

                    let emit_offset = last_updated_ms - pos_ms;
                    println!("Music activity: {:?}", MusicActivity::Seek(emit_offset));
                    let _ = app.emit("music_activity", MusicActivity::Seek(emit_offset));
                }
            }
        }
    }
}
