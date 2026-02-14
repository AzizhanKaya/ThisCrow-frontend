import type { Server, User } from '@/types';
import { API_URL } from '@/constants';
import { msgFetch } from '@/utils/msgpack';

export async function searchUser(username: string) {
	const params = new URLSearchParams();
	params.append('username', username);

	return msgFetch<User[]>(API_URL + `/event/search_users?${params.toString()}`, {
		credentials: 'include',
	});
}
