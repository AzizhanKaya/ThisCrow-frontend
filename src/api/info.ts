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

export async function fetchUser({ id, username }: { id?: id; username?: string }): Promise<User> {
	const params = new URLSearchParams();
	if (id) params.append('id', id.toString());
	if (username) params.append('username', username);
	const url = API_URL + `/info/user?${params.toString()}`;

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
