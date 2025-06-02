import type { User } from '@/types';

export async function login(username: string, password: string) {
	const params = new URLSearchParams();
	params.append('username', username);
	params.append('password', password);

	const response = await fetch('/api/auth/login', {
		method: 'POST',
		body: params,
		credentials: 'include',
	});

	if (!response.ok) {
		throw new Error(await response.text());
	}

	const data: User = await response.json();
	return data;
}

export async function register(username: string, name: string, email: string, password: string) {
	const params = new URLSearchParams();
	params.append('username', username);
	params.append('name', name);
	params.append('email', email);
	params.append('password', password);

	const response = await fetch('/api/auth/register', {
		method: 'POST',
		body: params,
		credentials: 'include',
	});

	if (!response.ok) {
		throw new Error(await response.text());
	}

	const data = await response.json();
	return data;
}
