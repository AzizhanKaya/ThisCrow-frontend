import type { Server, User, id } from '@/types';
import { API_URL } from '@/constants';
import { encode, msgFetch } from '@/utils/msgpack';

export async function fetchServers(server_ids: id[]): Promise<Server[]> {
	return await msgFetch<Server[]>(`${API_URL}/info/groups`, {
		method: 'POST',
		credentials: 'include',
		body: encode(server_ids),
	});
}

export async function fetchUser(id: id): Promise<User> {
	const url = API_URL + `/info/user/${id}`;

	return await msgFetch<User>(url, { credentials: 'include' });
}

export async function fetchUsers(ids: id[]): Promise<User[]> {
	const url = API_URL + `/info/users`;

	return await msgFetch<User[]>(url, {
		method: 'POST',
		credentials: 'include',
		body: encode(ids),
	});
}

export async function searchUser(username: string): Promise<User[]> {
	const params = new URLSearchParams();
	params.append('username', username);

	return msgFetch<User[]>(API_URL + `/info/search_user?${params.toString()}`, {
		credentials: 'include',
	});
}

export async function fetchPublicKey(id: id): Promise<Uint8Array> {
	const url = API_URL + `/info/public_key/${id}`;

	return await msgFetch<Uint8Array>(url, { credentials: 'include' });
}
