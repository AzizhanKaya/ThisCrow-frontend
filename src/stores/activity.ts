import { defineStore } from 'pinia';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { websocketService } from '@/services/websocket';
import {
	EventType,
	MessageType,
	AckType,
	type Message,
	type Ack,
	type Music,
	type MusicEvent,
	type Activity,
	type Game,
	type GameEvent,
	type id,
} from '@/types';
import { useMeStore } from './me';
import { useUserStore } from './user';
import { useAppStore } from './app';
import { generate_uid } from '@/utils/uid';

export const useActivityStore = defineStore('activity', {
	state: () => ({
		currentMusic: null as Music | null,
		currentGame: null as Game | null,
	}),

	actions: {
		async init() {
			const appStore = useAppStore();

			websocketService.onMessage(MessageType.Server, (message: Message<Ack>) => {
				if (message.data.ack === AckType.MusicActivity) {
					this.handleMusic(message.from, message.data.payload);
				}
				if (message.data.ack === AckType.GameActivity) {
					this.handleGame(message.from, message.data.payload);
				}
			});

			if (appStore.isTauri) {
				const game = await invoke<Game | null>('get_current_game');
				if (game != null) {
					this.sendGameActivity({ game: 'playing', payload: game });
				}

				const currentMusic = await invoke<MusicEvent | null>('get_current_music');
				if (currentMusic != null) {
					this.sendMusicActivity(currentMusic);
				}

				await listen<MusicEvent>('music_activity', (event) => {
					this.sendMusicActivity(event.payload);
				});

				await listen<GameEvent>('game_activity', (event) => {
					this.sendGameActivity(event.payload);
				});
			}
		},

		handleMusic(userId: id, event: MusicEvent) {
			const userStore = useUserStore();
			const meStore = useMeStore();
			const user = userStore.users.get(userId);
			if (!user) return;
			if (!user.activities) user.activities = {};

			switch (event.music) {
				case 'playing': {
					const music = event.payload;
					user.activities.music = { type: 'music', payload: music };
					break;
				}
				case 'seek': {
					if (user.activities.music) {
						if (user.activities.music.payload.paused) {
							user.activities.music.payload.offset = Date.now() - event.payload;
						} else {
							user.activities.music.payload.offset = event.payload;
						}
					}
					break;
				}
				case 'paused': {
					if (user.activities.music && !user.activities.music.payload.paused) {
						user.activities.music.payload.paused = true;
						user.activities.music.payload.offset = Date.now() - user.activities.music.payload.offset;
					}
					break;
				}
				case 'stopped':
					delete user.activities.music;
					break;
			}

			if (meStore.me?.id === userId) {
				if (user.activities.music) {
					this.currentMusic = user.activities.music.payload;
				} else {
					this.currentMusic = null;
				}
			}
		},

		handleGame(userId: id, event: GameEvent) {
			const userStore = useUserStore();
			const meStore = useMeStore();
			if (!meStore.me) return;
			const user = userStore.users.get(userId);
			if (!user) return;
			if (!user.activities) user.activities = {};

			switch (event.game) {
				case 'playing': {
					const game = event.payload;
					user.activities.game = {
						type: 'game',
						payload: {
							...game,
							app_id: game.app_id,
							start_time: game.start_time,
						},
					};
					break;
				}
				case 'stopped':
					delete user.activities.game;
					break;
			}
		},

		sendMusicActivity(payload: MusicEvent) {
			const meStore = useMeStore();
			if (!meStore.me) return;

			websocketService.sendMessage({
				id: generate_uid(meStore.me.id),
				from: meStore.me.id,
				to: 0,
				type: MessageType.Info,
				data: {
					event: EventType.Music,
					payload,
				},
			});
		},

		sendGameActivity(payload: GameEvent) {
			const meStore = useMeStore();
			if (!meStore.me) return;

			websocketService.sendMessage({
				id: generate_uid(meStore.me.id),
				from: meStore.me.id,
				to: 0,
				type: MessageType.Info,
				data: {
					event: EventType.Game,
					payload,
				},
			});
		},
	},
});
