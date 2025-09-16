import { defineStore } from 'pinia';
import type { User } from '@/types';
import { getFriendList } from '@/api/state';

export const useFriendStore = defineStore('friends', {
	state: () => ({
		friends: [] as User[],
	}),
	getters: {
		hasFriends: (state) => !!state.friends,
	},
	actions: {
		setFriends(friends: User[]) {
			this.friends = friends;
		},

		async initFriend() {
			try {
				const friends = await getFriendList();
				this.setFriends(friends);
			} catch (e) {
				console.error(e);
			}
		},
	},
});
