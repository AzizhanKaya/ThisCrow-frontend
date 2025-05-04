export type Server = {
	id: string;
	icon: string | null;
	name: string;
	members: User[];
};

enum State {
	Online,
	Offline,
	Dnd,
}

export type User = {
	id: string;
	username: string;
	avatar?: string | null;
	state: State;
};
