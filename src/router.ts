import { createRouter, createWebHistory } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';

import Login from '@/views/Login.vue';
import Register from '@/views/Register.vue';
import Chats from '@/views/Chats.vue';
import Chat from '@/views/Chat.vue';
import Friends from '@/views/Friends.vue';
import GroupChat from '@/views/GroupChat.vue';

import AuthLayout from '@/layouts/Auth.vue';
import MainLayout from '@/layouts/Main.vue';

const routes = [
	{
		path: '/',
		component: MainLayout,
		meta: { requiresAuth: true, layout: 'main' },
		children: [
			{
				path: '',
				name: 'chats',
				component: Chats,
				children: [
					{ path: 'friends', name: 'friends', component: Friends },
					{ path: 'user/:userId', name: 'user', component: Chat },
				],
			},
			{ path: 'group/:groupId', name: 'group', component: GroupChat },
		],
	},
	{
		path: '/',
		component: AuthLayout,
		meta: { guestOnly: true, layout: 'auth' },
		children: [
			{ path: 'login', name: 'login', component: Login },
			{ path: 'register', name: 'register', component: Register },
		],
	},
];

const router = createRouter({
	history: createWebHistory(),
	routes,
});

import { useUserStore } from '@/stores/user';
import { initialized } from '@/init';

router.beforeEach((to) => {
	if (!initialized) return;

	const userStore = useUserStore();
	const isLoggedIn = userStore.isLoggedIn;

	if (to.meta?.requiresAuth && !isLoggedIn) {
		return { name: 'login' };
	}

	if (to.meta?.guestOnly && isLoggedIn) {
		return { name: 'chats' };
	}
});

export default router;
