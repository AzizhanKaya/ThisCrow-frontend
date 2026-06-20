import { API_URL } from '@/constants';
import { encode, msgFetch } from '@/utils/msgpack';
import type { id } from '@/types';

export interface Invitation {
	id: id;
	code: string;
	group_id: id;
	created_by: id;
	max_uses: number | null;
	uses: number;
	expires_at: string;
	created_at: string;
}

export async function createInvitation(group_id: id, expires_at: string, max_uses?: number): Promise<Invitation> {
	return msgFetch<Invitation>(`${API_URL}/invitation/create`, {
		method: 'POST',
		body: encode({ group_id, expires_at, max_uses: max_uses ?? null }),
	});
}

export async function joinInvitation(code: string): Promise<void> {
	return msgFetch<void>(`${API_URL}/invitation/join`, {
		method: 'POST',
		body: encode(code),
	});
}

export interface InvitationInfo {
	group_id: id;
	group_name: string;
	group_icon?: string;
	group_description?: string;
	member_count: number;
	online_count: number;
	text_channel_count: number;
	voice_channel_count: number;
	owner?: id;
}

export async function getInvitationInfo(code: string): Promise<InvitationInfo> {
	const params = new URLSearchParams();
	params.append('code', code);
	return msgFetch<InvitationInfo>(`${API_URL}/invitation/info?${params.toString()}`);
}

export async function getGroupInvitations(group_id: id): Promise<Invitation[]> {
	return msgFetch<Invitation[]>(`${API_URL}/invitation/list`, {
		method: 'POST',
		body: encode(group_id),
	});
}

export async function deleteInvitation(id: id): Promise<void> {
	return msgFetch<void>(`${API_URL}/invitation/delete`, {
		method: 'POST',
		body: encode(id),
	});
}
