import type { Message } from '@/types';

export async function getMessages({ from, len = 20, start, end }: { from: string; len?: number; start?: Date; end?: Date }): Promise<Message[]> {
	try {
		const params = new URLSearchParams();
		params.append('from', from);
		params.append('len', len.toString());

		if (start) {
			params.append('start', start.toISOString());
		} else if (end) {
			params.append('end', end.toISOString());
		}

		const url = `http://localhost:8080/api/messages?${params.toString()}`;

		const response = await fetch(url);
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
