export type Server = {
	id: string;
	icon?: string;
	name: string;
};

export type Channel = {
	id: string;
	name: string;
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
};

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

export type Message = {
	id?: string;
	from: string;
	to: string;
	data: any;
	time: Date;
	type: MessageType;
	sent?: boolean;
};

export type MessageBlock = {
	messages: Message[];
	user: User;
};

type File = {
	url: string;
	name: string;
	size: string;
};

import canonicalize from 'canonical-json';
import { v5 as uuidv5 } from 'uuid';

const NAMESPACE_MESSAGE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
export function computeId(message: Message): string {
	const canonicalObj = {
		from: message.from,
		to: message.to,
		data: message.data,
		time: message.time.toISOString(),
		type: message.type,
	};

	const jsonStr = canonicalize(canonicalObj);

	return uuidv5(jsonStr, NAMESPACE_MESSAGE);
}
