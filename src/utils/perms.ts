import { toValue, type MaybeRefOrGetter } from 'vue';
import { Permissions, type Channel, type Server } from '@/types';

const PERM_MAP = {
	administrator: Permissions.ADMINISTRATOR,
	viewAuditLog: Permissions.VIEW_AUDIT_LOG,
	manageGroup: Permissions.MANAGE_GROUP,
	manageRoles: Permissions.MANAGE_ROLES,
	manageChannels: Permissions.MANAGE_CHANNELS,
	kickMembers: Permissions.KICK_MEMBERS,
	banMembers: Permissions.BAN_MEMBERS,
	createInvite: Permissions.CREATE_INVITE,
	deleteInvite: Permissions.DELETE_INVITE,
	viewChannel: Permissions.VIEW_CHANNEL,
	viewMessages: Permissions.VIEW_MESSAGES,
	sendMessage: Permissions.SEND_MESSAGE,
	manageMessages: Permissions.MANAGE_MESSAGES,
	embedLinks: Permissions.EMBED_LINKS,
	attachFiles: Permissions.ATTACH_FILES,
	readMessageHistory: Permissions.READ_MESSAGE_HISTORY,
	mentionEveryone: Permissions.MENTION_EVERYONE,
	connect: Permissions.CONNECT,
	speak: Permissions.SPEAK,
	muteMembers: Permissions.MUTE_MEMBERS,
	deafenMembers: Permissions.DEAFEN_MEMBERS,
	moveMembers: Permissions.MOVE_MEMBERS,
} as const;

type PermKey = keyof typeof PERM_MAP;
export type PermBag = { readonly [K in PermKey]: boolean };

export function can(
	server: MaybeRefOrGetter<Server | undefined | null>,
	channel?: MaybeRefOrGetter<Channel | undefined | null>
): PermBag {
	return new Proxy({} as PermBag, {
		get(_, key) {
			if (typeof key !== 'string') return false;
			const bit = PERM_MAP[key as PermKey];
			if (typeof bit !== 'number') return false;
			const c = toValue(channel);
			const s = toValue(server);
			const value = c?.permissions ?? s?.permissions ?? 0;
			return (value & bit) !== 0;
		},
	});
}
