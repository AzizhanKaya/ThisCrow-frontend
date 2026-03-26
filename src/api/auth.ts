import { API_URL } from '@/constants';
import type { User } from '@/types';
import { msgFetch, encode } from '@/utils/msgpack';
import { generate_keypair } from '@/../pkg/wasm_lib';

export async function login(username: string, password: string) {
	const body = encode({ username, password });

	await msgFetch(API_URL + '/auth/login', {
		method: 'POST',
		body,
		credentials: 'include',
	});
}

export async function register(username: string, name: string, email: string, password: string) {
	const public_key = generate_keypair(password).public_key;
	const body = encode({ username, name, email, password, public_key });

	await msgFetch(API_URL + '/auth/register', {
		method: 'POST',
		body,
		credentials: 'include',
	});
}
