(function () {
    if (window.__watchPartyInstalled) return;
    window.__watchPartyInstalled = true;

    const log = (msg) => {
        try { sendToTauri(JSON.stringify({ type: "Log", text: "watching: " + msg })); } catch (e) {}
    };
    const send = (payload) => {
        try { sendToTauri(JSON.stringify(payload)); } catch (e) {}
    };
    const isSuppressed = () => Date.now() < (window.__watchPartySuppressUntil || 0);

    let lastMovieId;

    const handleUrlChange = () => {
        const path = window.location.pathname;
        const match = path.match(/\/watch\/(\d+)/);

        if (match) {
            const id = match[1];
            if (id === lastMovieId) return;
            lastMovieId = id;
            window.__watchPartyInitialPositionSent = false;
            if (isSuppressed()) return log("Watch suppressed id=" + id);
            log("emit Watch id=" + id);
            send({ type: "Watch", id: Number(id) });
            return;
        }

        if (lastMovieId === undefined) return;
        lastMovieId = undefined;
        window.__watchPartyInitialPositionSent = false;
        if (isSuppressed()) return log("Unwatch suppressed");
        log("emit Unwatch");
        send({ type: "Unwatch" });
    };

    const dispatchChange = () => window.dispatchEvent(new Event('locationchange'));
    const origPush = history.pushState;
    const origReplace = history.replaceState;
    history.pushState = function () { origPush.apply(this, arguments); dispatchChange(); };
    history.replaceState = function () { origReplace.apply(this, arguments); dispatchChange(); };
    window.addEventListener('popstate', dispatchChange);
    window.addEventListener('locationchange', handleUrlChange);

    const onPlayerEvent = (kind, getOffsetAndPlay) => (event) => {
        if (lastMovieId === undefined || event.target.tagName !== 'VIDEO') return;
        if (isSuppressed()) return log(kind + " suppressed");

        const { offset, play } = getOffsetAndPlay(event.target);
        log("emit JumpTo (" + kind + ") offset=" + offset + " play=" + play);
        send({ type: "JumpTo", offset, play });
        window.__watchPartyInitialPositionSent = true;
    };

    document.addEventListener('seeked', onPlayerEvent('seeked', (video) => {
        const playing = !video.paused;
        const videoMs = Math.floor(video.currentTime * 1000);
        return { offset: playing ? Date.now() - videoMs : videoMs, play: playing };
    }), true);

    document.addEventListener('playing', (event) => {
        if (window.__watchPartyInitialPositionSent) return;
        return onPlayerEvent('playing', (video) => ({
            offset: Date.now() - Math.floor(video.currentTime * 1000),
            play: true,
        }))(event);
    }, true);

    log("loaded href=" + window.location.href);
    handleUrlChange();
})();
