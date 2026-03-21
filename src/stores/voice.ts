import { defineStore } from 'pinia';
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

			await webrtcService.addTrack(MediaType.Audio);

			if (channel) {
				const userIds = Array.from(channel?.users ?? [])
					.map((user) => user.id)
					.filter((id) => id !== me.id);
				await webrtcService.initPeerConnections(userIds);
			}

			if (user) {
				await webrtcService.initPeerConnections([user.id]);
			}
		},

		async leaveVoice() {
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
	},
});
