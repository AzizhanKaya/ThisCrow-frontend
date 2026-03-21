import { defineStore } from 'pinia';
import { websocketService } from '@/services/websocket';
import { initApp } from '@/init';
import { getMe } from '@/api/state';
import { useMeStore } from './me';

export const useAppStore = defineStore('app', {
	state: () => ({
		header: 'ThisCrow' as string,
		loading: true as boolean,
		onBeforeUnloadHandlers: new Set<() => Promise<void>>(),
	}),

	actions: {
		setupConnectionListener(router: any) {
			websocketService.onConnectionStateChange(async (state) => {
				if (state === 'CLOSED') {
					this.loading = true;
				} else if (state === 'CONNECTING') {
					this.loading = true;
					try {
						await initApp();
					} catch (error) {
						console.error('initApp hatası:', error);
						router.push({ name: 'login' });
						websocketService.disconnect();
						const meStore = useMeStore();
						await meStore.logOut();
					} finally {
						this.loading = false;
					}
				}
			});
		},

		async init(router: any) {
			this.setupConnectionListener(router);

			try {
				this.loading = true;
				await getMe();
				websocketService.connect();
			} catch (error) {
				router.push({ name: 'login' });
			}
		},

		onBeforeUnload(handler: () => Promise<void>) {
			this.onBeforeUnloadHandlers.add(handler);

			return () => {
				this.onBeforeUnloadHandlers.delete(handler);
			};
		},

		async handleBeforeUnload() {
			const tasks = Array.from(this.onBeforeUnloadHandlers).map((handler) => handler());
			await Promise.all(tasks);
			websocketService.disconnect();
		},
	},
});
