import { defineStore } from 'pinia';
import { MessageType, type id, type Message, type Ack, AckType, EventType, type WatchParty } from '@/types';
import { websocketService } from '@/services/websocket.ts';
import { ModalView, useModalStore } from './modal.ts';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { generate_uid } from '@/utils/uid.ts';
import { useMeStore } from './me.ts';

type WatchPartyTauriEvent = { type: 'Watch'; id: id } | { type: 'Unwatch' } | { type: 'JumpTo'; offset: number; play: boolean };

type DeferredAck =
	| { ack: AckType.Watching; payload: id }
	| { ack: AckType.UnWatched }
	| { ack: AckType.JumpedTo; payload: { offset: number; play: boolean } };

export const useWatchStore = defineStore('watch', {
	state: () => ({
		group_id: undefined as id | undefined,
		channel_id: undefined as id | undefined,
		host_id: undefined as id | undefined,
		browser_open: false,
		syncing: false,
		queue: [] as DeferredAck[],
	}),

	getters: {
		isHost(state): boolean {
			const meStore = useMeStore();
			return state.host_id !== undefined && meStore.me?.id === state.host_id;
		},
		inParty(state): boolean {
			return state.group_id !== undefined && state.channel_id !== undefined;
		},
	},

	actions: {
		setupListeners() {
			websocketService.onMessage(MessageType.Server, async (message: Message<Ack>) => {
				const { ack, payload } = message.data;
				const me_id = useMeStore().me?.id;

				try {
					switch (ack) {
						case AckType.CreatedParty: {
							if (message.to === me_id && payload === this.channel_id) {
								this.host_id = me_id;
							}
							break;
						}

						case AckType.JoinedParty: {
							const { channel, state } = payload as { channel: id; state: WatchParty };
							if (message.to === me_id && channel === this.channel_id) {
								await this.syncToParty(state);
							}
							break;
						}

						case AckType.LeftParty: {
							const { channel, new_host } = payload as { channel: id; new_host: id | null };
							if (channel !== this.channel_id) break;
							if (new_host === null) {
								await this.cleanup();
							} else {
								this.host_id = new_host;
							}
							break;
						}

						case AckType.Watching: {
							if (this.syncing) {
								this.queue.push({ ack: AckType.Watching, payload: payload as id });
								break;
							}
							await invoke('locate_video', { videoId: Number(payload), offset: null, play: null });
							break;
						}

						case AckType.UnWatched: {
							if (this.syncing) {
								this.queue.push({ ack: AckType.UnWatched });
								break;
							}
							await invoke('locate_video', { videoId: 0, offset: null, play: null });
							break;
						}

						case AckType.JumpedTo: {
							const data = payload as { offset: number; play: boolean };
							if (this.syncing) {
								this.queue.push({ ack: AckType.JumpedTo, payload: data });
								break;
							}
							await invoke('jump_to', { offset: data.offset, play: data.play });
							break;
						}

						case AckType.ExitedVoice: {
							if (message.to === me_id && payload === this.channel_id) {
								await this.cleanup();
							}
							break;
						}
					}
				} catch (error) {
					console.error('[WatchParty]', error);
				}
			});

			listen('watch_party_closed', async () => {
				if (!this.inParty) return;
				this.browser_open = false;
				await this.leaveParty();
			});

			listen<WatchPartyTauriEvent>('watch_party', (event) => {
				const payload = event.payload;
				if (!this.inParty) return;

				const meStore = useMeStore();
				const base = {
					id: generate_uid(meStore.me!.id),
					from: 0,
					to: this.channel_id!,
					group_id: this.group_id,
					type: MessageType.InfoGroup,
				} as const;

				switch (payload.type) {
					case 'Watch':
						if (!this.isHost) return;
						websocketService.sendMessage({ ...base, data: { event: EventType.Watch, payload: payload.id } });
						break;

					case 'Unwatch':
						if (!this.isHost) return;
						websocketService.sendMessage({ ...base, data: { event: EventType.UnWatch } });
						break;

					case 'JumpTo':
						if (this.syncing) return;
						websocketService.sendMessage({
							...base,
							data: { event: EventType.JumpTo, payload: { offset: payload.offset, play: payload.play } },
						});
						break;
				}
			});
		},

		async init() {
			this.setupListeners();
		},

		async syncToParty(state: WatchParty) {
			this.host_id = state.host;
			if (!this.browser_open || state.video === 0) return;

			this.syncing = true;
			this.queue = [];
			try {
				await invoke('locate_video', {
					videoId: Number(state.video),
					offset: state.offset,
					play: state.playing,
				});
			} catch (e) {
				console.error('[WatchParty] sync failed', e);
			} finally {
				const queued = this.queue;
				this.queue = [];
				this.syncing = false;
				for (const evt of queued) {
					try {
						await this.applyDeferred(evt);
					} catch (e) {
						console.error('[WatchParty] queued apply failed', e);
					}
				}
			}
		},

		async applyDeferred(evt: DeferredAck) {
			switch (evt.ack) {
				case AckType.Watching:
					await invoke('locate_video', { videoId: Number(evt.payload), offset: null, play: null });
					break;
				case AckType.UnWatched:
					await invoke('locate_video', { videoId: 0, offset: null, play: null });
					break;
				case AckType.JumpedTo:
					await invoke('jump_to', { offset: evt.payload.offset, play: evt.payload.play });
					break;
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
			this.host_id = undefined;
			this.syncing = false;
			this.queue = [];
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
