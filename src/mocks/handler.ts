import { http, HttpResponse, delay } from 'msw';
import { type Server, type User, type Message, State, MessageType } from '../types';
import { v4 } from 'uuid';

const mockServers: Server[] = [
	{
		id: '1',
		name: 'İÜC siber',
		icon: 'https://cdn.discordapp.com/icons/763121486642282536/09fc21b51dc6ffe94a04747e65cc54f1.webp?size=80&quality=lossless',
		members: [],
	},
	{
		id: '2',
		name: 'Vate',
		icon: 'https://cdn.discordapp.com/icons/1279035839153700864/60ab96e09a253f50586d3342cfe402f1.webp?size=80&quality=lossless',
		members: [],
	},
	{
		id: '3',
		name: 'Bronz Tayfa',
		icon: 'https://cdn.discordapp.com/icons/1151081123535933440/3ebf45cebac90ab1ade2c866be57c8d7.webp?size=80&quality=lossless',
		members: [],
	},
];

const friends: User[] = [
	{
		id: '1',
		name: 'aziz',
		username: '333',
		avatar: 'http://localhost:8000/1.jpg',
		state: State.Online,
	},
	{
		id: '2',
		name: 'zafer',
		username: 'zaferbaba',
		avatar: 'http://localhost:8000/2.jpg',
		state: State.Dnd,
	},
	{
		id: '3',
		name: 'alp',
		username: 'alpx',
		avatar: 'http://localhost:8000/3.jpg',
		state: State.Offline,
	},
];

const messages: Message[] = [
	{
		id: v4(),
		from: friends[0].id,
		type: MessageType.Direct,
		data: {
			text: 'Selam',
		},
		time: new Date(),
	},
	{
		id: v4(),
		from: friends[1].id,
		type: MessageType.Direct,
		data: {
			text: 'Selam ya',
		},
		time: new Date(),
	},
	{
		id: v4(),
		from: friends[0].id,
		type: MessageType.Direct,
		data: {
			text: 'nbr',
		},
		time: new Date(),
	},
	{
		id: v4(),
		from: friends[1].id,
		type: MessageType.Direct,
		data: {
			text: 'iyi abi',
		},
		time: new Date(),
	},
	{
		id: v4(),
		from: friends[1].id,
		type: MessageType.Direct,
		data: {
			text: 'senden naber',
		},
		time: new Date(),
	},
];

const Oldmessages: Message[] = [
	{
		id: v4(),
		from: friends[1].id,
		type: MessageType.Direct,
		data: {
			text: 'Eskiden',
		},
		time: new Date(),
	},
	{
		id: v4(),
		from: friends[0].id,
		type: MessageType.Direct,
		data: {
			text: 'gelen mesajlar',
		},
		time: new Date(),
	},
	{
		id: v4(),
		from: friends[0].id,
		type: MessageType.Direct,
		data: {
			text: 'bunlar',
		},
		time: new Date(),
	},
	{
		id: v4(),
		from: friends[1].id,
		type: MessageType.Direct,
		data: {
			text: 'Eskiden',
		},
		time: new Date(),
	},
	{
		id: v4(),
		from: friends[0].id,
		type: MessageType.Direct,
		data: {
			text: 'gelen mesajlar',
		},
		time: new Date(),
	},
	{
		id: v4(),
		from: friends[0].id,
		type: MessageType.Direct,
		data: {
			text: 'bunlar',
		},
		time: new Date(),
	},
];

export const handlers = [
	http.get('/state/server_list', async () => {
		await delay(100);

		return HttpResponse.json(mockServers);
	}),

	http.get('/state/friends', async () => {
		await delay(100);

		return HttpResponse.json(friends);
	}),

	http.get('/messages/:to', async (req) => {
		const to = req.params.to;

		await delay(100);

		return HttpResponse.json(messages);
	}),

	http.get('/messages/:to/old', async (req) => {
		const to = req.params.to;

		await delay(100);

		return HttpResponse.json(Oldmessages);
	}),
];
