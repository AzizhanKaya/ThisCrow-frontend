import { type Message, type User, MessageType, type id, type snowflake_id, type MessageData, type Reaction } from '@/types';
import { API_URL } from '@/constants';
import { msgFetch, encode, decode } from '@/utils/msgpack';
import { useKeyStore } from '@/stores/key';
import { decrypt_message } from '../../pkg/wasm_lib';

export async function fetchMessages({
	from,
	group_id,
	len,
	before,
}: {
	from: id;
	group_id?: id;
	len?: number;
	before?: snowflake_id;
}): Promise<Message[]> {
	const params = new URLSearchParams();

	if (group_id) {
		params.append('channel_id', from.toString());
		params.append('group_id', group_id.toString());
	} else {
		params.append('user_id', from.toString());
	}

	if (before !== undefined) params.append('before', before.toString());

	if (len) params.append('len', len.toString());

	const url = API_URL + `/message/${group_id ? 'channel' : 'direct'}?${params.toString()}`;

	return msgFetch<Message[]>(url);
}

export function fetchMessage(id: snowflake_id): Promise<Message> {
	return msgFetch<Message>(`${API_URL}/message/${id.toString()}`);
}

export function overwriteMessage(message_id: snowflake_id, data: MessageData): Promise<void> {
	return msgFetch(API_URL + '/message/overwrite', {
		method: 'POST',
		body: encode({ message_id, data }),
	});
}

export function deleteMessage(message_id: snowflake_id): Promise<void> {
	return msgFetch(API_URL + '/message/delete', {
		method: 'POST',
		body: encode(message_id),
	});
}

export function fetchReactions(message_id: snowflake_id): Promise<Reaction[]> {
	return msgFetch<Reaction[]>(`${API_URL}/message/${message_id.toString()}/reactions`);
}

export function removeDM(user_id: id): Promise<void> {
	return msgFetch(API_URL + '/message/remove_dm', {
		method: 'POST',
		body: encode(user_id),
	});
}
