import type { Server, User } from '../types';
import { API_URL } from '../constants';

export async function getServerList(): Promise<Server[]> {
	const res = await fetch(`${API_URL}/state/groups`, {
		method: 'GET',
		credentials: 'include',
	});

	if (!res.ok) {
		throw new Error(`error getServerList: ${await res.text()}`);
	}

	const servers = await res.json();

	return servers as Server[];
}

export async function getFriendList(): Promise<User[]> {
	const res = await fetch(`${API_URL}/state/friends`, {
		method: 'GET',
		credentials: 'include',
	});

	if (!res.ok) {
		throw new Error(`error getFriendList: ${await res.text()}`);
	}

	const friends = await res.json();

	return friends as User[];
}

export async function me() {
	const response = await fetch(API_URL + '/state/me', { credentials: 'include' });
	if (!response.ok) {
		throw new Error(`Redirecting login page: ${await response.text()}`);
	}

	const data: User = await response.json();
	return data;
}

export async function searchFriends(username: string) {
	const params = new URLSearchParams();
	params.append('username', username);

	const response = await fetch(API_URL + `/event/search_users?${params.toString()}`, {
		credentials: 'include',
	});

	if (!response.ok) {
		throw new Error(await response.text());
	}

	const data = await response.json();
	return data as User[];
}

export async function addFriend(userId: string) {
	const response = await fetch(API_URL + '/event/add_friend', {
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
