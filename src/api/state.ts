import { useFetch } from '@vueuse/core';
import type { Server, User } from '../types';
import { ref, watch } from 'vue';

export function getServerList() {
	const servers = ref<Server[] | null>(null);

	const { data, error, isFetching } = useFetch('/api/server_list').get().json<Server[]>();

	watch(
		data,
		(newData) => {
			if (newData) {
				servers.value = newData;
			}
		},
		{ once: true }
	);

	return {
		servers,
		error,
		isFetching,
	};
}

export function getFriendList() {
	const friends = ref<User[] | null>(null);

	const { data, error, isFetching } = useFetch('/api/friends').get().json<User[]>();

	watch(
		data,
		(newData) => {
			if (newData) {
				friends.value = newData;
			}
		},
		{ once: true }
	);

	return {
		friends,
		error,
		isFetching,
	};
}
