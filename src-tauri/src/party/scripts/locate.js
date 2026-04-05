(function() {
    const targetMovieId = "MOVIE_ID";
    const currentPath = window.location.pathname;

    if (targetMovieId === "0") {
        if (currentPath !== "/") {
            window.location.href = "/";
        }
    } 
    else if (!currentPath.includes(`/watch/${targetMovieId}`)) {
        window.location.href = `/watch/${targetMovieId}`;
    }
})();