export type id = number;
export type snowflake_id = bigint;

export type Server = {
	id: id;
	position: id;
	owner?: id;
	name: string;
	icon?: string;
	description?: string;
	members?: Map<id, Member>;
	channels?: Map<id, Channel>;
	roles?: Map<id, Role>;
	everyone?: number;
	permissions?: Permissions;
};

export type Channel = {
	id: id;
	name: string;
	title: string | null;
	position: number;
	type: ChannelType;
	messages?: Message[];
	users?: Set<User>;
	watch_party?: WatchParty;
	permissions?: Permissions;
	permission_overrides?: PermissionOverride[];
};

export type OverrideTarget = { role: id } | { user: id };

export type PermissionOverride = {
	target: OverrideTarget;
	allow: number;
	deny: number;
};

export interface Watch {
	video: id;
	offset: number;
	playing: boolean;
}

export interface WatchParty extends Watch {
	host: id;
	users: id[];
	title?: string;
	duration?: number;
	thumbnail?: string;
}

export enum ChannelType {
	Text = 'text',
	Voice = 'voice',
}

export type Member = {
	user: User;
	roles: Role[];
};

export type Role = {
	id: id;
	name: string;
	position: number;
	color: string;
	permissions?: number;
};

export type Subscribed = {
	id: id;
	owner?: id;
	name: string;
	icon?: string;
	members: Record<id, { id: id; name?: string; roles: id[] }>;
	channels: Record<
		id,
		{
			id: id;
			name: string;
			title: string | null;
			position: number;
			type: ChannelType;
			users?: id[];
			watch_party?: WatchParty;
		}
	>;
	roles: Record<id, Role>;
};

export enum Permissions {
	// ─── Core / Admin ───
	ADMINISTRATOR = 1 << 0,
	VIEW_AUDIT_LOG = 1 << 1,
	MANAGE_GROUP = 1 << 2,
	MANAGE_ROLES = 1 << 3,
	MANAGE_CHANNELS = 1 << 4,
	KICK_MEMBERS = 1 << 5,
	BAN_MEMBERS = 1 << 6,
	CREATE_INVITE = 1 << 7,
	DELETE_INVITE = 1 << 8,

	// ─── Text ───
	VIEW_CHANNEL = 1 << 9,
	VIEW_MESSAGES = 1 << 10,
	SEND_MESSAGE = 1 << 11,
	MANAGE_MESSAGES = 1 << 13,
	EMBED_LINKS = 1 << 14,
	ATTACH_FILES = 1 << 15,
	READ_MESSAGE_HISTORY = 1 << 16,
	MENTION_EVERYONE = 1 << 17,

	// ─── Voice ───
	CONNECT = 1 << 18,
	SPEAK = 1 << 19,
	MUTE_MEMBERS = 1 << 20,
	DEAFEN_MEMBERS = 1 << 21,
	MOVE_MEMBERS = 1 << 22,
}

export enum Status {
	Online = 'Online',
	Idle = 'Idle',
	Dnd = 'Dnd',
	Offline = 'Offline',
}

export type User = {
	id: id;
	name: string;
	username: string;
	avatar?: string;
	banner?: string;
	status: Status;
	friends?: id[];
	groups?: id[];
	activities?: Partial<Activity>;
};

export type Music = {
	title: string;
	artist: string;
	album: string;
	album_url: string;
	length: number;
	offset: number;
	paused: boolean;
};

export type Game = {
	app_id: number;
	start_time: number;
	name: string;
	header_image: string;
	short_description: string;
	background: string;
};

export type Activity = {
	game: { type: 'game'; payload: Game };
	music: { type: 'music'; payload: Music };
	watching: {
		type: 'watching';
		payload: Watch;
	};
	streaming: {
		type: 'streaming';
		payload: {
			group_id: id;
			channel_id: id;
			time: number;
		};
	};
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

export type MultiData = {
	text?: string;
	images?: string[];
	videos?: string[];
	files?: File[];
};

export type EncryptedData = {
	nonce: Uint8Array;
	cipher: Uint8Array;
};

export type CallData = {
	end_time: number | null;
};

export type ReplyData = {
	replied: snowflake_id;
	data: MultiData;
};

export type MessageData = string | EncryptedData | MultiData | CallData | ReplyData | Event | Ack;

export interface Message<T = MessageData> {
	id: snowflake_id;
	from: id;
	to: id;
	data: T;
	type: MessageType;
	group_id?: id;
	overwrited?: boolean;
	reacted?: boolean;
}

export type Reaction = {
	user_id: id;
	reaction: string;
};

export type MessageBlock = {
	messages: Message[];
	user: User;
};

export type File = {
	url: string;
	name: string;
	size: string;
};

export type MusicEvent =
	| { music: 'playing'; payload: Music }
	| { music: 'seek'; payload: number }
	| { music: 'paused' }
	| { music: 'stopped' };

export type GameEvent = { game: 'playing'; payload: Game } | { game: 'stopped' };

export type Event =
	/* ===== USER ===== */
	| { event: EventType.UpdateUser; payload: { name?: string; avatar?: string; banner?: string } }
	| { event: EventType.ChangeStatus; payload: Status }

	/* ===== FRIEND ===== */
	| { event: EventType.FriendRequest }
	| { event: EventType.FriendAccept }
	| { event: EventType.FriendRemove }

	/* ===== GROUP ===== */
	| { event: EventType.CreateGroup; payload: { name: string; icon?: string; description?: string } }
	| {
			event: EventType.UpdateGroup;
			payload: {
				name?: string;
				description?: string;
				icon?: string;
			};
	  }
	| { event: EventType.DeleteGroup }
	| { event: EventType.Subscribe }
	| { event: EventType.Unsubscribe }
	| { event: EventType.MoveGroup; payload: { position: number } }

	/* ===== ROLE ===== */
	| {
			event: EventType.CreateRole;
			payload: {
				name: string;
				color: string;
				permissions: number;
			};
	  }
	| {
			event: EventType.UpdateRole;
			payload: {
				role: id;
				name?: string;
				position?: number;
				color?: string;
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

	/* ===== CHANNEL ===== */
	| {
			event: EventType.CreateChannel;
			payload: { name: string; is_voice: boolean; title?: string };
	  }
	| {
			event: EventType.UpdateChannel;
			payload: { name?: string; title?: string; position?: number };
	  }
	| { event: EventType.DeleteChannel }
	| {
			event: EventType.SetPermissionOverride;
			payload: { target: OverrideTarget; allow: number; deny: number };
	  }
	| {
			event: EventType.DeletePermissionOverride;
			payload: { target: OverrideTarget };
	  }

	/* ===== VOICE ===== */
	| { event: EventType.JoinVoice; payload: { mute: boolean; deafen: boolean } }
	| { event: EventType.ExitVoice }
	| { event: EventType.MoveToVoice; payload: id }
	| { event: EventType.Mute; payload: boolean }
	| { event: EventType.Deafen; payload: boolean }

	/* ===== MODERATION ===== */
	| { event: EventType.KickUser }
	| { event: EventType.BanUser }
	| { event: EventType.LeaveGroup }

	/* ==== webRTC ==== */
	| { event: EventType.Offer; payload: string }
	| { event: EventType.Answer; payload: string }
	| { event: EventType.IceCandidate; payload: RTCIceCandidateInit }

	/* ==== WATCH PARTY ==== */
	| { event: EventType.JoinParty }
	| { event: EventType.LeaveParty }
	| {
			event: EventType.Watch;
			payload: { video: id; title: string; duration: number; thumbnail: string };
	  }
	| { event: EventType.JumpTo; payload: { offset: number; play: boolean } }
	| {
			event: EventType.Music;
			payload: MusicEvent;
	  }
	| { event: EventType.Game; payload: GameEvent }
	| {
			event: EventType.Streaming;
			payload: { group_id: id; channel_id: id; time: number };
	  }

	/* ===== MESSAGE ===== */
	| { event: EventType.Reaction; payload: { message: snowflake_id; reaction: string } }
	| { event: EventType.RemoveReaction; payload: { message: snowflake_id; reaction: string } };

export enum EventType {
	/* ===== USER ===== */
	UpdateUser = 'update_user',

	/* ===== PRESENCE ===== */
	ChangeStatus = 'change_status',

	/* ===== FRIEND ===== */
	FriendRequest = 'friend_request',
	FriendAccept = 'friend_accept',
	FriendRemove = 'friend_remove',

	/* ===== Group ===== */
	CreateGroup = 'create_group',
	UpdateGroup = 'update_group',
	DeleteGroup = 'delete_group',
	Subscribe = 'subscribe',
	Unsubscribe = 'unsubscribe',
	MoveGroup = 'move_group',

	/* ===== ROLE ===== */
	CreateRole = 'create_role',
	UpdateRole = 'update_role',
	DeleteRole = 'delete_role',
	AssignRole = 'assign_role',
	RemoveRole = 'remove_role',

	/* ===== CHANNEL ===== */
	CreateChannel = 'create_channel',
	UpdateChannel = 'update_channel',
	DeleteChannel = 'delete_channel',
	SetPermissionOverride = 'set_permission_override',
	DeletePermissionOverride = 'delete_permission_override',

	/* ===== VOICE ===== */
	JoinVoice = 'join_voice',
	ExitVoice = 'exit_voice',
	MoveToVoice = 'move_to_voice',
	Mute = 'mute',
	Deafen = 'deafen',

	/* ===== MODERATION ===== */
	KickUser = 'kick_user',
	BanUser = 'ban_user',
	LeaveGroup = 'leave_group',

	/* ==== webRTC ==== */
	Offer = 'offer',
	Answer = 'answer',
	IceCandidate = 'ice_candidate',

	/* ==== WATCH PARTY ==== */
	JoinParty = 'join_party',
	LeaveParty = 'leave_party',
	Watch = 'watch',
	JumpTo = 'jump_to',

	// ==== ACTIVITY ==== */
	Music = 'music',
	Game = 'game',
	Streaming = 'streaming',

	/* ===== MESSAGE ===== */
	Reaction = 'reaction',
	RemoveReaction = 'remove_reaction',
}

export type Ack =
	| { ack: AckType.None; payload: undefined }
	| { ack: AckType.Error; payload: string }

	// MESSAGE
	| { ack: AckType.Received; payload: snowflake_id }
	| { ack: AckType.Deleted; payload: snowflake_id }
	| { ack: AckType.Overwritten; payload: Message }
	| { ack: AckType.Reacted; payload: { message: snowflake_id; reaction: string } }
	| { ack: AckType.RemovedReaction; payload: { message: snowflake_id; reaction: string } }

	/* ===== USER ===== */
	| { ack: AckType.Initialized; payload: Me }
	| { ack: AckType.ChangedStatus; payload: Status }
	| { ack: AckType.AssignedRole; payload: { role_id: id } }
	| { ack: AckType.RemovedRole; payload: { role_id: id } }
	| { ack: AckType.AddedFriend; payload: undefined }
	| { ack: AckType.ReceivedFriendRequest; payload: undefined }
	| { ack: AckType.SentFriendRequest; payload: undefined }
	| { ack: AckType.DeletedFriend; payload: undefined }
	| {
			ack: AckType.UpdatedUser;
			payload: {
				name?: string;
				avatar?: string;
				banner?: string;
			};
	  }

	/* ===== SERVER ===== */
	| {
			ack: AckType.Subscribed;
			payload: {
				group: Subscribed;
				permissions: number;
				channel_permissions: Record<id, number>;
				voice_states: Record<id, { mute: boolean; deafen: boolean }>;
			};
	  }
	| { ack: AckType.Unsubscribed; payload: undefined }
	| { ack: AckType.PermissionsChanged; payload: number }
	| { ack: AckType.ChannelPermissionsChanged; payload: number }
	| { ack: AckType.JoinedMember; payload: undefined }
	| { ack: AckType.LeftMember; payload: undefined }
	| { ack: AckType.MovedGroup; payload: { position: number } }
	| { ack: AckType.MessageError; payload: string }
	| {
			ack: AckType.CreatedGroup;
			payload: {
				name: string;
				icon?: string;
				description?: string;
			};
	  }
	| {
			ack: AckType.CreatedChannel;
			payload: {
				name: string;
				position: number;
				is_voice: boolean;
				title?: string;
			};
	  }
	| {
			ack: AckType.CreatedRole;
			payload: {
				name: string;
				color: string;
			};
	  }
	| {
			ack: AckType.UpdatedGroup;
			payload: {
				name?: string;
				description?: string;
				icon?: string;
			};
	  }
	| {
			ack: AckType.UpdatedChannel;
			payload: {
				name?: string;
				title: string | null;
				position?: number;
			};
	  }
	| {
			ack: AckType.UpdatedRole;
			payload: {
				name?: string;
				color?: string;
				position?: number;
				permissions?: number;
			};
	  }
	| { ack: AckType.DeletedGroup; payload: undefined }
	| { ack: AckType.DeletedChannel; payload: undefined }
	| { ack: AckType.DeletedRole; payload: undefined }
	| {
			ack: AckType.SetPermissionOverride;
			payload: { target: OverrideTarget; allow: number; deny: number };
	  }
	| {
			ack: AckType.DeletedPermissionOverride;
			payload: { target: OverrideTarget };
	  }

	/* ===== VOICE ===== */
	| { ack: AckType.JoinedVoice; payload: { channel_id: id; mute: boolean; deafen: boolean } }
	| { ack: AckType.ExitedVoice; payload: id }
	| { ack: AckType.MovedToVoice; payload: id }
	| { ack: AckType.Muted; payload: boolean }
	| { ack: AckType.Deafened; payload: boolean }

	/* ===== WATCH PARTY ===== */
	| { ack: AckType.JoinedParty; payload: id }
	| { ack: AckType.LeftParty; payload: id }
	| {
			ack: AckType.Watching;
			payload: { video: id; title: string; duration: number; thumbnail: string };
	  }
	| { ack: AckType.JumpedTo; payload: { offset: number; play: boolean } }
	// ===== ACTIVITY ===== */
	| { ack: AckType.MusicActivity; payload: MusicEvent }
	| { ack: AckType.GameActivity; payload: GameEvent };

export enum AckType {
	None = 'none',
	Error = 'error',
	MessageError = 'message_error',
	// MESSAGE
	Received = 'received',
	Deleted = 'deleted',
	Overwritten = 'overwritten',
	Reacted = 'reacted',
	RemovedReaction = 'removed_reaction',
	// USER
	Initialized = 'initialized',
	ChangedStatus = 'changed_status',
	AssignedRole = 'assigned_role',
	RemovedRole = 'removed_role',
	AddedFriend = 'added_friend',
	ReceivedFriendRequest = 'received_friend_request',
	SentFriendRequest = 'sent_friend_request',
	DeletedFriend = 'deleted_friend',
	UpdatedUser = 'updated_user',
	// GROUP
	Subscribed = 'subscribed',
	Unsubscribed = 'unsubscribed',
	PermissionsChanged = 'permissions_changed',
	ChannelPermissionsChanged = 'channel_permissions_changed',
	JoinedMember = 'joined_member',
	LeftMember = 'left_member',
	MovedGroup = 'moved_group',
	CreatedGroup = 'created_group',
	CreatedChannel = 'created_channel',
	CreatedRole = 'created_role',
	UpdatedGroup = 'updated_group',
	UpdatedChannel = 'updated_channel',
	UpdatedRole = 'updated_role',
	DeletedGroup = 'deleted_group',
	DeletedChannel = 'deleted_channel',
	DeletedRole = 'deleted_role',
	SetPermissionOverride = 'set_permission_override',
	DeletedPermissionOverride = 'deleted_permission_override',
	// VOICE
	JoinedVoice = 'joined_voice',
	ExitedVoice = 'exited_voice',
	MovedToVoice = 'moved_to_voice',
	Muted = 'muted',
	Deafened = 'deafened',
	// WATCH PARTY
	JoinedParty = 'joined_party',
	LeftParty = 'left_party',
	Watching = 'watching',
	JumpedTo = 'jumped_to',
	MusicActivity = 'music_activity',
	GameActivity = 'game_activity',
}
