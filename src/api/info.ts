import type { Server, User, id, Activity, Status, Me, Role } from '@/types';
import { API_URL } from '@/constants';
import { encode, msgFetch } from '@/utils/msgpack';

export interface GroupDetail {
	id: id;
	name: string;
	icon?: string;
	description?: string;
	owner: id;
	member_count: number;
	online_count: number;
	text_channel_count: number;
	voice_channel_count: number;
	roles: Role[];
}

export async function fetchGroupDetail(group_id: id): Promise<GroupDetail> {
	return msgFetch<GroupDetail>(`${API_URL}/info/group/${group_id}`);
}

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
		body: encode(server_ids),
	});
}

export async function fetchUser(id: id): Promise<User> {
	const url = API_URL + `/info/user/${id}`;

	const rawUser = await msgFetch<UserInfo>(url);
	return formatUser(rawUser);
}

export async function fetchUsers(ids: id[]): Promise<User[]> {
	const url = API_URL + `/info/users`;

	const rawUsers = await msgFetch<UsersInfo[]>(url, {
		method: 'POST',
		body: encode(ids),
	});
	return rawUsers.map(formatUser);
}

export async function searchUser(username: string): Promise<User[]> {
	const params = new URLSearchParams();
	params.append('username', username);

	const rawUsers = await msgFetch<UsersInfo[]>(API_URL + `/info/search_user?${params.toString()}`);
	return rawUsers.map(formatUser);
}

export async function fetchPublicKey(id: id): Promise<Uint8Array> {
	const url = API_URL + `/info/public_key/${id}`;

	return msgFetch<Uint8Array>(url);
}
