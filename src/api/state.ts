import { API_URL } from '@/constants';
import { msgFetch } from '@/utils/msgpack';
import type { id, snowflake_id, User } from '@/types';

export async function getMe(): Promise<User> {
	const url = API_URL + `/state/me`;

	return await msgFetch<User>(url);
}

export async function fetchDms(): Promise<[id, snowflake_id][]> {
	const url = API_URL + `/state/dms`;

	return msgFetch<[id, snowflake_id][]>(url);
}

export async function getVoiceDirect(): Promise<[id]> {
	const url = API_URL + `/state/voice_direct`;

	return msgFetch<[id]>(url);
}

if (typeof window !== 'undefined') {
	(window as any).getMe = getMe;
}

