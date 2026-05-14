import { API_URL } from '@/constants';
import { msgFetch } from '@/utils/msgpack';
import type { id } from '@/types';

export interface BannedUser {
	id: id;
	username: string;
	name: string;
	avatar: string | null;
	banned_by: id | null;
	banned_at: string;
}

export async function getBans(group_id: id): Promise<BannedUser[]> {
	return msgFetch<BannedUser[]>(`${API_URL}/group/${group_id}/bans`, {
		credentials: 'include',
	});
}

export async function unbanUser(group_id: id, user_id: id): Promise<void> {
	return msgFetch<void>(`${API_URL}/group/${group_id}/bans/${user_id}`, {
		method: 'DELETE',
		credentials: 'include',
	});
}
