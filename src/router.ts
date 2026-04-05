import { createRouter, createWebHistory } from 'vue-router';

import Login from '@/views/Login.vue';
import Register from '@/views/Register.vue';
import Chats from '@/views/Chats.vue';
import Chat from '@/views/Chat.vue';
import Friends from '@/views/Friends.vue';
import Server from '@/views/Server/Server.vue';

import AuthLayout from '@/layouts/Auth.vue';
import MainLayout from '@/layouts/Main.vue';

import { ModalView, useModalStore } from '@/stores/modal';

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
					{
						path: 'user/:userId',
						name: 'user',
						component: Chat,
						beforeEnter: async (to: any) => {
							const appStore = useAppStore();

							if (appStore.loading) {
								await new Promise<void>((resolve) => {
									const unwatch = watch(
										() => appStore.loading,
										(isLoading) => {
											if (!isLoading) {
												unwatch();
												resolve();
											}
										}
									);
								});
							}

							const dmStore = useDMStore();
							await dmStore.ensureUser(Number(to.params.userId));
						},
					},
				],
			},
			{
				path: 'server/:serverId/:channelId?',
				name: 'server',
				component: Server,
				beforeEnter: async (to: any) => {
					const appStore = useAppStore();

					if (appStore.loading) {
						await new Promise<void>((resolve) => {
							const unwatch = watch(
								() => appStore.loading,
								(isLoading) => {
									if (!isLoading) {
										unwatch();
										resolve();
									}
								}
							);
						});
					}

					const serverStore = useServerStore();
					const server = serverStore.getServerById(Number(to.params.serverId));

					if (!server) return { name: 'chats' };
				},
			},
			{
				path: 'invite/:code',
				name: 'invite',
				beforeEnter: (to: any) => {
					const modalStore = useModalStore();
					modalStore.openModal(ModalView.JOIN_INVITE, { code: to.params.code });
					return { name: 'chats' };
				},
				component: Chats,
			},
		],
	},
	{
		path: '/auth',
		component: AuthLayout,
		meta: { layout: 'auth' },
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
import { useServerStore } from './stores/server';
import { useAppStore } from './stores/app';
import { useDMStore } from './stores/dm';
import { watch } from 'vue';

router.beforeEach((to) => {
	const meStore = useMeStore();

	if (meStore.me == undefined) return;

	if (to.meta?.requiresAuth && !meStore.me) {
		return { name: 'login' };
	}
});

export default router;
