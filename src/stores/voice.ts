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
	AckType,
	type Ack,
} from '@/types';
import { websocketService } from '@/services/websocket';
import { generate_uid } from '@/utils/uid';
import { useMeStore } from './me';
import { useAppStore } from './app';
import { webrtcService, MediaType } from '@/services/webrtc';
import { useUserStore } from './user';
import { useModalStore, ModalView } from './modal';

export const useVoiceStore = defineStore('voice', {
	state: () => ({
		voice_channel: undefined as Channel | undefined,
		group_id: undefined as id | undefined,
		voice_direct: undefined as User | undefined,
		on_voice_direct: [] as id[],
		unwatch: null as (() => void) | null,
		isMuted: false,
		isVideoOn: false,
		isScreenSharing: false,
		cleanupUnload: null as (() => void) | null,
	}),

	actions: {
		setupListeners() {
			websocketService.onMessage(MessageType.Server, async (message: Message<Ack>) => {
				const { ack, payload } = message.data;
				if (message.from !== 0) return;
				const me = useMeStore().me!;
				const usersStore = useUserStore();

				switch (ack) {
					case AckType.JoinedVoice: {
						if (message.to === me.id) {
							this.voice_direct = await usersStore.getUser(payload);
						} else if (!this.on_voice_direct.includes(message.to)) {
							this.on_voice_direct.push(message.to);
							if (this.voice_direct?.id !== message.to) {
								const user = await usersStore.getUser(message.to);
								if (user) {
									const modalStore = useModalStore();
									modalStore.openModal(ModalView.CALLING, { user });
								}
							}
						}
						break;
					}
					case AckType.ExitedVoice: {
						if (message.to === me.id) {
							await this.leaveVoice();
						} else {
							this.on_voice_direct = this.on_voice_direct.filter((id) => id !== message.to);
						}
						break;
					}
				}
			});
		},
		init() {
			this.voice_channel = undefined;
			this.group_id = undefined;
			this.voice_direct = undefined;
			this.on_voice_direct = [];
			this.isMuted = false;
			this.isVideoOn = false;
			this.isScreenSharing = false;
			this.unwatch = null;
			this.cleanupUnload = null;
			this.setupListeners();
		},

		async joinVoice(channel?: Channel, group_id?: id, user?: User): Promise<void> {
			const me = useMeStore().me!;

			if (this.voice_channel || this.voice_direct) {
				if (channel?.id === this.voice_channel?.id && user?.id === this.voice_direct?.id) return;
				await this.leaveVoice();
			}

			const appStore = useAppStore();
			if (!this.cleanupUnload) {
				this.cleanupUnload = appStore.onBeforeUnload(this.leaveVoice);
			}

			const to = user?.id || channel?.id;

			try {
				await websocketService.request({
					id: generate_uid(me.id),
					type: group_id ? MessageType.InfoGroup : MessageType.Info,
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
					() => (this.voice_channel?.users ? Array.from(this.voice_channel.users).map((u) => u.id) : []),
					async (newIds, oldIds) => {
						const oldSet = new Set(oldIds || []);
						const addedIds = newIds.filter((id) => id !== me.id && !oldSet.has(id));

						const newSet = new Set(newIds);
						const removedIds = (oldIds || []).filter((id) => id !== me.id && !newSet.has(id));

						if (addedIds.length > 0) {
							await webrtcService.connectPeers(addedIds);
						}

						if (removedIds.length > 0) {
							removedIds.forEach((id) => webrtcService.removePeerConnection(id));
						}
					},
					{ immediate: true, deep: true }
				);
			}

			if (user) {
				this.unwatch = watch(
					() => this.voice_direct,
					async (newUser, oldUser) => {
						if (newUser?.id === oldUser?.id) return;

						if (oldUser) {
							webrtcService.removePeerConnection(oldUser.id);
						}

						if (newUser) {
							await webrtcService.connectPeers([newUser.id]);
						}
					},
					{ immediate: true }
				);
			}

			await webrtcService.addTrack(MediaType.Audio);
		},

		async leaveVoice() {
			if (this.cleanupUnload) {
				this.cleanupUnload();
				this.cleanupUnload = null;
			}

			if (this.unwatch) {
				this.unwatch();
				this.unwatch = null;
			}

			const meStore = useMeStore();
			const me = meStore.me!;
			webrtcService.disconnectAll();

			const to = this.voice_direct?.id || this.voice_channel?.id;

			try {
				if (to) {
					await websocketService.request({
						id: generate_uid(me.id),
						type: this.group_id ? MessageType.InfoGroup : MessageType.Info,
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
				this.on_voice_direct = [];
				this.isVideoOn = false;
				this.isScreenSharing = false;
			}
		},

		async toggleMute() {
			try {
				if (this.isMuted) {
					const track = await webrtcService.addTrack(MediaType.Audio);
					this.isMuted = false;
					track.onended = () => {
						this.isMuted = true;
						webrtcService.removeTrack(MediaType.Audio);
					};
				} else {
					await webrtcService.removeTrack(MediaType.Audio);
					this.isMuted = true;
				}
			} catch (error) {
				console.error('Microphone error:', error);
			}
		},

		async toggleVideo() {
			try {
				if (!this.isVideoOn) {
					const track = await webrtcService.addTrack(MediaType.Video);
					this.isVideoOn = true;
					track.onended = () => {
						this.isVideoOn = false;
						webrtcService.removeTrack(MediaType.Video);
					};
				} else {
					await webrtcService.removeTrack(MediaType.Video);
					this.isVideoOn = false;
				}
			} catch (error) {
				console.error('Camera error:', error);
			}
		},

		async toggleScreen() {
			try {
				if (!this.isScreenSharing) {
					const track = await webrtcService.addTrack(MediaType.Screen);
					this.isScreenSharing = true;
					track.onended = () => {
						this.isScreenSharing = false;
						webrtcService.removeTrack(MediaType.Screen);
					};
				} else {
					await webrtcService.removeTrack(MediaType.Screen);
					this.isScreenSharing = false;
				}
			} catch (error) {
				console.error('Screen share error:', error);
			}
		},
	},
});
