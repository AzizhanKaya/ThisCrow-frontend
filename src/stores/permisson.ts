import { defineStore } from 'pinia';
import type { id } from '@/types';

type Permission = {};

export const usePermissionStore = defineStore('permission', {
	state: () => ({
		permissions: new Map<id, Permission>(),
	}),

	actions: {},
});
