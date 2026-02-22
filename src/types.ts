export type id = bigint;

export type Server = {
	id: id;
	icon?: string;
	name: string;
	members?: User[];
	channels?: Channel[];
	roles?: Role[];
	version: id;
};

export type Channel = {
	id: id;
	name: string;
	type: ChannelType;
};

export enum ChannelType {
	Chat = 'chat',
	Voice = 'voice',
}

export type Member = {
	user: User;
	roles: Role[];
};

export type Role = {
	id: id;
	name: string;
	color: string;
};

export enum Status {
	Online = 'Online',
	Idle = 'Idle',
	Dnd = 'Dnd',
	Offline = 'Offline',
}

export type User = {
	id: id;
	version: id;
	name: string;
	username: string;
	avatar?: string;
	status: Status;
	friends?: id[];
	groups?: id[];
};

export interface Me extends User {
	friends: id[];
	friend_requests: id[];
	friend_requests_sent: id[];
	groups: id[];
	dms: id[];
}

export enum MessageType {
	Direct = 'direct',
	Group = 'group',
	Server = 'server',
	Info = 'info',
	InfoGroup = 'info_group',
}

export type MessageData = {
	text?: string;
	images?: string[];
	videos?: string[];
	files?: File[];
};

export interface Message<T = any> {
	id: id;
	from: id;
	to: id;
	data: T;
	time: Date;
	type: MessageType;
	group_id?: id;
	sent?: boolean;
}

export type MessageBlock = {
	messages: Message[];
	user: User;
};

type File = {
	url: string;
	name: string;
	size: string;
};

export type Event =
	/* ===== PRESENCE ===== */
	| { event: EventType.ChangeStatus; payload: Status }

	/* ===== FRIEND ===== */
	| { event: EventType.FriendRequest }
	| { event: EventType.FriendAccept }
	| { event: EventType.FriendRemove }

	/* ===== GUILD ===== */
	| {
			event: EventType.UpdateGuild;
			payload: {
				name?: string;
				icon?: string;
			};
	  }

	/* ===== ROLE ===== */
	| {
			event: EventType.CreateRole;
			payload: {
				name: string;
				permissions: number;
			};
	  }
	| {
			event: EventType.UpdateRole;
			payload: {
				role: id;
				name?: string;
				permissions?: number;
			};
	  }
	| {
			event: EventType.DeleteRole;
			payload: { role: id };
	  }
	| {
			event: EventType.AssignRole;
			payload: { user: id; role: id };
	  }
	| {
			event: EventType.RemoveRole;
			payload: { user: id; role: id };
	  }
	| {
			event: EventType.ChangeRolePermissions;
			payload: { role: id; permissions: number };
	  }

	/* ===== CHANNEL ===== */
	| {
			event: EventType.CreateChannel;
			payload: { name: string; type: ChannelType };
	  }
	| {
			event: EventType.UpdateChannel;
			payload: { name?: string; type?: ChannelType };
	  }
	| { event: EventType.DeleteChannel }

	/* ===== VOICE ===== */
	| { event: EventType.JoinChannel }
	| { event: EventType.ExitChannel }
	| { event: EventType.MoveVoice; payload: { to: id } }

	/* ===== MODERATION ===== */
	| { event: EventType.KickUser }
	| { type: EventType.BanUser };

export enum EventType {
	/* ===== USER ===== */

	/* ===== PRESENCE ===== */
	ChangeStatus = 'change_status',

	/* ===== FRIEND ===== */
	FriendRequest = 'friend_request',
	FriendAccept = 'friend_accept',
	FriendRemove = 'friend_remove',

	/* ===== GUILD ===== */
	UpdateGuild = 'update_guild',

	/* ===== ROLE ===== */
	CreateRole = 'create_role',
	UpdateRole = 'update_role',
	DeleteRole = 'delete_role',
	AssignRole = 'assign_role',
	RemoveRole = 'remove_role',
	ChangeRolePermissions = 'change_role_permissions',

	/* ===== CHANNEL ===== */
	CreateChannel = 'create_channel',
	UpdateChannel = 'update_channel',
	DeleteChannel = 'delete_channel',

	/* ===== VOICE ===== */
	JoinChannel = 'join_channel',
	ExitChannel = 'exit_channel',
	MoveVoice = 'move_voice',

	/* ===== MODERATION ===== */
	KickUser = 'kick_user',
	BanUser = 'ban_user',
}

export type Ack =
	| { ack: AckType.None; payload: undefined }
	| { ack: AckType.Error; payload: string }
	| { ack: AckType.Received; payload: id }

	/* ===== USER ===== */
	| { ack: AckType.Initialized; payload: Me }
	| { ack: AckType.ChangedStatus; payload: Status }
	| { ack: AckType.AddedFriend; payload: id }
	| { ack: AckType.ReceivedFriendRequest; payload: id }
	| { ack: AckType.SentFriendRequest; payload: id }
	| { ack: AckType.DeletedFriend; payload: id }
	| {
			ack: AckType.UpdatedUser;
			payload: {
				name?: string;
				avatar?: string;
			};
	  }

	/* ===== GROUP / GUILD ===== */
	| { ack: AckType.Subscribed; payload: Server }
	| { ack: AckType.Unsubscribed; payload: id }
	| { ack: AckType.AddedMember; payload: id }
	| { ack: AckType.RemovedMember; payload: id }
	| {
			ack: AckType.CreatedGroup;
			payload: {
				id: id;
				name: string;
				icon?: string;
			};
	  }
	| {
			ack: AckType.CreatedChannel;
			payload: {
				id: id;
				name: string;
				type: ChannelType;
			};
	  }
	| {
			ack: AckType.CreatedRole;
			payload: {
				id: id;
				name: string;
				permissions: number;
				color: string;
			};
	  }
	| { ack: AckType.AssignedRole; payload: id }
	| {
			ack: AckType.UpdatedGroup;
			payload: {
				id: id;
				name?: string;
				icon?: string;
			};
	  }
	| {
			ack: AckType.UpdatedChannel;
			payload: {
				id: id;
				name?: string;
			};
	  }
	| {
			ack: AckType.UpdatedRole;
			payload: {
				id: id;
				name?: string;
				permissions?: number;
				color?: string;
			};
	  }
	| { ack: AckType.DeletedGroup; payload: id }
	| { ack: AckType.DeletedChannel; payload: id }
	| { ack: AckType.DeletedRole; payload: id };

export enum AckType {
	None = 'none',
	Error = 'error',
	// MESSAGE
	Received = 'received',
	// USER
	Initialized = 'initialized',
	ChangedStatus = 'changed_status',
	UpdatedUser = 'updated_user',
	// FRIEND
	AddedFriend = 'added_friend',
	ReceivedFriendRequest = 'received_friend_request',
	SentFriendRequest = 'sent_friend_request',
	DeletedFriend = 'deleted_friend',
	// GROUP
	Subscribed = 'subscribed',
	Unsubscribed = 'unsubscribed',
	AddedMember = 'added_member',
	RemovedMember = 'removed_member',
	CreatedGroup = 'created_group',
	CreatedChannel = 'created_channel',
	CreatedRole = 'created_role',
	AssignedRole = 'assigned_role',
	UpdatedGroup = 'updated_group',
	UpdatedChannel = 'updated_channel',
	UpdatedRole = 'updated_role',
	DeletedGroup = 'deleted_group',
	DeletedChannel = 'deleted_channel',
	DeletedRole = 'deleted_role',
}
