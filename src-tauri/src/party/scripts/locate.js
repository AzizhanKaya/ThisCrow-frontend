(function () {
    const log = (msg) => {
        try { sendToTauri(JSON.stringify({ type: "Log", text: "locate: " + msg })); } catch (e) {}
    };

    const targetId = "MOVIE_ID";
    const path = window.location.pathname;

    if (targetId === "0") {
        if (path === "/") return log("home, no-op");
        log("navigating to /");
        window.location.href = "/";
        return;
    }

    if (path.includes("/watch/" + targetId)) return log("already on /watch/" + targetId);
    log("navigating to /watch/" + targetId);
    window.location.href = "/watch/" + targetId;
})();
