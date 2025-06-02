export type Server = {
	id: string;
	icon: string | null;
	name: string;
	members: User[];
};

export enum State {
	Online = 'Online',
	Offline = 'Offline',
	Dnd = 'Dnd',
}
export type User = {
	id: string;
	name: string;
	username: string;
	avatar?: string;
	state: State;
	is_friend?: boolean;
};

export enum MessageType {
	Direct = 'direct',
	Group = 'group',
	Server = 'server',
	Info = 'info',
}

export type MessageData = {
	text?: string;
	images?: string[];
	videos?: string[];
	files?: File[];
};

export type Message = {
	id?: string;
	from: string;
	to?: string;
	data: any;
	time: Date;
	type: MessageType;
	notSent?: boolean;
};

export type Messages = {
	messages: Message[];
	user: User;
};

export interface AppState {
	user: User;
}

type File = {
	url: string;
	name: string;
	size: string;
};
