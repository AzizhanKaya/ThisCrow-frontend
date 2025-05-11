<script setup lang="ts">
	import { RouterView } from 'vue-router';
	import Chats from './views/Chats.vue';
	import ServerList from './views/ServersList.vue';
</script>

<template>
	<div class="app-container">
		<header class="header">This Crow</header>

		<div class="main">
			<aside class="server-side">
				<ServerList />
			</aside>
			<section class="chats">
				<Chats />
			</section>
		</div>
	</div>
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
</style>

<style scoped>
	.app-container {
		position: absolute;
		height: 100%;
		width: 100%;
		overflow: hidden;
		font-family: Arial, Helvetica, sans-serif;
	}

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
	}

	.server-side {
		padding-top: 10px;
	}

	.chats {
		border-top-left-radius: 15px;
		min-width: 500px;
	}
</style>
