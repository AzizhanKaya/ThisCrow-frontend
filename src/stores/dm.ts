import { defineStore } from 'pinia';
import { MessageType, type User, type id, type Message } from '@/types';
import { useUserStore } from './user.ts';
import { useMeStore } from './me.ts';
import { fetchDms } from '@/api/state.ts';
import { websocketService } from '@/services/websocket.ts';
import { removeDM } from '@/api/message.ts';

export const useDMStore = defineStore('dm', {
	state: () => ({
		dms: [] as User[],
		loading_user: new Map<id, Promise<User>>(),
	}),
	getters: {
		isInDms:
			(state) =>
			(id: id): boolean => {
				return state.dms.some((u) => u.id === id);
			},

		getUser:
			(state) =>
			(id: id): User | undefined => {
				return state.dms.find((u) => u.id === id);
			},
	},
	actions: {
		async init() {
			const ready = (async () => {
				const dms = (await fetchDms()).sort((x, y) => (x[1] > y[1] ? 1 : x[1] < y[1] ? -1 : 0)).map(([a, b]) => a);
				const userStore = useUserStore();
				this.dms = await userStore.getUsers(dms);
			})();

			let queue = ready;
			websocketService.onMessage(MessageType.Direct, (m: Message) => {
				queue = queue.then(async () => {
					const meStore = useMeStore();
					if (!meStore.me) return;

					const user_id = m.from === meStore.me.id ? m.to : m.from;
					await this.ensureUser(user_id);

					const index = this.dms.findIndex((u) => u.id === user_id);

					if (index != -1) {
						const [user] = this.dms.splice(index, 1);
						this.dms.push(user);
					}
				});
			});

			await ready;
		},

		async ensureUser(id: id): Promise<User> {
			if (this.getUser(id)) return this.getUser(id)!;

			if (this.loading_user.has(id)) {
				return this.loading_user.get(id)!;
			}

			const addUser = (async () => {
				try {
					const userStore = useUserStore();
					const user = await userStore.getUser(id);

					if (!this.getUser(id)) {
						this.dms.push(user);
					}

					return user;
				} catch (e) {
					console.error('Error while loading user:', e);
					throw e;
				} finally {
					this.loading_user.delete(id);
				}
			})();

			this.loading_user.set(id, addUser);

			return addUser;
		},

		async removeDM(id: id) {
			await removeDM(id);
			this.dms = this.dms.filter((u) => u.id !== id);
		},

		addUser(user: User) {
			this.dms.push(user);
		},
	},
});
