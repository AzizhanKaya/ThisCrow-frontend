import { defineStore } from 'pinia';
import type { Me, User, id } from '@/types';
import { fetchUser, fetchUsers } from '@/api/info';
import { websocketService } from '@/services/websocket';
import { MessageType, AckType, type Message, type Ack } from '@/types';

export const useUserStore = defineStore('user', {
	state: () => ({
		users: new Map<id, User>(),
		username_to_id: new Map<string, id>(),
	}),

	actions: {
		setupListeners() {
			websocketService.onMessage(MessageType.Server, async (message: Message<Ack>) => {
				const { ack, payload } = message.data;

				switch (ack) {
					case AckType.ChangedStatus:
						Object.assign(this.users.get(message.from)!, { status: payload });
						break;
					case AckType.UpdatedUser:
						Object.assign(this.users.get(message.from)!, payload);
						break;
				}
			});
		},
		init(me: Me) {
			this.setupListeners();
			this.setUser(me);
		},
		setUser(user: User) {
			const existing = this.users.get(user.id);
			if (existing) {
				Object.assign(existing, user);
			} else {
				this.users.set(user.id, user);
			}
			this.username_to_id.set(user.username, user.id);
		},
		setUsers(users: User[]) {
			users.forEach((user) => this.setUser(user));
		},

		async fetchUsers(ids: id[]) {
			const users = await fetchUsers(ids);
			this.setUsers(users);
		},

		async getUsers(ids: id[]): Promise<User[]> {
			const missingIds = ids.filter((id) => !this.users.has(id));
			if (missingIds.length > 0) {
				const fetchedUsers = await fetchUsers(missingIds);
				this.setUsers(fetchedUsers);
			}

			return ids.map((id) => this.users.get(id)!);
		},

		async getUser(id: id): Promise<User> {
			return this.users.get(id) ?? (this.setUser(await fetchUser({ id })), this.users.get(id)!);
		},

		async getId(username: string): Promise<id> {
			return this.username_to_id.get(username) ?? (this.setUser(await fetchUser({ username })), this.username_to_id.get(username)!);
		},
	},
});
