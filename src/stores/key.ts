import { defineStore } from 'pinia';
import type { id } from '@/types';
import { generate_keypair, generate_shared_secret } from '@/../pkg/wasm_lib';
import { fetchPublicKey } from '@/api/info';

export const useKeyStore = defineStore('keys', {
	state: () => ({
		public_key: new Uint8Array(32),
		private_key: new Uint8Array(32),
		public_keys: new Map<id, Uint8Array>(),
		private_keys: new Map<id, Uint8Array>(),
		pendingRequests: new Map<id, Promise<Uint8Array>>(),
	}),

	actions: {
		init(password: string) {
			const keypair = generate_keypair(password);
			this.public_key = new Uint8Array(keypair.public_key);
			this.private_key = new Uint8Array(keypair.private_key);
		},

		async get_public_key(id: id) {
			if (this.public_keys.has(id)) {
				return this.public_keys.get(id)!;
			}
			if (this.pendingRequests.has(id)) {
				return this.pendingRequests.get(id)!;
			}

			const requestPromise = fetchPublicKey(id)
				.then((key) => {
					this.public_keys.set(id, key);
					this.pendingRequests.delete(id);
					return key;
				})
				.catch((error) => {
					this.pendingRequests.delete(id);
					throw error;
				});

			this.pendingRequests.set(id, requestPromise);

			return requestPromise;
		},

		async init_private_key(id: id) {
			const key = generate_shared_secret(this.private_key, await this.get_public_key(id));
			this.private_keys.set(id, key);
			return key;
		},

		async get_private_key(id: id) {
			return this.private_keys.get(id) ?? (this.private_keys.set(id, await this.init_private_key(id)), this.private_keys.get(id)!);
		},
	},
});
