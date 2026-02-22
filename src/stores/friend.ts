import { defineStore } from 'pinia';
import type { User, id, Message, Event, Ack } from '@/types';
import { MessageType, EventType, AckType } from '@/types';
import { websocketService } from '@/services/websocket';
import { useMeStore } from '@/stores/me';
import { useUserStore } from './user';
import { useDMStore } from './dm';

export const useFriendStore = defineStore('friends', {
	state: () => ({
		friends: new Map<id, User>(),
		incoming_requests: [] as User[],
		outgoing_requests: [] as User[],
	}),
	getters: {
		hasFriends: (state) => !!state.friends,
		getFriend: (state) => {
			return (id: id) => state.friends.get(id);
		},
		isFriend: (state) => {
			return (id: id) => state.friends.has(id);
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
			websocketService.onMessage(MessageType.Server, async (message: Message<Ack>) => {
				const userStore = useUserStore();
				const { ack, payload } = message.data;

				switch (ack) {
					case AckType.AddedFriend: {
						const user = await userStore.getUser(payload);
						const dmStore = useDMStore();
						dmStore.addUser(user);
						this.friends.set(user.id, user);
						this.outgoing_requests = this.outgoing_requests.filter((u) => u.id !== user.id);
						this.incoming_requests = this.incoming_requests.filter((u) => u.id !== user.id);
						break;
					}

					case AckType.ReceivedFriendRequest: {
						const user = await userStore.getUser(payload);
						if (!this.incoming_requests.some((u) => u.id === user.id)) {
							this.incoming_requests.push(user);
						}
						break;
					}

					case AckType.SentFriendRequest: {
						const user = await userStore.getUser(payload);
						if (!this.outgoing_requests.some((u) => u.id === user.id)) {
							this.outgoing_requests.push(user);
						}
						break;
					}

					case AckType.DeletedFriend: {
						this.friends.delete(payload);
						this.incoming_requests = this.incoming_requests.filter((u) => u.id !== payload);
						this.outgoing_requests = this.outgoing_requests.filter((u) => u.id !== payload);
						break;
					}
				}
			});
		},
		async init(friends: id[], incoming: id[], outgoing: id[]) {
			this.setupListeners();

			const userStore = useUserStore();

			this.friends = new Map((await userStore.getUsers(friends)).map((user) => [user.id, user]));
			this.incoming_requests = await userStore.getUsers(incoming);
			this.outgoing_requests = await userStore.getUsers(outgoing);
		},
		sendFriendRequest(user: User) {
			const meStore = useMeStore();
			const add_friend: Message<Event> = {
				id: 0n,
				from: meStore.me!.id,
				to: user.id,
				data: {
					event: EventType.FriendRequest,
				},
				type: MessageType.Info,
				time: new Date(),
			};

			websocketService.sendMessage(add_friend);
		},
		acceptFriendRequest(user: User) {
			const meStore = useMeStore();
			const accept: Message<Event> = {
				id: 0n,
				from: meStore.me!.id,
				to: user.id,
				data: {
					event: EventType.FriendAccept,
				},
				type: MessageType.Info,
				time: new Date(),
			};
			websocketService.sendMessage(accept);
		},
		removeFriend(user: User) {
			const meStore = useMeStore();
			const remove: Message<Event> = {
				id: 0n,
				from: meStore.me!.id,
				to: user.id,
				data: {
					event: EventType.FriendRemove,
				},
				type: MessageType.Info,
				time: new Date(),
			};
			websocketService.sendMessage(remove);
		},
	},
});
