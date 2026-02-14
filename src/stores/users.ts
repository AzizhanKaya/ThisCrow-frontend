import { defineStore } from 'pinia';
import type { User, id } from '@/types';
import { fetchUser, fetchUsers } from '@/api/state';

export const useUsersStore = defineStore('users', {
	state: () => ({
		users: new Map<id, User>(),
	}),
	getters: {
		getUser: (state) => (id: id) => state.users.get(id),
	},
	actions: {
		setUser(user: User) {
			const existing = this.users.get(user.id);
			if (existing) {
				Object.assign(existing, user);
			} else {
				this.users.set(user.id, user);
			}
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
	},
});
