import type { Message } from '@/types';
import { API_URL } from '@/constants';

export async function getMessages({ from, len = 20, end }: { from: string; len?: number; end?: Date }): Promise<Message[]> {
	try {
		const params = new URLSearchParams();
		params.append('user_id', from);
		params.append('len', len.toString());

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
