import { defineStore } from 'pinia';
import { MessageType, type id, type Message, type Ack, AckType, EventType, type WatchParty } from '@/types';
import { websocketService } from '@/services/websocket.ts';
import { ModalView, useModalStore } from './modal.ts';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { generate_uid } from '@/utils/uid.ts';
import { useMeStore } from './me.ts';
import { useServerStore } from './server.ts';

type PlayerEvent = {
	type: 'Watch' | 'HeartBeat';
	offset: number;
	playing: boolean;
	video_id: number;
	title: string;
	duration: number;
	thumbnail: string;
};

export const useWatchStore = defineStore('watch', {
	state: () => ({
		browser_open: false,
		sync_interval: undefined as ReturnType<typeof setInterval> | undefined,
		party: undefined as WatchParty | undefined,
		group_id: undefined as id | undefined,
		channel_id: undefined as id | undefined,
	}),

	getters: {
		isHost(): boolean {
			const me = useMeStore().me;
			return me !== undefined && this.party?.host === me!.id;
		},
	},

	actions: {
		async setupListeners() {
			await listen('watch_party_closed', () => {
				this.browser_open = false;
				this.leaveParty().catch((e) => console.error('[WatchParty] leaveParty', e));
			});

			await listen<PlayerEvent>('watch_party', (event) => {
				const payload = event.payload;
				this.handlePlayerEvent(payload);
			});

			websocketService.onMessage(MessageType.Server, (message: Message<Ack>) => {
				const { ack, payload } = message.data;

				switch (ack) {
					case AckType.Watching: {
						if (!this.party) return;
						if (this.isHost) return;
						const { video } = payload;
						if (video === this.party.video) return;
						this.applyState(video, 0, false);
						return;
					}

					case AckType.JumpedTo: {
						if (!this.party) return;
						if (this.isHost) return;
						const { offset, play } = payload;
						this.applyState(this.party.video, offset, play);
						return;
					}
				}
			});
		},

		handlePlayerEvent(e: PlayerEvent) {
			const meStore = useMeStore();
			const base = {
				id: generate_uid(meStore.me!.id),
				from: 0,
				to: this.channel_id!,
				group_id: this.group_id,
				type: MessageType.InfoGroup,
			} as const;

			switch (e.type) {
				case 'Watch': {
					if (!this.isHost) return;
					if (e.video_id === this.party?.video) return;

					websocketService.sendMessage({
						...base,
						data: {
							event: EventType.Watch,
							payload: {
								video: (e.video_id ?? 0) as id,
								title: e.title ?? '',
								duration: e.duration ?? 0,
								thumbnail: e.thumbnail ?? '',
							},
						},
					});

					if (e.offset === 0 && !e.playing) return;

					websocketService.sendMessage({
						...base,
						data: { event: EventType.JumpTo, payload: { offset: e.offset, play: e.playing } },
					});
					return;
				}
				case 'HeartBeat': {
					if (!this.isHost) return;

					websocketService.sendMessage({
						...base,
						data: { event: EventType.JumpTo, payload: { offset: e.offset, play: e.playing } },
					});
					return;
				}
				default:
					return;
			}
		},

		async init() {
			this.setupListeners();
		},

		setParty(party: WatchParty, channel_id: id, group_id: id) {
			this.party = party;
			this.channel_id = channel_id;
			this.group_id = group_id;
		},

		async applyState(video: id, offset: number, playing: boolean) {
			if (!this.browser_open) {
				return;
			}
			try {
				await invoke('apply_state', { video, offset, playing });
			} catch (e) {
				console.error('[Watch Party] apply_state FAILED', e);
			}
		},

		startSyncLoop() {
			this.stopSyncLoop();
			this.sync_interval = setInterval(() => {
				if (!this.browser_open || !this.party) return;
				if (this.isHost) return;
				const p = this.party;
				if (!p || !p.video) return;
				this.applyState(p.video, p.offset, p.playing).catch(() => {});
			}, 1000);
		},

		stopSyncLoop() {
			if (this.sync_interval) {
				clearInterval(this.sync_interval);
				this.sync_interval = undefined;
			}
		},

		createWatchParty(server_id: id, channel_id: id) {
			const modalStore = useModalStore();
			modalStore.openModal(ModalView.WATCH_PARTY, { server_id, channel_id });
		},

		async joinParty(group_id: id, channel_id: id) {
			this.group_id = group_id;
			this.channel_id = channel_id;
			this.browser_open = true;
			this.startSyncLoop();
			const meStore = useMeStore();
			return websocketService.sendMessage({
				id: generate_uid(meStore.me!.id),
				from: 0,
				to: channel_id,
				group_id,
				type: MessageType.InfoGroup,
				data: { event: EventType.JoinParty },
			});
		},

		async leaveParty() {
			const meStore = useMeStore();
			websocketService.sendMessage({
				id: generate_uid(meStore.me!.id),
				from: 0,
				to: this.channel_id!,
				group_id: this.group_id,
				type: MessageType.InfoGroup,
				data: { event: EventType.LeaveParty },
			});
			await this.cleanup();
		},

		async cleanup() {
			this.stopSyncLoop();
			this.group_id = undefined;
			this.channel_id = undefined;
			this.party = undefined;
		},

		async closeParty() {
			try {
				await invoke('close_party');
			} catch (e) {
				console.error('[WatchParty] close_party failed', e);
			}
		},
	},
});
