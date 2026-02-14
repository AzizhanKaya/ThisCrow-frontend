import type { Server, User, id } from '@/types';
import { API_URL } from '@/constants';
import { msgFetch } from '@/utils/msgpack';

export async function getServerList(): Promise<Server[]> {
	return await msgFetch<Server[]>(`${API_URL}/state/groups`, {
		method: 'GET',
		credentials: 'include',
	});
}

export async function getServerMembers(server: Server): Promise<User[]> {
	const params = new URLSearchParams();
	params.append('server_id', server.id.toString());

	return await msgFetch<User[]>(`${API_URL}/state/group_members?${params.toString()}`, {
		method: 'GET',
		credentials: 'include',
	});
}

export async function getFriendList(): Promise<User[]> {
	return await msgFetch<User[]>(`${API_URL}/state/friends`, {
		method: 'GET',
		credentials: 'include',
	});
}

export async function getFriendRequests(): Promise<{ incoming: User[]; outgoing: User[] }> {
	return await msgFetch<{ incoming: User[]; outgoing: User[] }>(`${API_URL}/state/friend_requests`, {
		method: 'GET',
		credentials: 'include',
	});
}

export async function me() {
	try {
		const data = await msgFetch<User>(API_URL + '/state/me', { credentials: 'include' });
		return data;
	} catch (e: any) {
		throw new Error(`Redirecting login page: ${e.message}`);
	}
}

export async function getDms(): Promise<User[]> {
	try {
		const url = API_URL + `/state/dms`;

		const data = await msgFetch<User[]>(url, { credentials: 'include' });
		return data;
	} catch (error) {
		console.error('Failed to get dms:', error);
		return [];
	}
}

export async function fetchUser(id: id): Promise<User> {
	const params = new URLSearchParams();
	params.append('id', id.toString());
	const url = API_URL + `/state/user?${params.toString()}`;

	return await msgFetch<User>(url, { credentials: 'include' });
}

export async function fetchUsers(id: id[]): Promise<User[]> {
	const params = new URLSearchParams();
	params.append('id', id.toString());
	const url = API_URL + `/users`;

	return await msgFetch<User[]>(url, { credentials: 'include' });
}
