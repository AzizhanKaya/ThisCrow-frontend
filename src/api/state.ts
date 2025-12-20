import type { Server, User } from '@/types';
import { API_URL } from '@/constants';

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

export async function getServerMembers(server: Server): Promise<User[]> {
	const params = new URLSearchParams();
	params.append('server_id', server.id);

	const res = await fetch(`${API_URL}/state/group_members?${params.toString()}`, {
		method: 'GET',
		credentials: 'include',
	});

	if (!res.ok) {
		throw new Error(`error getServerMembers: ${await res.text()}`);
	}

	const users = await res.json();

	return users as User[];
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

export async function getDms(): Promise<User[]> {
	try {
		const url = API_URL + `/state/dms`;

		const response = await fetch(url, { credentials: 'include' });
		if (!response.ok) {
			throw new Error(await response.text());
		}
		const data = await response.json();
		return data as User[];
	} catch (error) {
		console.error('Failed to get dms:', error);
		return [];
	}
}

export async function getUser(id: string): Promise<User> {
	const params = new URLSearchParams();
	params.append('id', id);
	const url = API_URL + `/state/user?${params.toString()}`;

	const response = await fetch(url, { credentials: 'include' });
	if (!response.ok) {
		throw new Error(await response.text());
	}
	const data = await response.json();
	return data as User;
}
