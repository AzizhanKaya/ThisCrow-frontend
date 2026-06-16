use super::{Music, MusicActivity};
use anyhow::Result;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter};

// macOS has no public "now playing" API: MediaRemote is private and was
// locked down for third-party apps in macOS 15.4+, and Spotify's distributed
// notification (`com.spotify.client.PlaybackStateChanged`) fires for play /
// pause / track changes but never for seeks. To produce the same
// `MusicActivity` events as the Linux (MPRIS) and Windows (GSMTC) backends —
// including seeks — we poll Spotify's AppleScript interface on a timer and
// diff snapshots to derive the events.

const POLL_INTERVAL: Duration = Duration::from_secs(1);

// A seek is any position jump that wall-clock playback can't explain. The
// threshold absorbs poll-timing jitter and osascript latency while still
// catching real user seeks (which move by seconds).
const SEEK_THRESHOLD_MS: i64 = 1500;

// Field separator (ASCII Unit Separator). Cannot appear in track metadata,
// so it is safe to join the AppleScript result with it and split in Rust.
const SEP: char = '\u{1f}';

// `application "Spotify" is running` is a non-launching probe that compiles
// even when Spotify isn't installed (it doesn't touch Spotify's scripting
// dictionary), so the idle/no-Spotify case stays cheap and error-free.
const RUNNING_SCRIPT: &str = r#"
if application "Spotify" is running then
	return "running"
else
	return "notrunning"
end if
"#;

// Only run once Spotify is confirmed running, so its scripting dictionary is
// guaranteed to load. Each `current track` access is wrapped in `try` so a
// single missing field (e.g. ads have no artwork) doesn't fail the whole query.
const TRACK_SCRIPT: &str = r#"
tell application "Spotify"
	set pState to (player state as string)
	if pState is "stopped" then
		return "stopped"
	end if
	set tId to ""
	set tTitle to ""
	set tArtist to ""
	set tAlbum to ""
	set tDuration to 0
	set tArtwork to ""
	try
		set tId to (id of current track) as string
	end try
	try
		set tTitle to (name of current track) as string
	end try
	try
		set tArtist to (artist of current track) as string
	end try
	try
		set tAlbum to (album of current track) as string
	end try
	try
		set tDuration to (duration of current track)
	end try
	try
		set tArtwork to (artwork url of current track) as string
	end try
	set posMs to (round ((player position) * 1000))
	set sep to (character id 31)
	return pState & sep & tId & sep & tTitle & sep & tArtist & sep & tAlbum & sep & (tDuration as string) & sep & tArtwork & sep & (posMs as string)
end tell
"#;

enum Snapshot {
    Stopped,
    Track(TrackInfo),
}

struct TrackInfo {
    track_id: String,
    paused: bool,
    position_ms: i64,
    music: Music,
}

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

async fn run_osascript(script: &str) -> Option<String> {
    let output = tokio::process::Command::new("osascript")
        .arg("-e")
        .arg(script)
        .output()
        .await
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let result = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if result.is_empty() {
        None
    } else {
        Some(result)
    }
}

fn parse_snapshot(raw: &str, now_ms: i64) -> Option<Snapshot> {
    if raw == "notrunning" || raw == "stopped" {
        return Some(Snapshot::Stopped);
    }

    let parts: Vec<&str> = raw.split(SEP).collect();
    if parts.len() != 8 {
        return None;
    }

    let paused = parts[0].trim().eq_ignore_ascii_case("paused");
    let track_id = parts[1].to_string();
    let title = parts[2].to_string();
    let artist = parts[3].to_string();
    let album = parts[4].to_string();
    let duration_ms: i64 = parts[5].trim().parse().ok()?;
    let album_url = parts[6].to_string();
    let position_ms: i64 = parts[7].trim().parse().ok()?;

    let length = (duration_ms / 1000).max(0) as u64;
    // Mirrors the other backends: while playing, `offset` is the wall-clock
    // time the track would have started (so it survives periodic updates);
    // while paused, `offset` is the frozen position itself.
    let offset = if paused {
        position_ms
    } else {
        now_ms - position_ms
    };

    let music = Music {
        title,
        artist,
        album,
        album_url,
        length,
        offset,
        paused,
    };

    Some(Snapshot::Track(TrackInfo {
        track_id,
        paused,
        position_ms,
        music,
    }))
}

async fn query_snapshot(now_ms: i64) -> Option<Snapshot> {
    if run_osascript(RUNNING_SCRIPT).await? != "running" {
        return Some(Snapshot::Stopped);
    }

    let raw = run_osascript(TRACK_SCRIPT).await?;
    parse_snapshot(&raw, now_ms)
}

pub async fn current_music() -> Option<Music> {
    match query_snapshot(current_time_ms()).await? {
        Snapshot::Track(info) => Some(info.music),
        Snapshot::Stopped => None,
    }
}

pub async fn monitor_music<R: tauri::Runtime>(app: AppHandle<R>) -> Result<()> {
    // Seed the previous state without emitting: the initial activity is sent
    // separately via the `get_current_music` command, just like the other
    // backends, which only emit on subsequent changes.
    let mut prev: Option<TrackInfo> = match query_snapshot(current_time_ms()).await {
        Some(Snapshot::Track(info)) => Some(info),
        _ => None,
    };

    let mut interval = tokio::time::interval(POLL_INTERVAL);
    interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);

    loop {
        interval.tick().await;
        let now = current_time_ms();

        // A failed/unparseable query is ambiguous (Spotify launching, Apple
        // Events permission still pending, transient error). Keep the last
        // state instead of flickering to "Stopped".
        let snapshot = match query_snapshot(now).await {
            Some(snapshot) => snapshot,
            None => continue,
        };

        match snapshot {
            Snapshot::Stopped => {
                if prev.is_some() {
                    emit_activity(&app, MusicActivity::Stopped);
                    prev = None;
                }
            }
            Snapshot::Track(info) => match &prev {
                None => {
                    emit_activity(&app, MusicActivity::Playing(info.music.clone()));
                    prev = Some(info);
                }
                Some(p) => {
                    if p.track_id != info.track_id {
                        emit_activity(&app, MusicActivity::Playing(info.music.clone()));
                        prev = Some(info);
                    } else if p.paused != info.paused {
                        if info.paused {
                            emit_activity(&app, MusicActivity::Paused);
                        } else {
                            // Resume: re-emit Playing so the offset is re-anchored.
                            emit_activity(&app, MusicActivity::Playing(info.music.clone()));
                        }
                        prev = Some(info);
                    } else {
                        let seeked = if info.paused {
                            (info.position_ms - p.position_ms).abs() > SEEK_THRESHOLD_MS
                        } else {
                            let predicted = now - p.music.offset;
                            (info.position_ms - predicted).abs() > SEEK_THRESHOLD_MS
                        };

                        if seeked {
                            let seek_offset = now - info.position_ms;
                            println!("Music activity: {:?}", MusicActivity::Seek(seek_offset));
                            let _ = app.emit("music_activity", MusicActivity::Seek(seek_offset));
                            prev = Some(info);
                        }
                    }
                }
            },
        }
    }
}
