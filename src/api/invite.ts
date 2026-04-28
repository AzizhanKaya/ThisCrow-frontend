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
	return await msgFetch<Invitation>(`${API_URL}/invitation/create`, {
		method: 'POST',
		credentials: 'include',
		body: encode({ group_id, expires_at, max_uses: max_uses ?? null }),
	});
}

export async function joinInvitation(code: string): Promise<void> {
	return await msgFetch<void>(`${API_URL}/invitation/join`, {
		method: 'POST',
		credentials: 'include',
		body: encode(code),
	});
}

export interface Invitation {
	group_id: id;
	group_name: string;
	group_icon: string | undefined;
	group_description: string | undefined;
	member_count: number;
}

export async function getInvitationInfo(code: string): Promise<Invitation> {
	const params = new URLSearchParams();
	params.append('code', code);
	return await msgFetch<Invitation>(`${API_URL}/invitation/info?${params.toString()}`, {
		credentials: 'include',
	});
}

export async function getGroupInvitations(group_id: id): Promise<Invitation[]> {
	return await msgFetch<Invitation[]>(`${API_URL}/invitation/list`, {
		method: 'POST',
		credentials: 'include',
		body: encode(group_id),
	});
}

export async function deleteInvitation(id: id): Promise<void> {
	return await msgFetch<void>(`${API_URL}/invitation/delete`, {
		method: 'POST',
		credentials: 'include',
		body: encode(id),
	});
}
