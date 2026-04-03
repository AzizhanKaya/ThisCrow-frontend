import { defineStore } from 'pinia';
import { websocketService } from '@/services/websocket';
import { initApp } from '@/init';
import { getMe } from '@/api/state';
import { useMeStore } from './me';
import initWasm from '@/../pkg/wasm_lib';
import { isTauri } from '@tauri-apps/api/core';

export const useAppStore = defineStore('app', {
	state: () => ({
		header: 'ThisCrow' as string,
		loading: true as boolean,
		onBeforeUnloadHandlers: new Set<() => Promise<void>>(),
		onLoadHandlers: new Set<() => Promise<void>>(),
		isTauri: isTauri(),
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
						await this.handleLoad();
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
			await initWasm();
			this.setupConnectionListener(router);

			try {
				this.loading = true;
				await getMe();
				websocketService.connect();
			} catch (error) {
				router.push({ name: 'login' });
			}
		},

		onLoad(handler: () => Promise<void>) {
			this.onLoadHandlers.add(handler);

			return () => {
				this.onLoadHandlers.delete(handler);
			};
		},

		async handleLoad() {
			const tasks = Array.from(this.onLoadHandlers).map(async (handler) => {
				await handler();
			});
			await Promise.all(tasks);
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
