<template>
	<div class="container">
		<aside></aside>
		<main></main>
	</div>
</template>

<style scoped>
	.container {
		display: grid;
		grid-template-columns: clamp(200px, 20%, 300px) 1fr;
		height: 100vh;
	}

	aside {
		background-color: #202225;
		border: 1px solid #303030;
		border-top-left-radius: 20px;
	}

	main {
		background-color: #36393f;
	}
</style>
