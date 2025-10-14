import type { Server, User } from '@/types';
import { API_URL } from '@/constants';

export async function searchUser(username: string) {
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
