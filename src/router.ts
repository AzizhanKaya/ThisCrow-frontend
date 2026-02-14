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
					{ path: 'user/:username', name: 'user', component: Chat },
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

router.beforeEach((to) => {
	const userStore = useUserStore();

	if (userStore.user == undefined) return;

	const isLoggedIn = userStore.isLoggedIn;

	if (to.meta?.requiresAuth && !isLoggedIn) {
		return { name: 'login' };
	}

	if (to.meta?.guestOnly && isLoggedIn) {
		return { name: 'chats' };
	}
});

export default router;
