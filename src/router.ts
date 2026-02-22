import { createRouter, createWebHistory } from 'vue-router';

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
					{ path: 'friends', name: 'friends', component: Friends, meta: { transition: 'fade' } },
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

import { useMeStore } from '@/stores/me';

router.beforeEach((to) => {
	const meStore = useMeStore();

	if (meStore.me == undefined) return;

	if (to.meta?.requiresAuth && !meStore.me) {
		return { name: 'login' };
	}

	if (to.meta?.guestOnly && meStore.me) {
		return { name: 'chats' };
	}
});

export default router;
