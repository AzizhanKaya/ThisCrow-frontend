import { API_URL } from '@/constants';
import { msgFetch } from '@/utils/msgpack';
import type { id, snowflake_id, User } from '@/types';

export async function getMe(): Promise<User> {
	const url = API_URL + `/state/me`;

	return await msgFetch<User>(url, { credentials: 'include' });
}

export async function fetchDms(): Promise<[id, snowflake_id][]> {
	const url = API_URL + `/state/dms`;

	return msgFetch<[id, snowflake_id][]>(url, { credentials: 'include' });
}

export async function logOut(): Promise<void> {
	const url = API_URL + `/state/logout`;

	return msgFetch<void>(url, { credentials: 'include' });
}
