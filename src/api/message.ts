import { type Message, type User, MessageType, type id } from '@/types';
import { API_URL } from '@/constants';
import { msgFetch, encode } from '@/utils/msgpack';
export async function fetchMessages({
	from,
	len,
	start,
	end,
	type = MessageType.Direct,
}: {
	from: id;
	len?: number;
	start?: Date;
	end: Date;
	type?: MessageType;
}): Promise<Message[]> {
	try {
		const params = new URLSearchParams();

		params.append('type', type);
		params.append('user_id', from.toString());

		if (start) params.append('start', start.toISOString());
		params.append('end', end.toISOString());

		if (len) params.append('len', len.toString());

		const url = API_URL + `/state/messages?${params.toString()}`;

		const messages = await msgFetch<Message[]>(url, { credentials: 'include' });

		return messages;
	} catch (error) {
		console.error('Failed to get messages:', error);
		return [];
	}
}

export async function overwriteMessage(message: Message): Promise<void> {
	try {
		await msgFetch(API_URL + '/message/overwrite', {
			method: 'POST',
			body: encode(message),
			credentials: 'include',
		});
	} catch (error) {
		console.error('Failed to overwrite message:', error);
	}
}

export async function deleteMessage(message: Message): Promise<void> {
	try {
		await msgFetch(API_URL + '/message/delete', {
			method: 'POST',
			body: encode(message),
			credentials: 'include',
		});
	} catch (error) {
		console.error('Failed to delete message:', error);
	}
}
