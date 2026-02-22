import { API_URL } from '@/constants';
import { msgFetch } from '@/utils/msgpack';
import type { User } from '@/types';

export async function getMe(): Promise<User> {
	const url = API_URL + `/state/me`;

	return await msgFetch<User>(url, { credentials: 'include' });
}
