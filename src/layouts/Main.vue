<script setup lang="ts">
	import ServerList from '@/views/ServersList.vue';
</script>

<template>
	<div class="main-layout">
		<header class="header">ThisCrow</header>
		<div class="main">
			<aside class="server-side">
				<ServerList />
			</aside>
			<section class="chats">
				<router-view />
			</section>
		</div>
	</div>
</template>

<style scoped>
	.header {
		height: 2vh;
		width: max-content;
		color: white;
		margin: auto;
		font-family: 'Times New Roman', Times, serif;
	}

	.main {
		display: grid;
		grid-template-columns: 70px 1fr;
		height: 98vh;
		overflow: auto;
	}

	.server-side {
		padding-top: 5px;
	}

	.chats {
		border-top-left-radius: 15px;
		min-width: 500px;
	}
</style>
