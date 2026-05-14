import { Permissions, type Server, type id } from '@/types';

export function computeGroupPermissions(server: Server, user_id: id): number {
	if (server.owner === user_id) return -1 >>> 0;

	const member = server.members?.get(user_id);
	if (!member) return 0;

	let perms = server.everyone ?? 0;
	for (const role of member.roles) {
		perms |= role.permissions;
	}

	if (perms & Permissions.ADMINISTRATOR) return -1 >>> 0;

	return perms;
}

export function hasAny(perms: number, ...flags: number[]): boolean {
	return flags.some((f) => (perms & f) !== 0);
}
