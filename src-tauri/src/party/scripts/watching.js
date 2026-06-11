(function () {
   if (window.__watchPartyInstalled) return;
   window.__watchPartyInstalled = true;

   const SEEK_THRESHOLD_MS = 1500;
   const PLAYER_POLL_MS = 8000;
   const HEARTBEAT_MS = 5000;
   const PENDING_KEY = '__wp_pending';

   const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

   // ── PlayerAdapter ────────────────────────────────────────────────

   class PlayerAdapter {
       static find() {
           const player = PlayerAdapter.findNetflix();
           return player ? new PlayerAdapter(player) : null;
       }

       static async poll(timeoutMs = PLAYER_POLL_MS) {
           const deadline = Date.now() + timeoutMs;
           let delay = 100;
           while (Date.now() < deadline) {
               const adapter = PlayerAdapter.find();
               if (adapter) return adapter;
               await sleep(delay);
               delay = Math.min(delay * 2, 1600);
           }
           return null;
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
           const t = this.player.getCurrentTime?.();
           return typeof t === 'number' ? Math.floor(t) : 0;
       }

       paused() {
           const p = this.player.isPaused?.();
           return typeof p === 'boolean' ? p : true;
       }

       durationMs() {
           const d = this.player.getDuration?.();
           return typeof d === 'number' && isFinite(d) && d > 0
               ? Math.floor(d)
               : null;
       }

       async pollDurationMs(currentVideoId, videoId, timeoutMs = 5000) {
           const deadline = Date.now() + timeoutMs;
           let delay = 200;
           while (Date.now() < deadline) {
               if (currentVideoId() !== videoId) return null;
               const d = this.durationMs();
               if (d !== null) return d;
               await sleep(delay);
               delay = Math.min(delay * 1.5, 800);
           }
           return this.durationMs();
       }
   }

   // ── MetadataExtractor ────────────────────────────────────────────

   class MetadataExtractor {
       static TITLE_SELECTORS = [
           '[data-uia="video-title"]',
           '[data-uia="player-status-main-title"]',
           '.player-status-main-title',
           '.video-title h4',
           '.video-title',
       ];

       static fromDom() {
           for (const sel of MetadataExtractor.TITLE_SELECTORS) {
               const el = document.querySelector(sel);
               if (!el?.textContent) continue;
               const t = el.textContent.trim();
               if (t && t.toLowerCase() !== 'netflix') return t;
           }
           return null;
       }

       static fromFalcorCache(videoId) {
           try {
               const v = window.netflix?.falcorCache?.videos?.[videoId];
               if (!v) return null;
               const t = v.title;
               if (typeof t === 'string' && t.trim()) return t.trim();
               const nested = t?.value ?? t?.$value;
               if (typeof nested === 'string' && nested.trim()) return nested.trim();
               return null;
           } catch (_) {
               return null;
           }
       }

       static fromGraphQLCache(videoId) {
           try {
               const cache =
                   window.netflix?.appContext?.state?.graphqlClient?.cache?.data
                       ?.data;
               if (!cache) return null;
               for (const typeName of ['Movie', 'Show', 'Episode', 'Video']) {
                   const entity = cache[`${typeName}:{"videoId":${videoId}}`];
                   const t = entity?.title;
                   if (typeof t === 'string' && t.trim() && t.toLowerCase() !== 'netflix') {
                       return t.trim();
                   }
               }
               return null;
           } catch (_) {
               return null;
           }
       }

       static fromCleanDocTitle() {
           const t = document.title.replace(/\s*-\s*Netflix\s*$/i, '').trim();
           if (t && t.toLowerCase() !== 'netflix') return t;
           return null;
       }

       static thumbnail(videoId) {
           try {
               const cache =
                   window.netflix?.appContext?.state?.graphqlClient?.cache?.data
                       ?.data;
               if (!cache) return null;

               let sdpBest = null;
               let sdpArea = 0;
               let anyBest = null;
               let anyArea = 0;

               for (const [key, entity] of Object.entries(cache)) {
                   if (!key.includes(`"videoId":${videoId}`)) continue;

                   for (const [field, value] of Object.entries(entity)) {
                       const url = value?.url;
                       if (typeof url !== 'string' || !url.includes('nflxso.net'))
                           continue;

                       let w = value?.width ?? 0;
                       let h = value?.height ?? 0;
                       let artworkType = null;

                       const m = field.match(/\(({.*})\)$/);
                       if (m) {
                           try {
                               const p = JSON.parse(m[1]);
                               w = p?.params?.dimension?.width ?? w;
                               h = p?.params?.dimension?.height ?? h;
                               artworkType = p?.params?.artworkType ?? null;
                           } catch (_) {}
                       }

                       const area = w * h;
                       if (artworkType === 'SDP') {
                           if (area > sdpArea) { sdpArea = area; sdpBest = url; }
                       } else {
                           if (area > anyArea) { anyArea = area; anyBest = url; }
                       }
                   }
               }

               return sdpBest || anyBest;
           } catch (_) {
               return null;
           }
       }

       static async extract(adapter, videoId, currentVideoId) {
           const tryAll = () =>
               MetadataExtractor.fromGraphQLCache(videoId) ||
               MetadataExtractor.fromFalcorCache(videoId) ||
               MetadataExtractor.fromDom() ||
               MetadataExtractor.fromCleanDocTitle();

           let title = tryAll();
           if (!title) {
               const deadline = Date.now() + 5000;
               let delay = 150;
               while (Date.now() < deadline) {
                   if (currentVideoId() !== videoId) {
                       return { title: null, duration: null, thumbnail: null };
                   }
                   await sleep(delay);
                   title = tryAll();
                   if (title) break;
                   delay = Math.min(delay * 1.5, 600);
               }
           }

           let duration = adapter?.durationMs() ?? null;
           if (duration === null && adapter) {
               duration = await adapter.pollDurationMs(currentVideoId, videoId, 5000);
           }

           const thumbnail = MetadataExtractor.thumbnail(videoId);

           sendToTauri(
               JSON.stringify({
                   type: 'Log',
                   msg:
                       (title ?? 'no-title') +
                   '   ' +
                   (duration ?? 'no-duration') +
                   '   ' +
                   (thumbnail ? thumbnail.substring(0, 20) : 'no-thumb'),
               }),
           );

           return { title, duration, thumbnail };
       }
   }

   // ── UrlWatcher ───────────────────────────────────────────────────

   class UrlWatcher {
       constructor(onChange) {
           this.onChange = onChange;
           this.lastPath = window.location.pathname;
       }

       install() {
           const dispatch = () =>
               window.dispatchEvent(new Event('locationchange'));

           const origPush = history.pushState;
           const origReplace = history.replaceState;

           history.pushState = function () {
               origPush.apply(this, arguments);
               dispatch();
           };
           history.replaceState = function () {
               origReplace.apply(this, arguments);
               dispatch();
           };

           window.addEventListener('popstate', dispatch);
           window.addEventListener('locationchange', () => {
               this.onChange();
           });

           setInterval(() => {
               if (window.location.pathname !== this.lastPath) {
                   this.lastPath = window.location.pathname;
                   this.onChange();
               }
           }, 500);
       }
   }

   // ── WatchParty ───────────────────────────────────────────────────

   class WatchParty {
       static AUTH_PATHS = [
           '/login',
           '/profiles',
           '/SignOut',
           '/loginhelp',
           '/password',
           '/signup',
       ];

       static MEDIA_EVENTS = {
           play: 'play',
           pause: 'pause',
           seeked: 'seek',
           ratechange: 'ratechange',
           waiting: 'buffering',
           ended: 'ended',
       };

       constructor() {
           this.videoId = null;
           this.heartbeatTimer = null;
           this.mediaUnlisteners = null;
       }

       start() {
           new UrlWatcher(() => this.handleUrlChange()).install();
           this.drainPendingState();
           this.handleUrlChange();

           window.__watchPartyApplyState = (videoId, offsetMs, playing) =>
               this.applyState(videoId, offsetMs, playing);
       }

       // ── applyState ───────────────────────────────────────────────

       async applyState(videoId, offsetMs, playing) {
           if (videoId === 0) {
               if (window.location.pathname.includes('/watch/')) {
                   window.location.href = '/';
               }
               return 'home';
           }

           if (this.isAuthPage()) return 'auth_page';

           const currentVid = WatchParty.parseVideoId(window.location.pathname);
           if (currentVid !== videoId) {
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

       // ── Heartbeat ────────────────────────────────────────────────

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

       // ── Internal ─────────────────────────────────────────────────

       send(msg) {
           try {
               sendToTauri(JSON.stringify(msg));
           } catch (_) {}
       }

       log(text) {
           this.send({ type: 'Log', text });
       }

       isAuthPage() {
           const p = window.location.pathname;
           return WatchParty.AUTH_PATHS.some((prefix) => p.startsWith(prefix));
       }

       static parseVideoId(path) {
           const m = (path || '').match(/\/watch\/(\d+)/);
           return m ? Number(m[1]) : null;
       }

       isMainPlayer(el) {
           if (!el || el.tagName !== 'VIDEO') return false;
           return (
               el.closest('.watch-video--player-view') !== null ||
               el.closest('[data-uia="player"]') !== null ||
               document.querySelectorAll('video').length === 1
           );
       }

       emitVideoEvent(kind, el) {
           if (this.videoId === null) return;
           if (!this.isMainPlayer(el)) return;

           const currentMs = Math.floor(el.currentTime * 1000);
           const playing = !el.paused;
           const offset = playing ? Date.now() - currentMs : currentMs;

           this.send({
               type: 'HeartBeat',
               offset,
               playing,
           });
       }

       installMediaListeners() {
           this.uninstallMediaListeners();
           this.mediaUnlisteners = [];
           for (const [domEvent, kind] of Object.entries(
               WatchParty.MEDIA_EVENTS,
           )) {
               const handler = (e) => this.emitVideoEvent(kind, e.target);
               document.addEventListener(domEvent, handler, true);
               this.mediaUnlisteners.push(() =>
                   document.removeEventListener(domEvent, handler, true),
               );
           }
       }

       uninstallMediaListeners() {
           if (!this.mediaUnlisteners) return;
           for (const off of this.mediaUnlisteners) off();
           this.mediaUnlisteners = null;
       }

       async handleUrlChange() {
           const vid = WatchParty.parseVideoId(window.location.pathname);

           if (vid !== null) {
               if (vid === this.videoId) return;
               this.uninstallHeartbeat();
               this.uninstallMediaListeners();
               this.videoId = vid;
               await this.sendWatchWithMetadata(vid);
               return;
           }

           if (this.videoId !== null) {
               this.uninstallHeartbeat();
               this.uninstallMediaListeners();
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



