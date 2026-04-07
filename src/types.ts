export type id = number;
export type snowflake_id = bigint;

export type Server = {
	id: id;
	version: id;
	position: id;
	owner?: id;
	name: string;
	icon?: string;
	description?: string;
	members?: Map<id, Member>;
	channels?: Map<id, Channel>;
	roles?: Map<id, Role>;
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
};

export interface Watch {
	video: id;
	title: string;
	offset: number;
	playing: boolean;
}

export interface WatchParty extends Watch {
	host: id;
	users: id[];
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
	permissions: number;
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
	SEND_TTS_MESSAGES = 1 << 12,
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
	version: id;
	name: string;
	username: string;
	avatar?: string;
	status: Status;
	friends?: id[];
	groups?: id[];
	activity?: Activity;
	watch?: Watch;
};

export type Activity =
	| {
			kind: 'Game';
			name: string;
			time: Date;
	  }
	| {
			kind: 'Music';
			title: string;
			artist: string;
			album: string;
			album_url: string;
			length: number;
			offset: number;
	  }
	| {
			kind: 'Watching';
			video: id;
			offset: number;
	  }
	| {
			kind: 'Streaming';
			group_id: id;
			channel_id: id;
			time: Date;
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

export type MessageData = string | EncryptedData | MultiData | Event | Ack;

export interface Message<T = MessageData> {
	id: snowflake_id;
	from: id;
	to: id;
	data: T;
	type: MessageType;
	group_id?: id;
	overwrited?: null;
}

export type MessageBlock = {
	messages: Message[];
	user: User;
};

export type File = {
	url: string;
	name: string;
	size: string;
};

export type Event =
	/* ===== USER ===== */
	| { event: EventType.UpdateUser; payload: { name?: string; avatar?: string } }
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

	/* ===== VOICE ===== */
	| { event: EventType.JoinVoice }
	| { event: EventType.ExitVoice }
	| { event: EventType.MoveToVoice; payload: id }

	/* ===== MODERATION ===== */
	| { event: EventType.KickUser }
	| { event: EventType.BanUser }

	/* ==== webRTC ==== */
	| { event: EventType.Offer; payload: string }
	| { event: EventType.Answer; payload: string }
	| { event: EventType.IceCandidate; payload: RTCIceCandidateInit }

	/* ==== WATCH PARTY ==== */
	| { event: EventType.JoinParty }
	| { event: EventType.LeaveParty }
	| { event: EventType.Watch; payload: id }
	| { event: EventType.UnWatch }
	| { event: EventType.JumpTo; payload: { offset: number; play: boolean } };

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

	/* ===== VOICE ===== */
	JoinVoice = 'join_voice',
	ExitVoice = 'exit_voice',
	MoveToVoice = 'move_to_voice',

	/* ===== MODERATION ===== */
	KickUser = 'kick_user',
	BanUser = 'ban_user',

	/* ==== webRTC ==== */
	Offer = 'offer',
	Answer = 'answer',
	IceCandidate = 'ice_candidate',

	/* ==== WATCH PARTY ==== */
	JoinParty = 'join_party',
	LeaveParty = 'leave_party',
	Watch = 'watch',
	UnWatch = 'unwatch',
	JumpTo = 'jump_to',
}

export type Ack =
	| { ack: AckType.None; payload: undefined }
	| { ack: AckType.Error; payload: string }

	// MESSAGE
	| { ack: AckType.Received; payload: snowflake_id }
	| { ack: AckType.Deleted; payload: snowflake_id }
	| { ack: AckType.Overwritten; payload: Message }

	/* ===== USER ===== */
	| { ack: AckType.Initialized; payload: Me }
	| { ack: AckType.ChangedStatus; payload: Status }
	| { ack: AckType.CreatedRole; payload: { name: string; permissions: number; color: string } }
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
			};
	  }

	/* ===== GROUP / GUILD ===== */
	| { ack: AckType.Subscribed; payload: any }
	| { ack: AckType.Unsubscribed; payload: undefined }
	| { ack: AckType.AddedMember; payload: undefined }
	| { ack: AckType.RemovedMember; payload: undefined }
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
				permissions: number;
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
				permissions?: number;
				color?: string;
			};
	  }
	| { ack: AckType.DeletedGroup; payload: undefined }
	| { ack: AckType.DeletedChannel; payload: undefined }
	| { ack: AckType.DeletedRole; payload: undefined }

	/* ===== VOICE ===== */
	| { ack: AckType.JoinedVoice; payload: id }
	| { ack: AckType.ExitedVoice; payload: id }
	| { ack: AckType.MovedToVoice; payload: id }

	/* ===== WATCH PARTY ===== */
	| { ack: AckType.CreatedParty; payload: id }
	| { ack: AckType.JoinedParty; payload: id }
	| { ack: AckType.LeftParty; payload: id }
	| { ack: AckType.Watching; payload: id }
	| { ack: AckType.UnWatched; payload: undefined }
	| { ack: AckType.JumpedTo; payload: { offset: number; play: boolean } };

export enum AckType {
	None = 'none',
	Error = 'error',
	// MESSAGE
	Received = 'received',
	Deleted = 'deleted',
	Overwritten = 'overwritten',
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
	AddedMember = 'added_member',
	RemovedMember = 'removed_member',
	CreatedGroup = 'created_group',
	CreatedChannel = 'created_channel',
	CreatedRole = 'created_role',
	UpdatedGroup = 'updated_group',
	UpdatedChannel = 'updated_channel',
	UpdatedRole = 'updated_role',
	DeletedGroup = 'deleted_group',
	DeletedChannel = 'deleted_channel',
	DeletedRole = 'deleted_role',
	// VOICE
	JoinedVoice = 'joined_voice',
	ExitedVoice = 'exited_voice',
	MovedToVoice = 'moved_to_voice',
	// WATCH PARTY
	CreatedParty = 'created_party',
	JoinedParty = 'joined_party',
	LeftParty = 'left_party',
	Watching = 'watching',
	UnWatched = 'unwatched',
	JumpedTo = 'jumped_to',
}
