import { defineStore } from 'pinia';
import type { User, id, Message, Event } from '@/types';
import { MessageType, EventType } from '@/types';
import { getFriendList, getFriendRequests, fetchUser } from '@/api/state';
import { websocketService } from '@/services/websocket';
import { useUserStore } from '@/stores/user';

export const useFriendStore = defineStore('friends', {
	state: () => ({
		friends: [] as User[],
		incoming_requests: [] as User[],
		outgoing_requests: [] as User[],
	}),
	getters: {
		hasFriends: (state) => !!state.friends,
		getFriend: (state) => {
			return (id: id) => state.friends.find((user) => user.id === id);
		},
		isFriend: (state) => {
			return (id: id) => state.friends.some((user) => user.id === id);
		},
		isRequestSent: (state) => {
			return (id: id) => state.outgoing_requests.some((user) => user.id === id);
		},
		isRequestReceived: (state) => {
			return (id: id) => state.incoming_requests.some((user) => user.id === id);
		},
	},
	actions: {
		setupListeners() {
			websocketService.onMessage(MessageType.Info, async (message: Message<Event>) => {
				const event = message.data;
				if (event.event === EventType.FriendRequest) {
					const user = await fetchUser(message.from);
					if (!this.incoming_requests.some((u) => u.id === user.id)) {
						this.incoming_requests.push(user);
					}
				} else if (event.event === EventType.FriendAccept) {
					const user = await fetchUser(message.from);
					if (!this.friends.some((u) => u.id === user.id)) {
						this.friends.push(user);
					}
					this.incoming_requests = this.incoming_requests.filter((u) => u.id !== user.id);
					this.outgoing_requests = this.outgoing_requests.filter((u) => u.id !== user.id);
				} else if (event.event === EventType.FriendRemove) {
					const user_id = message.from;
					this.friends = this.friends.filter((u) => u.id !== user_id);
					this.incoming_requests = this.incoming_requests.filter((u) => u.id !== user_id);
					this.outgoing_requests = this.outgoing_requests.filter((u) => u.id !== user_id);
				}
			});
		},
		async init() {
			try {
				const [friends, requests] = await Promise.all([getFriendList(), getFriendRequests()]);
				this.friends = friends;
				this.incoming_requests = requests.incoming;
				this.outgoing_requests = requests.outgoing;
				this.setupListeners();
			} catch (e) {
				console.error(e);
			}
		},
		addSentRequest(user: User) {
			if (!this.outgoing_requests.some((u) => u.id === user.id)) {
				this.outgoing_requests.push(user);
			}
		},
		acceptFriendRequest(user: User) {
			const userStore = useUserStore();
			const accept_msg: Message<Event> = {
				id: 0n,
				from: userStore.user!.id,
				to: user.id,
				data: {
					event: EventType.FriendAccept,
				},
				type: MessageType.Info,
				time: new Date(),
			};
			websocketService.sendMessage(accept_msg);

			// Optimistic update
			if (!this.friends.some((u) => u.id === user.id)) {
				this.friends.push(user);
			}
			this.incoming_requests = this.incoming_requests.filter((u) => u.id !== user.id);
		},
		removeFriend(user: User) {
			const userStore = useUserStore();
			const remove_msg: Message<Event> = {
				id: 0n,
				from: userStore.user!.id,
				to: user.id,
				data: {
					event: EventType.FriendRemove,
				},
				type: MessageType.Info,
				time: new Date(),
			};
			websocketService.sendMessage(remove_msg);

			// Optimistic update
			this.friends = this.friends.filter((u) => u.id !== user.id);
			this.incoming_requests = this.incoming_requests.filter((u) => u.id !== user.id);
			this.outgoing_requests = this.outgoing_requests.filter((u) => u.id !== user.id);
		},
	},
});
