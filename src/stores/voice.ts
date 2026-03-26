import { defineStore } from 'pinia';
import { watch } from 'vue';
import {
	EventType,
	MessageType,
	type Me,
	type Message,
	type Status,
	type Event,
	type Channel,
	type id,
	type User,
} from '@/types';
import { websocketService } from '@/services/websocket';
import { generate_uid } from '@/utils/uid';
import { useMeStore } from './me';
import { webrtcService, MediaType } from '@/services/webrtc';

export const useVoiceStore = defineStore('voice', {
	state: () => ({
		voice_channel: undefined as Channel | undefined,
		group_id: undefined as id | undefined,
		voice_direct: undefined as User | undefined,
		unwatch: null as (() => void) | null,
		isMuted: false,
		isVideoOn: false,
		isScreenSharing: false,
	}),

	actions: {
		async joinVoice(channel?: Channel, group_id?: id, user?: User): Promise<void> {
			const meStore = useMeStore();
			const me = meStore.me!;
			if (this.voice_channel) {
				await this.leaveVoice();
			}

			const to = user?.id || channel?.id;

			if (user) this.voice_direct = user;
			if (channel) this.voice_channel = channel;

			try {
				await websocketService.request({
					id: generate_uid(me.id),
					type: MessageType.InfoGroup,
					from: me.id,
					to: to!,
					group_id,
					data: {
						event: EventType.JoinVoice,
					},
				});
			} catch (e) {
				console.error(e);
				this.voice_channel = undefined;
				this.group_id = undefined;
				this.voice_direct = undefined;
				throw e;
			}

			this.voice_channel = channel;
			this.voice_direct = user;
			this.group_id = group_id;

			if (this.unwatch) {
				this.unwatch();
				this.unwatch = null;
			}

			if (channel) {
				this.unwatch = watch(
					() => this.voice_channel?.users,
					async (newUsers, oldUsers) => {
						const addedIds: id[] = [];
						const removedIds: id[] = [];

						newUsers?.forEach((u) => {
							if (u.id !== me.id && (!oldUsers || !oldUsers.has(u))) {
								addedIds.push(u.id);
							}
						});

						if (oldUsers) {
							oldUsers.forEach((u) => {
								if (u.id !== me.id && !newUsers?.has(u)) {
									removedIds.push(u.id);
								}
							});
						}

						if (addedIds.length > 0) {
							await webrtcService.connectPeers(addedIds);
						}

						if (removedIds.length > 0) {
							removedIds.forEach((id) => webrtcService.removePeerConnection(id));
						}
					},
					{ immediate: true }
				);
			}

			if (user) {
				this.unwatch = watch(
					() => this.voice_direct,
					async (newUser, oldUser) => {
						if (newUser?.id === oldUser?.id) return;

						if (oldUser?.id) {
							webrtcService.removePeerConnection(oldUser.id);
						}

						if (newUser?.id) {
							await webrtcService.connectPeers([newUser.id]);
						}
					},
					{ immediate: true }
				);
			}

			await webrtcService.addTrack(MediaType.Audio);
		},

		async leaveVoice() {
			if (this.unwatch) {
				this.unwatch();
				this.unwatch = null;
			}

			const meStore = useMeStore();
			const me = meStore.me!;
			webrtcService.disconnectAll();

			const to = this.voice_direct ? this.voice_direct.id : this.voice_channel?.id;

			try {
				if (to) {
					await websocketService.request({
						id: generate_uid(me.id),
						type: MessageType.InfoGroup,
						from: me.id,
						to,
						group_id: this.group_id,
						data: {
							event: EventType.ExitVoice,
						},
					});
				}
			} catch (e) {
				console.error(e);
			} finally {
				this.voice_channel = undefined;
				this.group_id = undefined;
				this.voice_direct = undefined;
			}
		},

		toggleMute() {
			this.isMuted = !this.isMuted;
			webrtcService.toggleTrack(MediaType.Audio, !this.isMuted);
		},

		async toggleVideo() {
			try {
				const meStore = useMeStore();
				const me = meStore.me!;
				const existingTrack = webrtcService.getTrack(me.id, MediaType.Video);
				if (!existingTrack) {
					await webrtcService.addTrack(MediaType.Video);
					this.isVideoOn = true;

					const track = webrtcService.getTrack(me.id, MediaType.Video);
					if (track) {
						track.onended = () => {
							this.isVideoOn = false;
							webrtcService.removeTrack(MediaType.Video);
						};
					}
				} else {
					this.isVideoOn = false;
					webrtcService.removeTrack(MediaType.Video);
				}
			} catch (error) {
				console.error('Camera error:', error);
			}
		},

		async toggleScreen() {
			try {
				const meStore = useMeStore();
				const me = meStore.me!;
				const existingTrack = webrtcService.getTrack(me.id, MediaType.Screen);
				if (!existingTrack) {
					await webrtcService.addTrack(MediaType.Screen);
					this.isScreenSharing = true;

					const track = webrtcService.getTrack(me.id, MediaType.Screen);
					if (track) {
						track.onended = () => {
							this.isScreenSharing = false;
							webrtcService.removeTrack(MediaType.Screen);
						};
					}
				} else {
					this.isScreenSharing = false;
					webrtcService.removeTrack(MediaType.Screen);
				}
			} catch (error) {
				console.error('Screen share error:', error);
			}
		},
	},
});
