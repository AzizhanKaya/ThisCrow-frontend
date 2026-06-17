(function () {
    if (window.__watchPartyInstalled) return;
    window.__watchPartyInstalled = true;

    const SEEK_THRESHOLD_MS = 1500;
    const PLAYER_POLL_MS = 8000;
    const HEARTBEAT_MS = 5000;
    const PENDING_KEY = '__wp_pending';

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const emit = (payload) => sendToTauri(JSON.stringify(payload));

    class PlayerAdapter {
        static find() {
            const player = PlayerAdapter.findNetflix();
            return player ? new PlayerAdapter(player) : null;
        }

        static findNetflix() {
            try {
                const api = window.netflix?.appContext?.state?.playerApp?.getAPI?.();
                if (!api?.videoPlayer) return null;

                const ids = api.videoPlayer.getAllPlayerSessionIds?.();
                if (!ids?.length) return null;

                return api.videoPlayer.getVideoPlayerBySessionId(ids[0]) || null;
            } catch (_) {
                return null;
            }
        }

        static async poll(timeout = PLAYER_POLL_MS) {
            const deadline = Date.now() + timeout;
            let wait = 100;
            while (Date.now() < deadline) {
                const adapter = PlayerAdapter.find();
                if (adapter) return adapter;
                await sleep(wait);
                wait = Math.min(wait * 2, 1600);
            }
            return null;
        }

        constructor(player) {
            this.player = player;
        }

        play() {
            this.player.play();
        }

        pause() {
            this.player.pause();
        }

        seek(ms) {
            this.player.seek(ms);
        }

        currentMs() {
            const time = this.player.getCurrentTime?.();
            return typeof time === 'number' ? Math.floor(time) : 0;
        }

        paused() {
            const paused = this.player.isPaused?.();
            return typeof paused === 'boolean' ? paused : true;
        }

        durationMs() {
            const duration = this.player.getDuration?.();
            return typeof duration === 'number' && isFinite(duration) && duration > 0
                ? Math.floor(duration)
                : null;
        }

        async pollDurationMs(currentVideoId, videoId, timeout = 5000) {
            const deadline = Date.now() + timeout;
            let wait = 200;
            while (Date.now() < deadline) {
                if (currentVideoId() !== videoId) return null;
                const duration = this.durationMs();
                if (duration !== null) return duration;
                await sleep(wait);
                wait = Math.min(wait * 1.5, 800);
            }
            return this.durationMs();
        }
    }

    class MetadataExtractor {
        static TITLE_SELECTORS = [
            '[data-uia="video-title"]',
            '[data-uia="player-status-main-title"]',
            '.player-status-main-title',
            '.video-title h4',
            '.video-title',
        ];

        static gqlCache() {
            return (
                window.netflix?.appContext?.state?.graphqlClient?.cache?.data?.data ??
                null
            );
        }

        static stringify(value) {
            try {
                return JSON.stringify(value);
            } catch (_) {
                return '';
            }
        }

        static videoIdFromKey(key) {
            return (key.match(/"videoId":(\d+)/) || [])[1] ?? null;
        }

        static cleanText(value) {
            return typeof value === 'string' && value.trim() ? value.trim() : null;
        }

        static fromGraphQL(videoId) {
            try {
                const cache = MetadataExtractor.gqlCache();
                if (!cache) return null;

                const chain = MetadataExtractor.episodeChain(cache, videoId);
                const title = chain
                    ? MetadataExtractor.episodeTitle(chain)
                    : MetadataExtractor.entityTitle(cache, videoId);

                let thumbnail = MetadataExtractor.artworkFor(cache, videoId);
                if (!thumbnail && chain?.showId) {
                    thumbnail = MetadataExtractor.artworkFor(cache, chain.showId);
                }

                return { title, thumbnail };
            } catch (_) {
                return null;
            }
        }

        static episodeTitle(chain) {
            const code = [];
            if (chain.seasonNumber != null) code.push('S' + chain.seasonNumber);
            if (chain.episodeNumber != null) code.push('E' + chain.episodeNumber);

            const parts = [
                chain.showTitle,
                code.join(':') || null,
                chain.episodeTitle,
            ].filter(Boolean);

            return parts.length ? parts.join(' · ') : null;
        }

        static entityTitle(cache, videoId) {
            for (const typeName of ['Movie', 'Show', 'Episode', 'Video']) {
                const title = cache[`${typeName}:{"videoId":${videoId}}`]?.title;
                if (
                    typeof title === 'string' &&
                    title.trim() &&
                    title.toLowerCase() !== 'netflix'
                ) {
                    return title.trim();
                }
            }
            return null;
        }

        static episodeChain(cache, videoId) {
            const episode = cache[`Episode:{"videoId":${videoId}}`];
            if (!episode) return null;

            const includesId = (entity, id) =>
                MetadataExtractor.stringify(entity).includes(String(id));

            let seasonId = episode.parentSeason?.__ref
                ? MetadataExtractor.videoIdFromKey(episode.parentSeason.__ref)
                : null;
            if (!seasonId) {
                const key = Object.keys(cache).find(
                    (k) => k.startsWith('Season:') && includesId(cache[k], videoId),
                );
                seasonId = key ? MetadataExtractor.videoIdFromKey(key) : null;
            }

            const needle = String(seasonId ?? videoId);
            let showId = null;
            for (const [key, entity] of Object.entries(cache)) {
                if (key.startsWith('Show:') && includesId(entity, needle)) {
                    showId = MetadataExtractor.videoIdFromKey(key);
                    break;
                }
            }

            const season = seasonId ? cache[`Season:{"videoId":${seasonId}}`] : null;
            const show = showId ? cache[`Show:{"videoId":${showId}}`] : null;

            return {
                showId,
                seasonNumber: season?.number ?? null,
                episodeNumber: episode.number ?? null,
                episodeTitle: MetadataExtractor.cleanText(episode.title),
                showTitle: MetadataExtractor.cleanText(show?.title),
            };
        }

        static artworkFor(cache, id) {
            let sdpBest = null;
            let sdpArea = 0;
            let anyBest = null;
            let anyArea = 0;

            for (const [key, entity] of Object.entries(cache)) {
                if (!key.includes(`"videoId":${id}`)) continue;

                for (const [field, value] of Object.entries(entity)) {
                    const url = value?.url;
                    if (typeof url !== 'string' || !url.includes('nflxso.net')) {
                        continue;
                    }

                    const { area, type } = MetadataExtractor.parseArtwork(field, value);
                    if (type === 'SDP') {
                        if (area > sdpArea) {
                            sdpArea = area;
                            sdpBest = url;
                        }
                    } else if (area > anyArea) {
                        anyArea = area;
                        anyBest = url;
                    }
                }
            }

            return sdpBest || anyBest;
        }

        static parseArtwork(field, value) {
            let width = value?.width ?? 0;
            let height = value?.height ?? 0;
            let type = null;

            const match = field.match(/\(({.*})\)$/);
            if (match) {
                try {
                    const params = JSON.parse(match[1])?.params;
                    width = params?.dimension?.width ?? width;
                    height = params?.dimension?.height ?? height;
                    type = params?.artworkType ?? null;
                } catch (_) {}
            }

            return { area: width * height, type };
        }

        static fromFalcorCache(videoId) {
            try {
                const video = window.netflix?.falcorCache?.videos?.[videoId];
                if (!video) return null;

                const title = video.title;
                if (typeof title === 'string' && title.trim()) return title.trim();

                const nested = title?.value ?? title?.$value;
                if (typeof nested === 'string' && nested.trim()) return nested.trim();

                return null;
            } catch (_) {
                return null;
            }
        }

        static fromDom() {
            for (const selector of MetadataExtractor.TITLE_SELECTORS) {
                const text = document.querySelector(selector)?.textContent?.trim();
                if (text && text.toLowerCase() !== 'netflix') return text;
            }
            return null;
        }

        static fromCleanDocTitle() {
            const title = document.title.replace(/\s*-\s*Netflix\s*$/i, '').trim();
            return title && title.toLowerCase() !== 'netflix' ? title : null;
        }

        static async extract(adapter, videoId, currentVideoId) {
            const meta = await MetadataExtractor.resolveTitleAndThumbnail(
                videoId,
                currentVideoId,
            );
            if (!meta) return { title: null, duration: null, thumbnail: null };

            const title =
                meta.title ||
                MetadataExtractor.fromDom() ||
                MetadataExtractor.fromCleanDocTitle();
            const duration = await MetadataExtractor.resolveDuration(
                adapter,
                videoId,
                currentVideoId,
            );

            MetadataExtractor.logResult(title, duration, meta.thumbnail);
            return { title, duration, thumbnail: meta.thumbnail };
        }

        static async resolveTitleAndThumbnail(videoId, currentVideoId) {
            let { title, thumbnail } = MetadataExtractor.fromGraphQL(videoId) ?? {};
            title = title || MetadataExtractor.fromFalcorCache(videoId);
            if (title && thumbnail) return { title, thumbnail };

            const deadline = Date.now() + 5000;
            let wait = 150;
            while (Date.now() < deadline) {
                if (currentVideoId() !== videoId) return null;
                await sleep(wait);

                const gql = MetadataExtractor.fromGraphQL(videoId) ?? {};
                title =
                    title || gql.title || MetadataExtractor.fromFalcorCache(videoId);
                thumbnail = thumbnail || gql.thumbnail;
                if (title && thumbnail) break;

                wait = Math.min(wait * 1.5, 600);
            }

            return { title, thumbnail };
        }

        static async resolveDuration(adapter, videoId, currentVideoId) {
            if (!adapter) return null;

            const duration = adapter.durationMs();
            if (duration !== null) return duration;

            return adapter.pollDurationMs(currentVideoId, videoId, 5000);
        }

        static logResult(title, duration, thumbnail) {
            emit({
                type: 'Log',
                msg:
                    (title ?? 'no-title') +
                    '   ' +
                    (duration ?? 'no-duration') +
                    '   ' +
                    (thumbnail ?? 'no-thumb'),
            });
        }
    }

    class UrlWatcher {
        constructor(onChange) {
            this.onChange = onChange;
            this.lastPath = window.location.pathname;
        }

        install() {
            const dispatch = () =>
                window.dispatchEvent(new Event('locationchange'));

            const originalPush = history.pushState;
            const originalReplace = history.replaceState;

            history.pushState = function () {
                originalPush.apply(this, arguments);
                dispatch();
            };
            history.replaceState = function () {
                originalReplace.apply(this, arguments);
                dispatch();
            };

            window.addEventListener('popstate', dispatch);
            window.addEventListener('locationchange', () => this.onChange());

            setInterval(() => {
                if (window.location.pathname !== this.lastPath) {
                    this.lastPath = window.location.pathname;
                    this.onChange();
                }
            }, 500);
        }
    }

    class WatchParty {
        static AUTH_PATHS = [
            '/login',
            '/profiles',
            '/SignOut',
            '/loginhelp',
            '/password',
            '/signup',
        ];

        static MEDIA_EVENTS = [
            'play',
            'pause',
            'seeked',
            'ratechange',
            'waiting',
            'ended',
        ];

        constructor() {
            this.videoId = null;
            this.heartbeatTimer = null;
            this.mediaUnlisteners = null;
        }

        static parseVideoId(path) {
            const match = (path || '').match(/\/watch\/(\d+)/);
            return match ? Number(match[1]) : null;
        }

        start() {
            new UrlWatcher(() => this.handleUrlChange()).install();
            this.drainPendingState();
            this.handleUrlChange();

            window.__watchPartyApplyState = (videoId, offsetMs, playing) =>
                this.applyState(videoId, offsetMs, playing);
        }

        send(message) {
            try {
                emit(message);
            } catch (_) {}
        }

        isAuthPage() {
            const path = window.location.pathname;
            return WatchParty.AUTH_PATHS.some((prefix) => path.startsWith(prefix));
        }

        isMainPlayer(el) {
            if (!el || el.tagName !== 'VIDEO') return false;
            return (
                el.closest('.watch-video--player-view') !== null ||
                el.closest('[data-uia="player"]') !== null ||
                document.querySelectorAll('video').length === 1
            );
        }

        async applyState(videoId, offsetMs, playing) {
            if (videoId === 0) {
                if (window.location.pathname.includes('/watch/')) {
                    window.location.href = '/';
                }
                return 'home';
            }

            if (this.isAuthPage()) return 'auth_page';

            const currentVideoId = WatchParty.parseVideoId(window.location.pathname);
            if (currentVideoId !== videoId) {
                sessionStorage.setItem(
                    PENDING_KEY,
                    JSON.stringify({ offsetMs, playing }),
                );
                window.location.href = '/watch/' + videoId;
                return 'navigating';
            }

            const adapter = await PlayerAdapter.poll();
            if (!adapter) return 'no_player';

            const targetMs = playing ? Date.now() - offsetMs : offsetMs;
            const needSeek =
                Math.abs(adapter.currentMs() - targetMs) > SEEK_THRESHOLD_MS;
            const needPlayChange = adapter.paused() === playing;

            if (!needSeek && !needPlayChange) return 'ok_no_change';

            if (needSeek) adapter.seek(targetMs);
            if (needPlayChange) {
                playing ? adapter.play() : adapter.pause();
            }

            return 'ok';
        }

        installHeartbeat() {
            this.uninstallHeartbeat();
            this.heartbeatTimer = setInterval(() => {
                if (this.videoId === null) return;

                const adapter = PlayerAdapter.find();
                if (!adapter) return;

                const playing = !adapter.paused();
                const offset = playing
                    ? Date.now() - adapter.currentMs()
                    : adapter.currentMs();

                this.send({ type: 'HeartBeat', offset, playing });
            }, HEARTBEAT_MS);
        }

        uninstallHeartbeat() {
            if (this.heartbeatTimer) {
                clearInterval(this.heartbeatTimer);
                this.heartbeatTimer = null;
            }
        }

        emitVideoEvent(el) {
            if (this.videoId === null) return;
            if (!this.isMainPlayer(el)) return;

            const currentMs = Math.floor(el.currentTime * 1000);
            const playing = !el.paused;
            const offset = playing ? Date.now() - currentMs : currentMs;

            this.send({ type: 'HeartBeat', offset, playing });
        }

        installMediaListeners() {
            this.uninstallMediaListeners();
            this.mediaUnlisteners = WatchParty.MEDIA_EVENTS.map((event) => {
                const handler = (e) => this.emitVideoEvent(e.target);
                document.addEventListener(event, handler, true);
                return () => document.removeEventListener(event, handler, true);
            });
        }

        uninstallMediaListeners() {
            if (!this.mediaUnlisteners) return;
            for (const off of this.mediaUnlisteners) off();
            this.mediaUnlisteners = null;
        }

        stopTracking() {
            this.uninstallHeartbeat();
            this.uninstallMediaListeners();
        }

        async handleUrlChange() {
            const videoId = WatchParty.parseVideoId(window.location.pathname);

            if (videoId !== null) {
                if (videoId === this.videoId) return;
                this.stopTracking();
                this.videoId = videoId;
                await this.sendWatchWithMetadata(videoId);
                return;
            }

            if (this.videoId !== null) {
                this.stopTracking();
                this.videoId = null;
                this.send({
                    type: 'Watch',
                    offset: 0,
                    playing: false,
                    video_id: 0,
                    title: '',
                    duration: 0,
                    thumbnail: '',
                });
            }
        }

        async sendWatchWithMetadata(videoId) {
            const adapter = await PlayerAdapter.poll();
            if (this.videoId !== videoId) return;

            const meta = await MetadataExtractor.extract(
                adapter,
                videoId,
                () => this.videoId,
            );
            if (this.videoId !== videoId) return;

            const playing = adapter ? !adapter.paused() : false;
            const currentMs = adapter ? adapter.currentMs() : 0;
            const offset = playing ? Date.now() - currentMs : currentMs;

            this.send({
                type: 'Watch',
                offset,
                playing,
                video_id: videoId,
                title: meta.title ?? '',
                duration: meta.duration ?? 0,
                thumbnail: meta.thumbnail ?? '',
            });

            this.installHeartbeat();
            this.installMediaListeners();
        }

        drainPendingState() {
            const raw = sessionStorage.getItem(PENDING_KEY);
            if (!raw) return;
            sessionStorage.removeItem(PENDING_KEY);
            try {
                const { offsetMs, playing } = JSON.parse(raw);
                this.applyState(
                    WatchParty.parseVideoId(window.location.pathname),
                    offsetMs,
                    playing,
                );
            } catch (_) {}
        }
    }

    new WatchParty().start();
})();
