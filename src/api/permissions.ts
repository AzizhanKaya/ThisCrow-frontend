import type { OverrideTarget, PermissionOverride, id } from '@/types';
import { API_URL } from '@/constants';
import { msgFetch } from '@/utils/msgpack';

export type GroupRolePermissions = {
	everyone: number;
	roles: Record<id, number>;
};

export async function fetchRolePermissions(group_id: id): Promise<GroupRolePermissions> {
	return msgFetch<GroupRolePermissions>(`${API_URL}/group/${group_id}/roles/permissions`, {
		credentials: 'include',
	});
}

export async function fetchChannelOverrides(group_id: id, channel_id: id): Promise<PermissionOverride[]> {
	const raw = await msgFetch<{ target: OverrideTarget; allow: number; deny: number }[]>(
		`${API_URL}/group/${group_id}/channels/${channel_id}/overrides`,
		{ credentials: 'include' }
	);
	return raw;
}
