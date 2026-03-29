import { type Message, type User, MessageType, type id, type snowflake_id, type MessageData } from '@/types';
import { API_URL } from '@/constants';
import { msgFetch, encode } from '@/utils/msgpack';

export async function fetchMessages({
	from,
	group_id,
	len,
	start,
	end,
}: {
	from: id;
	group_id?: id;
	len?: number;
	start?: Date;
	end: Date;
}): Promise<Message[]> {
	try {
		const params = new URLSearchParams();

		if (group_id) {
			params.append('channel_id', from.toString());
			params.append('group_id', group_id.toString());
		} else {
			params.append('user_id', from.toString());
		}

		if (start) params.append('start', start.toISOString());
		params.append('end', end.toISOString());

		if (len) params.append('len', len.toString());

		const url = API_URL + `/message/${group_id ? 'channel' : 'direct'}?${params.toString()}`;

		const messages = await msgFetch<Message[]>(url, { credentials: 'include' });

		return messages;
	} catch (error) {
		console.error('Failed to get messages:', error);
		return [];
	}
}

export async function overwriteMessage(message_id: snowflake_id, data: MessageData): Promise<void> {
	try {
		await msgFetch(API_URL + '/message/overwrite', {
			method: 'POST',
			body: encode({ message_id, data }),
			credentials: 'include',
		});
	} catch (error) {
		console.error('Failed to overwrite message:', error);
	}
}

export async function deleteMessage(message_id: snowflake_id): Promise<void> {
	try {
		await msgFetch(API_URL + '/message/delete', {
			method: 'POST',
			body: encode(message_id),
			credentials: 'include',
		});
	} catch (error) {
		console.error('Failed to delete message:', error);
	}
}

export async function removeDM(user_id: id): Promise<void> {
	try {
		await msgFetch(API_URL + '/message/remove_dm', {
			method: 'POST',
			body: encode(user_id),
			credentials: 'include',
		});
	} catch (error) {
		console.error('Failed to remove DM:', error);
	}
}
