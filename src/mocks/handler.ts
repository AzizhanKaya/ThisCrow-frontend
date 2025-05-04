import { http, HttpResponse, delay } from 'msw';
import type { Server } from '../types';

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

export const handlers = [
	http.get('/api/server_list', async () => {
		await delay(100);

		return HttpResponse.json(mockServers);
	}),
];
