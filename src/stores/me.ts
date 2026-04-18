import { defineStore } from 'pinia';
import { EventType, MessageType, type Me, type Message, type Status, type Event } from '@/types';
import { websocketService } from '@/services/websocket';
import { logOut } from '@/api/state';
import { generate_uid } from '@/utils/uid';

export const useMeStore = defineStore('me', {
	state: () => ({
		me: undefined as Me | null | undefined,
	}),

	actions: {
		setMe(me: Me) {
			this.me = me;
		},

		async logOut() {
			this.me = null;
			websocketService.disconnect();
			localStorage.removeItem('private_key');
			localStorage.removeItem('public_key');
			await logOut();
		},

		changeStatus(status: Status) {
			let change_status: Message<Event> = {
				id: generate_uid(this.me!.id),
				from: this.me!.id,
				to: 0,
				data: {
					event: EventType.ChangeStatus,
					payload: status,
				},
				type: MessageType.Info,
			};

			websocketService.sendMessage(change_status);
		},
	},
});
