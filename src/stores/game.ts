import { defineStore } from 'pinia';

export interface SteamGame {
	name: string;
	header_image: string;
	short_description: string;
	background: string;
}

export const useGameStore = defineStore('game', {
	state: () => ({
		games: new Map<number, SteamGame>(),
		loading: new Set<number>(),
	}),
	actions: {
		async getGameInfo(appId: number): Promise<SteamGame | null> {
			if (this.games.has(appId)) return this.games.get(appId)!;
			if (this.loading.has(appId)) return null;

			console.log('1');

			this.loading.add(appId);
			try {
				console.log('2');
				console.log(appId);
				const response = await fetch(`https://store.steampowered.com/api/appdetails?appids=${appId}`);
				const data = await response.json();

				console.log(data);
				if (data[appId] && data[appId].success) {
					const gameData = data[appId].data;
					const steamGame: SteamGame = {
						name: gameData.name,
						header_image: gameData.header_image,
						short_description: gameData.short_description,
						background: gameData.background,
					};
					this.games.set(appId, steamGame);
					return steamGame;
				}
			} catch (e) {
				console.error('Failed to fetch steam game info:', e);
			} finally {
				this.loading.delete(appId);
			}
			return null;
		},
	},
});
