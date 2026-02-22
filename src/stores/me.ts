import { defineStore } from 'pinia';
import { EventType, MessageType, type Me, type Message, type Status, type Event } from '@/types';
import { websocketService } from '@/services/websocket';

export const useMeStore = defineStore('me', {
	state: () => ({
		me: undefined as Me | null | undefined,
	}),

	actions: {
		setMe(me: Me) {
			this.me = me;
		},

		changeStatus(status: Status) {
			let change_status: Message<Event> = {
				id: 0n,
				from: this.me!.id,
				to: 0n,
				data: {
					event: EventType.ChangeStatus,
					payload: status,
				},
				type: MessageType.Info,
				time: new Date(),
			};

			websocketService.sendMessage(change_status);
		},
	},
});
