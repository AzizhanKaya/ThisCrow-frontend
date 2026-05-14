import { defineStore } from 'pinia';
import { MessageType, type id, type Message, type Ack, AckType, EventType } from '@/types';
import { websocketService } from '@/services/websocket.ts';
import { ModalView, useModalStore } from './modal.ts';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { generate_uid } from '@/utils/uid.ts';
import { useMeStore } from './me.ts';
import { useServerStore } from './server.ts';

type PlayerEvent = {
	type: 'Player';
	kind: 'play' | 'pause' | 'seek' | 'ratechange' | 'buffering' | 'ended' | 'watch' | 'heartbeat';
	seq_local: number;
	offset?: number;
	paused?: boolean;
	video_id?: number;
};

export const useWatchStore = defineStore('watch', {
	state: () => ({
		group_id: undefined as id | undefined,
		channel_id: undefined as id | undefined,
		browser_open: false,
	}),

	getters: {
		party(state) {
			if (!state.group_id || !state.channel_id) return undefined;
			const serverStore = useServerStore();
			const server = serverStore.servers.get(state.group_id);
			return server?.channels?.get(state.channel_id)?.watch_party;
		},
		isHost(): boolean {
			const me = useMeStore().me;
			return me !== undefined && this.party?.host === me!.id;
		},
		inParty(state): boolean {
			return state.group_id !== undefined && state.channel_id !== undefined;
		},
	},

	actions: {
		async setupListeners() {
			await listen('watch_party_closed', () => {
				if (!this.inParty) return;
				this.browser_open = false;
				this.leaveParty().catch((e) => console.error('[WatchParty] leaveParty', e));
			});

			await listen<PlayerEvent>('watch_party', (event) => {
				const payload = event.payload;
				if (!this.inParty || payload.type !== 'Player') return;
				this.handlePlayerEvent(payload);
			});

			websocketService.onMessage(MessageType.Server, (message: Message<Ack>) => {
				const { ack, payload } = message.data;
				const me_id = useMeStore().me?.id;

				switch (ack) {
					case AckType.Watching: {
						if (!this.inParty) return;
						if (message.to === me_id) return;
						const { video } = payload;
						this.applyState(video, 0, false);
						return;
					}

					case AckType.JumpedTo: {
						if (!this.inParty) return;
						if (message.to === me_id) return;
						const p = payload as { offset: number; play: boolean };
						this.applyState(this.party?.video ?? 0, p.offset, p.play);
						return;
					}
				}
			});
		},

		handlePlayerEvent(ev: PlayerEvent) {
			const meStore = useMeStore();
			const base = {
				id: generate_uid(meStore.me!.id),
				from: 0,
				to: this.channel_id!,
				group_id: this.group_id,
				type: MessageType.InfoGroup,
			} as const;

			const party = this.party;

			switch (ev.kind) {
				case 'watch': {
					if (!this.isHost) return;
					if (ev.video_id === party?.video) return;
					websocketService.sendMessage({
						...base,
						data: { event: EventType.Watch, payload: (ev.video_id ?? 0) as id },
					});
					return;
				}
				case 'play':
				case 'pause':
				case 'seek':
				case 'heartbeat': {
					if (!this.isHost) return;
					if (ev.video_id && ev.video_id !== party?.video) {
						websocketService.sendMessage({
							...base,
							data: { event: EventType.Watch, payload: ev.video_id as id },
						});
						return;
					}
					if (!party?.video) return;
					const offset = ev.offset ?? 0;
					const play = !(ev.paused ?? true);
					websocketService.sendMessage({
						...base,
						data: { event: EventType.JumpTo, payload: { offset: offset, play } },
					});
					return;
				}
				case 'ratechange':
				case 'buffering':
				case 'ended':
				default:
					return;
			}
		},

		async init() {
			this.setupListeners();
		},

		async applyState(video: id, offset: number, playing: boolean) {
			if (!this.browser_open) return;
			try {
				await invoke('apply_state', { video, offset, playing });
			} catch (e) {
				console.error('[WatchParty] apply_state failed', e);
			}
		},

		createWatchParty(server_id: id, channel_id: id) {
			const modalStore = useModalStore();
			modalStore.openModal(ModalView.WATCH_PARTY, { server_id, channel_id });
		},

		joinParty(group_id: id, channel_id: id) {
			this.group_id = group_id;
			this.channel_id = channel_id;
			this.browser_open = true;
			const meStore = useMeStore();
			websocketService.sendMessage({
				id: generate_uid(meStore.me!.id),
				from: 0,
				to: channel_id,
				group_id,
				type: MessageType.InfoGroup,
				data: { event: EventType.JoinParty },
			});
		},

		async leaveParty() {
			if (!this.inParty) return;
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
			this.group_id = undefined;
			this.channel_id = undefined;
		},

		async closeParty() {
			if (this.browser_open) {
				this.browser_open = false;
				try {
					await invoke('close_party');
				} catch (e) {
					console.error('[WatchParty] close_party failed', e);
				}
			}
		},
	},
});
