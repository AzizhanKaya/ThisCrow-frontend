import type { id } from '@/types';
import { defineStore } from 'pinia';

export interface ErrorToast {
	id: number;
	message: string;
}

const DEFAULT_DURATION = 5000;

export const useErrorStore = defineStore('error', {
	state: () => ({
		nextId: 0 as id,
		errors: [] as ErrorToast[],
		timers: new Map<number, ReturnType<typeof setTimeout>>(),
	}),

	actions: {
		push(message: string, duration: number = DEFAULT_DURATION): number {
			const id = this.nextId++;
			this.errors.push({ id, message });

			const timer = setTimeout(() => this.dismiss(id), duration);
			this.timers.set(id, timer);

			return id;
		},

		pushFrom(err: unknown, fallback: string = 'An error occurred'): number {
			const message = err instanceof Error ? err.message : typeof err === 'string' ? err : (err as any)?.message || fallback;
			return this.push(message);
		},

		dismiss(id: number) {
			const timer = this.timers.get(id);
			if (timer) {
				clearTimeout(timer);
				this.timers.delete(id);
			}
			const idx = this.errors.findIndex((e) => e.id === id);
			if (idx !== -1) this.errors.splice(idx, 1);
		},

		clear() {
			for (const timer of this.timers.values()) clearTimeout(timer);
			this.timers.clear();
			this.errors = [];
		},
	},
});
