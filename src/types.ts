export type Server = {
	id: string;
	icon: string | null;
	name: string;
	members: User[];
};

export enum State {
	Online,
	Offline,
	Dnd,
}

export type User = {
	id: string;
	name: string;
	username: string;
	avatar?: string | null;
	state: State;
};
