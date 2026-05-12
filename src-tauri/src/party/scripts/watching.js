(function () {
	if (window.__watchPartyInstalled) return;
	window.__watchPartyInstalled = true;

	/* ══════════════════════════════════════════════
	 *  §1 — Bridge: Tauri ↔ Browser communication
	 * ══════════════════════════════════════════════ */

	const bridge = {
		log(msg) {
			try {
				sendToTauri(JSON.stringify({ type: 'Log', text: msg }));
			} catch (_) {}
		},

		send(kind, extra) {
			try {
				state.seq++;
				sendToTauri(
					JSON.stringify(
						Object.assign(
							{ type: 'Player', kind, seq_local: state.seq },
							extra || {},
						),
					),
				);
			} catch (_) {}
		},
	};

	/* ══════════════════════════════════════════════
	 *  §2 — State: shared mutable state
	 * ══════════════════════════════════════════════ */

	const HEARTBEAT_INTERVAL_MS = 5000;
	const HEARTBEAT_DRIFT_MS = 1000;
	const SUPPRESS_TIMEOUT_MS = 400;

	const state = {
		videoId: null,
		suppressed: false,
		lastKnown: null,
	};

	function recordKnown(offsetMs, paused) {
		state.lastKnown = { offsetMs, playing: !paused, at: Date.now() };
	}

	function suppress(fn) {
		state.suppressed = true;
		try {
			fn();
		} finally {
			setTimeout(() => {
				state.suppressed = false;
			}, SUPPRESS_TIMEOUT_MS);
		}
	}

	/* ══════════════════════════════════════════════
	 *  §3 — Player: Netflix API / generic <video>
	 * ══════════════════════════════════════════════ */

	const PLAYER_POLL_MAX_MS = 8000;

	const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

	function findNetflixPlayer() {
		try {
			const api =
				window.netflix?.appContext?.state?.playerApp?.getAPI?.();
			if (!api?.videoPlayer) return null;
			const ids = api.videoPlayer.getAllPlayerSessionIds?.();
			if (!ids?.length) return null;
			return api.videoPlayer.getVideoPlayerBySessionId(ids[0]) || null;
		} catch (_) {
			return null;
		}
	}

	function createAdapter(netflixPlayer) {
		if (netflixPlayer) {
			return {
				play: () => netflixPlayer.play(),
				pause: () => netflixPlayer.pause(),
				seek: (ms) => netflixPlayer.seek(ms),
				currentMs: () => {
					const t = netflixPlayer.getCurrentTime?.();
					return typeof t === 'number' ? Math.floor(t) : 0;
				},
				paused: () => {
					const p = netflixPlayer.isPaused?.();
					return typeof p === 'boolean' ? p : true;
				},
			};
		}

		const v = document.querySelector('video');
		if (!v) return null;

		return {
			play: () => v.play(),
			pause: () => v.pause(),
			seek: (ms) => (v.currentTime = ms / 1000),
			currentMs: () => Math.floor(v.currentTime * 1000),
			paused: () => v.paused,
		};
	}

	async function getAdapter(timeoutMs) {
		const deadline = Date.now() + (timeoutMs || PLAYER_POLL_MAX_MS);
		let delay = 100;

		while (Date.now() < deadline) {
			const adapter = createAdapter(findNetflixPlayer());
			if (adapter) return adapter;
			await sleep(delay);
			delay = Math.min(delay * 2, 1600);
		}
		return null;
	}

	/* ══════════════════════════════════════════════
	 *  §4 — URL: route detection & video ID parsing
	 * ══════════════════════════════════════════════ */

	function parseVideoId(path) {
		const m = (path || '').match(/\/watch\/(\d+)/);
		return m ? Number(m[1]) : null;
	}

	function handleUrlChange() {
		const vid = parseVideoId(window.location.pathname);

		if (vid !== null) {
			if (vid === state.videoId) return;
			state.videoId = vid;
			bridge.send('watch', { video_id: vid });
			return;
		}

		if (state.videoId !== null) {
			state.videoId = null;
			bridge.send('watch', { video_id: 0 });
		}
	}

	function installUrlWatcher() {
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
		window.addEventListener('locationchange', handleUrlChange);

		// Fallback poll — some SPAs bypass history API
		let lastPath = window.location.pathname;
		setInterval(() => {
			if (window.location.pathname !== lastPath) {
				lastPath = window.location.pathname;
				handleUrlChange();
			}
		}, 500);
	}

	/* ══════════════════════════════════════════════
	 *  §5 — Events: DOM media events & heartbeat
	 * ══════════════════════════════════════════════ */

	function isMainPlayer(el) {
		if (!el || el.tagName !== 'VIDEO') return false;
		// Filter out ad/preview videos — main player lives inside these containers
		return (
			el.closest('.watch-video--player-view') !== null ||
			el.closest('[data-uia="player"]') !== null ||
			document.querySelectorAll('video').length === 1
		);
	}

	function emitVideoEvent(kind, el) {
		if (state.suppressed) return;
		if (state.videoId === null) return;
		if (!isMainPlayer(el)) return;

		const offsetMs = Math.floor(el.currentTime * 1000);
		const paused = el.paused;
		recordKnown(offsetMs, paused);
		bridge.send(kind, {
			offset_ms: offsetMs,
			paused,
			video_id: state.videoId,
		});
	}

	function installMediaListeners() {
		const events = {
			play: 'play',
			pause: 'pause',
			seeked: 'seek',
			ratechange: 'ratechange',
			waiting: 'buffering',
			ended: 'ended',
		};

		for (const [domEvent, kind] of Object.entries(events)) {
			document.addEventListener(
				domEvent,
				(e) => emitVideoEvent(kind, e.target),
				true,
			);
		}
	}

	function installHeartbeat() {
		function tick() {
			if (state.videoId === null) return;
			const v = document.querySelector('video');
			if (!v) return;

			const offsetMs = Math.floor(v.currentTime * 1000);
			const paused = v.paused;

			if (state.lastKnown) {
				const elapsed = state.lastKnown.playing
					? Date.now() - state.lastKnown.at
					: 0;
				const predicted = state.lastKnown.offsetMs + elapsed;
				const stateMatch = paused === !state.lastKnown.playing;
				if (
					stateMatch &&
					Math.abs(offsetMs - predicted) < HEARTBEAT_DRIFT_MS
				)
					return;
			}

			recordKnown(offsetMs, paused);
			bridge.send('heartbeat', {
				offset_ms: offsetMs,
				paused,
				video_id: state.videoId,
			});
		}

		setTimeout(tick, 1000);
		setInterval(tick, HEARTBEAT_INTERVAL_MS);
	}

	/* ══════════════════════════════════════════════
	 *  §6 — Apply: remote state application
	 *       (replaces apply_state.js)
	 * ══════════════════════════════════════════════ */

	const PENDING_KEY = '__wp_pending';

	window.__watchPartyApplyState = async function (
		videoId,
		offsetMs,
		playing,
	) {
		// Navigate to home
		if (videoId === 0) {
			if (window.location.pathname.includes('/watch/')) {
				bridge.log('apply → nav home');
				window.location.href = '/';
			}
			return 'home';
		}

		// Navigate to the correct video
		const targetPath = '/watch/' + videoId;
		if (!window.location.pathname.includes(targetPath)) {
			bridge.log('apply → nav ' + targetPath);
			sessionStorage.setItem(
				PENDING_KEY,
				JSON.stringify({ offsetMs, playing }),
			);
			window.location.href = targetPath;
			return 'navigating';
		}

		// Already on the right page — seek & play/pause
		return await applyToPlayer(offsetMs, playing);
	};

	async function applyToPlayer(offsetMs, playing) {
		const adapter = await getAdapter(PLAYER_POLL_MAX_MS);
		if (!adapter) return 'no_player';

		suppress(() => {
			adapter.seek(offsetMs);
			if (playing) adapter.play();
			else adapter.pause();
			recordKnown(offsetMs, !playing);
		});

		bridge.log('apply → ok ms=' + offsetMs + ' play=' + playing);
		return 'ok';
	}

	function drainPendingState() {
		const raw = sessionStorage.getItem(PENDING_KEY);
		if (!raw) return;
		sessionStorage.removeItem(PENDING_KEY);

		try {
			const { offsetMs, playing } = JSON.parse(raw);
			bridge.log('apply → drain pending ms=' + offsetMs);
			applyToPlayer(offsetMs, playing);
		} catch (_) {}
	}

	/* ══════════════════════════════════════════════
	 *  §7 — Init
	 * ══════════════════════════════════════════════ */

	installUrlWatcher();
	installMediaListeners();
	installHeartbeat();
	drainPendingState();

	bridge.log('loaded href=' + location.href);
	handleUrlChange();
})();
