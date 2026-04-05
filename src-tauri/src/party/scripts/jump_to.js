new Promise((resolve, reject) => {
    let attempts = 0;
    const maxAttempts = 50;
    const intervalMs = 200;

    const checkPlayerReady = setInterval(() => {
        attempts++;
        try {
            if (
                window.netflix &&
                window.netflix.appContext &&
                window.netflix.appContext.state &&
                window.netflix.appContext.state.playerApp &&
                window.netflix.appContext.state.playerApp.getAPI
            ) {
                const videoPlayer = window.netflix.appContext.state.playerApp.getAPI().videoPlayer;
                
                if (videoPlayer) {
                    const sessionIds = videoPlayer.getAllPlayerSessionIds();
                    
                    if (sessionIds && sessionIds.length > 0) {
                        const sessionId = sessionIds[0];
                        const player = videoPlayer.getVideoPlayerBySessionId(sessionId);

                        if (player) {
                            clearInterval(checkPlayerReady);
                            
                            const offset = OFFSET;
                            const isPlaying = PLAY;

                            if (isPlaying) {
                                player.play();
                            } else {
                                player.pause();
                            }

                            const targetMs = isPlaying ? (Date.now() - offset) : offset;
                            player.seek(targetMs);

                            resolve("Success");
                            return;
                        }
                    }
                }
            }
        } catch (e) {
            console.warn("Netflix player not ready, retrying...", e);
        }

        if (attempts >= maxAttempts) {
            clearInterval(checkPlayerReady);
            reject("Netflix player not ready (Timeout).");
        }
    }, intervalMs);
});