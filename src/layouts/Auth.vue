<template>
	<div class="container">
		<div class="card">
			<h2>ThisCrow</h2>
			<div class="buttons">
				<router-link to="/login">Login</router-link>
				<router-link to="/register">Register</router-link>
			</div>
			<router-view v-slot="{ Component }">
				<transition name="fade" mode="out-in">
					<component :is="Component" />
				</transition>
			</router-view>
		</div>
	</div>
</template>

<style scoped>
	h2 {
		padding-bottom: 20px;
		color: #e9e9e9;
	}
	.container {
		height: 100vh;
		display: flex;
		justify-content: center;
		align-items: center;
		color: white;
	}

	.card {
		background: #111114;
		padding: 2rem;
		border-radius: 8px;
		width: 400px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
		text-align: center;
	}

	.buttons {
		display: flex;
		justify-content: center;
		margin-bottom: 1rem;
	}

	.buttons a {
		flex: 1;
		margin: 6px 8px;
		padding: 8px 5px;
		border: none;
		background: #161616;
		cursor: pointer;
		font-weight: 600;
		border-radius: 4px;
		transition: background-color 0.3s;
		color: white;
		font-size: 1rem;
		text-decoration: none;
	}

	.buttons a.router-link-exact-active {
		background: #6427d6;
	}

	.buttons a:hover:not(.router-link-exact-active) {
		background: var(--bg-dark);
	}

	.fade-enter-active,
	.fade-leave-active {
		transition: opacity 0.3s ease;
	}
	.fade-enter-from,
	.fade-leave-to {
		opacity: 0;
	}
</style>
