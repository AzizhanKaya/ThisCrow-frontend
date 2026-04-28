import { defineStore } from 'pinia';
import { watch, ref } from 'vue';
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

export interface AudioDevice {
	deviceId: string;
	label: string;
}

export const useVoiceStore = defineStore('voice', {
	state: () => ({
		voice_channel: undefined as Channel | undefined,
		group_id: undefined as id | undefined,
		voice_direct: undefined as User | undefined,
		on_voice_direct: [] as id[],
		unwatch: null as (() => void) | null,
		isMuted: false,
		isDeafened: false,
		isVideoOn: false,
		isScreenSharing: false,
		cleanupUnload: null as (() => void) | null,
		audioDevices: [] as AudioDevice[],
		selectedDeviceId: '' as string,
		showDeviceSelector: false,
		outputDevices: [] as AudioDevice[],
		selectedOutputDeviceId: '' as string,
		showOutputDeviceSelector: false,
		deviceChangeCleanup: null as (() => void) | null,
		voiceThreshold: 0.02,
		noiseSuppression: true,
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
			this.isDeafened = false;
			this.isVideoOn = false;
			this.isScreenSharing = false;
			this.unwatch = null;
			this.cleanupUnload = null;
			this.audioDevices = [];
			this.selectedDeviceId = '';
			this.showDeviceSelector = false;
			this.outputDevices = [];
			this.selectedOutputDeviceId = '';
			this.showOutputDeviceSelector = false;
			this.setupListeners();
			this.setupDeviceChangeListener();
		},

		setupDeviceChangeListener() {
			if (this.deviceChangeCleanup) this.deviceChangeCleanup();
			const handler = () => {
				this.enumerateAudioDevices();
				this.enumerateOutputDevices();
			};
			navigator.mediaDevices.addEventListener('devicechange', handler);
			this.deviceChangeCleanup = () => {
				navigator.mediaDevices.removeEventListener('devicechange', handler);
			};
		},

		async enumerateAudioDevices() {
			try {
				const devices = await navigator.mediaDevices.enumerateDevices();
				this.audioDevices = devices
					.filter((d) => d.kind === 'audioinput')
					.map((d) => ({
						deviceId: d.deviceId,
						label: d.label || `Microphone (${d.deviceId.slice(0, 5)}...)`,
					}));

				if (!this.selectedDeviceId || !this.audioDevices.some((d) => d.deviceId === this.selectedDeviceId)) {
					this.selectedDeviceId = this.audioDevices[0]?.deviceId || '';
				}
			} catch (e) {
				console.error('Failed to enumerate audio devices:', e);
			}
		},

		async selectAudioDevice(deviceId: string) {
			this.selectedDeviceId = deviceId;
			this.showDeviceSelector = false;

			if ((this.voice_channel || this.voice_direct) && !this.isMuted) {
				try {
					await webrtcService.removeTrack(MediaType.Audio);
					const track = await webrtcService.addTrack(MediaType.Audio, deviceId);
					track.onended = () => {
						this.isMuted = true;
						webrtcService.removeTrack(MediaType.Audio);
					};
				} catch (e) {
					console.error('Failed to switch microphone:', e);
				}
			}
		},

		toggleDeviceSelector() {
			this.showDeviceSelector = !this.showDeviceSelector;
			this.showOutputDeviceSelector = false;
			if (this.showDeviceSelector) {
				this.enumerateAudioDevices();
			}
		},

		async enumerateOutputDevices() {
			try {
				const devices = await navigator.mediaDevices.enumerateDevices();
				this.outputDevices = devices
					.filter((d) => d.kind === 'audiooutput')
					.map((d) => ({
						deviceId: d.deviceId,
						label: d.label || `Speaker (${d.deviceId.slice(0, 5)}...)`,
					}));

				if (!this.selectedOutputDeviceId || !this.outputDevices.some((d) => d.deviceId === this.selectedOutputDeviceId)) {
					this.selectedOutputDeviceId = this.outputDevices[0]?.deviceId || '';
				}
			} catch (e) {
				console.error('Failed to enumerate output devices:', e);
			}
		},

		selectOutputDevice(deviceId: string) {
			this.selectedOutputDeviceId = deviceId;
			this.showOutputDeviceSelector = false;
		},

		toggleOutputDeviceSelector() {
			this.showOutputDeviceSelector = !this.showOutputDeviceSelector;
			this.showDeviceSelector = false;
			if (this.showOutputDeviceSelector) {
				this.enumerateOutputDevices();
			}
		},

		toggleDeafen() {
			this.isDeafened = !this.isDeafened;
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

			const audioReady = webrtcService.addTrack(MediaType.Audio).catch((e) => {
				console.error('Mic error during join:', e);
				return null;
			});

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
				webrtcService.disconnectAll();
				this.voice_channel = undefined;
				this.group_id = undefined;
				this.voice_direct = undefined;
				throw e;
			}

			await audioReady;
			this.enumerateAudioDevices();

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

			const to = this.voice_direct?.id || this.voice_channel?.id;
			const group_id = this.group_id;

			try {
				if (to) {
					await websocketService.request({
						id: generate_uid(me.id),
						type: group_id ? MessageType.InfoGroup : MessageType.Info,
						from: me.id,
						to,
						group_id,
						data: {
							event: EventType.ExitVoice,
						},
					});
				}
			} catch (e) {
				console.error(e);
			} finally {
				webrtcService.disconnectAll();
				this.voice_channel = undefined;
				this.group_id = undefined;
				this.voice_direct = undefined;
				this.isMuted = false;
				this.isVideoOn = false;
				this.isScreenSharing = false;
				this.isDeafened = false;
			}
		},

		async toggleMute() {
			try {
				if (this.isMuted) {
					const track = await webrtcService.addTrack(MediaType.Audio, this.selectedDeviceId || undefined);
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
