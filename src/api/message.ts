import type { Message } from '@/types';

export async function getMessages({ from, len = 20, start, end }: { from: string; len?: number; start?: Date; end?: Date }): Promise<Message[]> {
	try {
		const params = new URLSearchParams();
		params.append('user_id', from);
		params.append('len', len.toString());

		if (start) {
			params.append('start', start.toISOString());
		} else if (end) {
			params.append('end', end.toISOString());
		} else {
			params.append('end', new Date().toISOString());
		}

		const url = `/api/state/messages?${params.toString()}`;

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
