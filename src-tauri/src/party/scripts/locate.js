(function() {
    const targetMovieId = "MOVIE_ID";
    const currentPath = window.location.pathname;

    // Eğer ID 0 ise ve şu an ana sayfada değilsek, ana sayfaya dön
    if (targetMovieId === "0") {
        if (currentPath !== "/") {
            window.location.href = "/";
        }
    } 
    else if (!currentPath.includes(`/watch/${targetMovieId}`)) {
        window.location.href = `/watch/${targetMovieId}`;
    }
})();