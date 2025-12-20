import { defineStore } from 'pinia';
import type { User } from '@/types';
import { getFriendList } from '@/api/state';

export const useFriendStore = defineStore('friends', {
	state: () => ({
		friends: [] as User[],
	}),
	getters: {
		hasFriends: (state) => !!state.friends,
		getFriend: (state) => {
			return (id: string) => state.friends.find((user) => user.id === id);
		},
		isFriend: (state) => {
			return (id: string) => state.friends.some((user) => user.id === id);
		},
	},
	actions: {
		async initFriend() {
			try {
				this.friends = await getFriendList();
			} catch (e) {
				console.error(e);
			}
		},
	},
});
