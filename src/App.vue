<script setup lang="ts">
	import Chats from './views/Chats.vue';
	import ServerList from './views/ServersList.vue';
	import { websocketService } from './services/websocket';
	import { onMounted, onUnmounted, computed, watch, inject } from 'vue';
	import Login from './views/Login.vue';
	import { State, type AppState, type User } from './types';
	import { me } from './api/state';
	import UserCard from './components/UserCard.vue';

	const state = inject<AppState>('state')!;

	const isLoggedIn = computed(() => !!state.user);

	watch(
		isLoggedIn,
		(isLoggedIn) => {
			if (isLoggedIn) websocketService.connect();
		},
		{ once: true }
	);

	onMounted(() => {
		const init = async () => {
			if (!isLoggedIn.value) {
				try {
					const user = await me();
					user.state = State.Online;
					state.user = user;
				} catch (e) {
					console.warn(e);
				}
			}
		};
		init();
	});

	onUnmounted(() => {
		websocketService.disconnect();
	});

	function handleLogin(user: User) {
		user.state = State.Online;
		state.user = user;
	}
</script>

<template>
	<template v-if="isLoggedIn">
		<header class="header">This Crow</header>

		<div class="main">
			<aside class="server-side">
				<ServerList />
			</aside>
			<section class="chats">
				<Chats />
			</section>
		</div>

		<UserCard />
	</template>

	<template v-else>
		<Login @login="handleLogin" />
	</template>
</template>

<style>
	html,
	body {
		margin: 0;
		padding: 0;
		height: 100%;
		background-color: #202225;
	}

	* {
		margin: 0;
		padding: 0;
		box-sizing: border-box;
	}

	#app {
		position: absolute;
		height: 100%;
		width: 100%;
		overflow: hidden;
		font-family: Arial, Helvetica, sans-serif;
		color: white;
	}
</style>

<style scoped>
	.header {
		height: 2%;
		width: max-content;
		color: white;
		margin: auto;
		font-family: 'Times New Roman', Times, serif;
	}

	.main {
		display: grid;
		grid-template-columns: 100px 1fr;
		height: 98%;
		overflow: hidden;
	}

	.server-side {
		padding-top: 10px;
	}

	.chats {
		border-top-left-radius: 15px;
		min-width: 500px;
	}
</style>
