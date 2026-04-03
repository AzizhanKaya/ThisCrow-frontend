let lastMovieId;
let initialPositionSent = false;

function handleUrlChange() {
    const currentUrl = window.location.pathname;

    if (currentUrl.includes('/watch/')) {
        const urlParts = currentUrl.split('/');
        const currentMovieId = urlParts[urlParts.length - 1];

        if (currentMovieId !== lastMovieId) {
            lastMovieId = currentMovieId;
            initialPositionSent = false;
            sendToTauri(JSON.stringify({ type: "Watch", id: Number(lastMovieId) }));
        }
    } else {
        if (lastMovieId !== undefined) {
            lastMovieId = undefined;
            initialPositionSent = false;
            sendToTauri(JSON.stringify({ type: "Unwatch" }));
        }
    }
}

(function () {
    const pushState = history.pushState;
    const replaceState = history.replaceState;

    history.pushState = function () {
        pushState.apply(this, arguments);
        window.dispatchEvent(new Event('locationchange'));
    };

    history.replaceState = function () {
        replaceState.apply(this, arguments);
        window.dispatchEvent(new Event('locationchange'));
    };

    window.addEventListener('popstate', () => {
        window.dispatchEvent(new Event('locationchange'));
    });
})();

window.addEventListener('locationchange', handleUrlChange);

document.addEventListener('seeked', (event) => {
    if (lastMovieId !== undefined && event.target.tagName === 'VIDEO') {
        const videoElement = event.target;
        const isPlaying = !videoElement.paused;
        const videoTimeMs = Math.floor(videoElement.currentTime * 1000);

        const offset = isPlaying 
            ? Date.now() - videoTimeMs 
            : videoTimeMs;

        sendToTauri(JSON.stringify({
            type: "JumpTo",
            offset: offset,
            play: isPlaying
        }));
        
        initialPositionSent = true; 
    }
}, true);

document.addEventListener('playing', (event) => {
    if (lastMovieId !== undefined && event.target.tagName === 'VIDEO') {
        if (!initialPositionSent) {
            const videoElement = event.target;
            const videoTimeMs = Math.floor(videoElement.currentTime * 1000);
            
            const offset = Date.now() - videoTimeMs;
            
            sendToTauri(JSON.stringify({
                type: "JumpTo",
                offset: offset,
                play: true
            }));
            
            initialPositionSent = true;
        }
    }
}, true);