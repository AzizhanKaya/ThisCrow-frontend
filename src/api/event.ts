import type { Server, User } from '@/types';
import { API_URL } from '@/constants';
import { msgFetch } from '@/utils/msgpack';

export async function searchUser(username: string): Promise<User[]> {
	const params = new URLSearchParams();
	params.append('username', username);

	return msgFetch<User[]>(API_URL + `/info/search_user?${params.toString()}`, {
		credentials: 'include',
	});
}
