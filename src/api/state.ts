import { useFetch } from '@vueuse/core';
import type { Server, User } from '../types';

export function getServerList() {
	const { data, error, isFetching } = useFetch('/api/state/groups', { credentials: 'include' }).get().json<Server[]>();

	return {
		servers: data,
		error,
		isFetching,
	};
}

export function getFriendList() {
	const { data, error, isFetching } = useFetch('/api/state/friends', { credentials: 'include' }).get().json<User[]>();

	return {
		friends: data,
		error,
		isFetching,
	};
}

export async function me() {
	const response = await fetch('/api/state/me', { credentials: 'include' });
	if (!response.ok) {
		throw new Error(`Redirecting login page: ${await response.text()}`);
	}

	const data: User = await response.json();
	return data;
}

export async function searchFriends(username: string) {
	const params = new URLSearchParams();
	params.append('username', username);

	const response = await fetch(`/api/state/search_friends?${params.toString()}`, {
		credentials: 'include',
	});

	if (!response.ok) {
		throw new Error(await response.text());
	}

	const data = await response.json();
	return data as User[];
}

export async function addFriend(userId: string) {
	const response = await fetch('/api/state/add_friend', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		credentials: 'include',
		body: JSON.stringify({ user_id: userId }),
	});

	if (!response.ok) {
		throw new Error(await response.text());
	}

	return;
}
