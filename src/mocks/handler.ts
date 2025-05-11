import { http, HttpResponse, delay } from 'msw';
import { type Server, type User, State } from '../types';

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
		avatar: 'https://media-ist1-2.cdn.whatsapp.net/v/t61.24694-24/420628060_1555782538592106_5499609317137260408_n.jpg?ccb=11-4&oh=01_Q5Aa1gGb_NgypHqpxS9_0zHW2Tuenux8zIA7gvozmKF8hqvA9g&oe=682D95B5&_nc_sid=5e03e0&_nc_cat=110',
		state: State.Online,
	},
	{
		id: '2',
		name: 'zafer',
		username: 'zaferbaba',
		avatar: 'https://media-ist1-2.cdn.whatsapp.net/v/t61.24694-24/368327216_1274662853212234_3850909043399615141_n.jpg?ccb=11-4&oh=01_Q5Aa1gHruSPU-nQSXexjVOYtvKtw4Xeo21SQb-zt5PUflsovFg&oe=682D965B&_nc_sid=5e03e0&_nc_cat=103',
		state: State.Dnd,
	},
	{
		id: '3',
		name: 'alp',
		username: 'alpx',
		avatar: 'https://media-ist1-2.cdn.whatsapp.net/v/t61.24694-24/471439687_1257728858792209_4336393364134940508_n.jpg?ccb=11-4&oh=01_Q5Aa1gHrdeLdwJgkCLGjivoqeQmOfJxQkLEogrQ-hBJfo7xlQg&oe=682D843B&_nc_sid=5e03e0&_nc_cat=104',
		state: State.Offline,
	},
];

export const handlers = [
	http.get('/api/server_list', async () => {
		await delay(100);

		return HttpResponse.json(mockServers);
	}),

	http.get('/api/friends', async () => {
		await delay(100);

		return HttpResponse.json(friends);
	}),
];
