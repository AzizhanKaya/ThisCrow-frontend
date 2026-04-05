import { defineStore } from 'pinia';
import { MessageType, type User, type id, type Message, type WatchParty, type Ack, AckType, EventType } from '@/types';
import { useUserStore } from './user.ts';
import { useMeStore } from './me.ts';
import { fetchDms } from '@/api/state.ts';
import { websocketService } from '@/services/websocket.ts';
import { ModalView, useModalStore } from './modal.ts';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { generate_snowflake } from '@/utils/snowflake.ts';

type WatchPartyTauriEvent = { type: 'Watch'; id: id } | { type: 'Unwatch' } | { type: 'JumpTo'; offset: number; play: boolean };

let eventQueue = Promise.resolve();

export const useWatchStore = defineStore('watch', {
	state: () => ({
		watch_party: undefined as WatchParty | undefined,
		group_id: undefined as id | undefined,
		channel_id: undefined as id | undefined,
	}),

	actions: {
		enqueueTask(task: () => Promise<void>) {
			eventQueue = eventQueue.then(async () => {
				try {
					await task();
				} catch (error) {
					console.error('[WatchParty]:', error);
				}
			});
		},

		setupListeners() {
			websocketService.onMessage(MessageType.InfoGroup, (message: Message<Ack>) => {
				const { ack, payload } = message.data;
				const server_id = message.from;
				if (server_id === 0) return;

				this.enqueueTask(async () => {
					switch (ack) {
						case AckType.Watching: {
							await invoke('locate_video', { videoId: Number(payload) });
							await new Promise((r) => setTimeout(r, 1000));

							break;
						}
						case AckType.UnWatched: {
							await invoke('locate_video', { videoId: 0 });
							break;
						}
						case AckType.JumpedTo: {
							if (payload !== undefined && payload.offset !== undefined) {
								await invoke('jump_to', {
									offset: payload.offset,
									play: payload.play,
								});
							}
							break;
						}
						default:
							break;
					}
				});
			});

			listen<WatchPartyTauriEvent>('watch_party', (event) => {
				const payload = event.payload;

				if (!this.group_id || !this.channel_id) return;

				this.enqueueTask(async () => {
					switch (payload.type) {
						case 'Watch':
							websocketService.sendMessage({
								id: generate_snowflake(),
								from: 0,
								to: this.channel_id!,
								group_id: this.group_id,
								type: MessageType.InfoGroup,
								data: {
									event: EventType.Watch,
									payload: payload.id,
								},
							});
							break;

						case 'Unwatch':
							websocketService.sendMessage({
								id: generate_snowflake(),
								from: 0,
								to: this.channel_id!,
								group_id: this.group_id,
								type: MessageType.InfoGroup,
								data: {
									event: EventType.UnWatch,
								},
							});
							break;

						case 'JumpTo':
							websocketService.sendMessage({
								id: generate_snowflake(),
								from: 0,
								to: this.channel_id!,
								group_id: this.group_id,
								type: MessageType.InfoGroup,
								data: {
									event: EventType.JumpTo,
									payload: {
										offset: payload.offset,
										play: payload.play,
									},
								},
							});
							break;

						default:
							break;
					}
				});
			});
		},

		async init() {
			this.setupListeners();
		},

		createWatchParty(server_id: id, channel_id: id) {
			const modalStore = useModalStore();
			modalStore.openModal(ModalView.WATCH_PARTY, { server_id, channel_id });
		},
	},
});
