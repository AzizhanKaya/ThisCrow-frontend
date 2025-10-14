import type { Message, User } from '@/types';
import { API_URL } from '@/constants';

export async function fetchMessages({ from, len, end, order = 'inc' }: { from: string; len?: number; end?: Date; order?: string }): Promise<Message[]> {
	try {
		const params = new URLSearchParams();
		params.append('user_id', from);
		params.append('order', order);

		if (len) {
			params.append('len', len.toString());
		}

		if (end) {
			params.append('end', end.toISOString());
		} else {
			params.append('end', new Date().toISOString());
		}

		const url = API_URL + `/state/messages?${params.toString()}`;

		const response = await fetch(url, { credentials: 'include' });
		if (!response.ok) {
			throw new Error(await response.text());
		}
		const data = await response.json();
		return data as Message[];
	} catch (error) {
		console.error('Failed to get messages:', error);
		return [];
	}
}

export async function getDms(): Promise<User[]> {
	try {
		const url = API_URL + `/state/dms`;

		const response = await fetch(url, { credentials: 'include' });
		if (!response.ok) {
			throw new Error(await response.text());
		}
		const data = await response.json();
		return data as User[];
	} catch (error) {
		console.error('Failed to get messages:', error);
		return [];
	}
}
