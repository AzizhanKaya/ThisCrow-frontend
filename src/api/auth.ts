import { API_URL } from '@/constants';
import type { User } from '@/types';
import { msgFetch, encode } from '@/utils/msgpack';

export async function login(username: string, password: string) {
	const body = encode({ username, password });

	await msgFetch(API_URL + '/auth/login', {
		method: 'POST',
		body,
		credentials: 'include',
	});
}

export async function register(username: string, name: string, email: string, password: string) {
	const body = encode({ username, name, email, password });

	await msgFetch(API_URL + '/auth/register', {
		method: 'POST',
		body,
		credentials: 'include',
	});
}
