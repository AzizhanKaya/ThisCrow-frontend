new Promise((resolve, reject) => {
    const log = (msg) => {
        try { sendToTauri(JSON.stringify({ type: "Log", text: "jump_to: " + msg })); } catch (e) {}
    };

    const offset = OFFSET;
    const playing = PLAY;
    const intervalMs = 200;
    const maxAttempts = 50;

    const getPlayer = () => {
        try {
            const api = window.netflix && window.netflix.appContext
                && window.netflix.appContext.state && window.netflix.appContext.state.playerApp
                && window.netflix.appContext.state.playerApp.getAPI && window.netflix.appContext.state.playerApp.getAPI();
            const videoPlayer = api && api.videoPlayer;
            const sessionIds = videoPlayer && videoPlayer.getAllPlayerSessionIds && videoPlayer.getAllPlayerSessionIds();
            if (!sessionIds || sessionIds.length === 0) return null;
            return videoPlayer.getVideoPlayerBySessionId(sessionIds[0]) || null;
        } catch (e) {
            return null;
        }
    };

    log("invoked offset=" + offset + " playing=" + playing);

    let attempts = 0;
    const handle = setInterval(() => {
        attempts++;
        const player = getPlayer();

        if (!player) {
            if (attempts >= maxAttempts) {
                clearInterval(handle);
                log("timeout after " + attempts);
                reject("Netflix player not ready");
            }
            return;
        }

        clearInterval(handle);
        log("player ready after " + attempts);

        // Suppress watching.js echo for ~1.5s after applying the remote seek.
        window.__watchPartySuppressUntil = Date.now() + 1500;
        window.__watchPartyInitialPositionSent = true;

        if (playing) player.play(); else player.pause();
        const targetMs = playing ? Date.now() - offset : offset;
        player.seek(targetMs);
        log("seek=" + targetMs);

        resolve("Success");
    }, intervalMs);
});
