import type { Server, User, id, Activity, Status, Me } from '@/types';
import { API_URL } from '@/constants';
import { encode, msgFetch } from '@/utils/msgpack';

export interface UsersInfo {
	id: id;
	version: id;
	username: string;
	name: string;
	avatar?: string;
	status: Status;
	activities: Array<Activity[keyof Activity]>;
}

export interface UserInfo extends UsersInfo {
	friends: id[];
	groups: id[];
}

export function formatUser(rawUser: UserInfo | UsersInfo): User {
	const user = { ...rawUser } as unknown as User;
	user.activities = {};
	for (const activity of rawUser.activities) {
		// @ts-expect-error Typescript can't infer this dynamic assignment
		user.activities[activity.type as keyof Activity] = activity;
	}
	return user;
}

export async function fetchServers(server_ids: id[]): Promise<Server[]> {
	return msgFetch<Server[]>(`${API_URL}/info/groups`, {
		method: 'POST',
		credentials: 'include',
		body: encode(server_ids),
	});
}

export async function fetchUser(id: id): Promise<User> {
	const url = API_URL + `/info/user/${id}`;

	const rawUser = await msgFetch<UserInfo>(url, { credentials: 'include' });
	return formatUser(rawUser);
}

export async function fetchUsers(ids: id[]): Promise<User[]> {
	const url = API_URL + `/info/users`;

	const rawUsers = await msgFetch<UsersInfo[]>(url, {
		method: 'POST',
		credentials: 'include',
		body: encode(ids),
	});
	return rawUsers.map(formatUser);
}

export async function searchUser(username: string): Promise<User[]> {
	const params = new URLSearchParams();
	params.append('username', username);

	const rawUsers = await msgFetch<UsersInfo[]>(API_URL + `/info/search_user?${params.toString()}`, {
		credentials: 'include',
	});
	return rawUsers.map(formatUser);
}

export async function fetchPublicKey(id: id): Promise<Uint8Array> {
	const url = API_URL + `/info/public_key/${id}`;

	return msgFetch<Uint8Array>(url, { credentials: 'include' });
}
