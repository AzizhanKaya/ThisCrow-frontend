import { API_URL } from '@/constants';
import { msgFetch } from '@/utils/msgpack';
import type { id, User } from '@/types';

export async function getMe(): Promise<User> {
	const url = API_URL + `/state/me`;

	return await msgFetch<User>(url, { credentials: 'include' });
}

export async function fetchDms(): Promise<id[]> {
	const url = API_URL + `/state/dms`;

	return await msgFetch<id[]>(url, { credentials: 'include' });
}
