<script setup lang="ts">
	import StarryNightBackground from '../components/StarryNightBackground.vue';
</script>

<template>
	<div class="auth-layout">
		<StarryNightBackground />
		<div class="card">
			<h2>ThisCrow</h2>
			<div class="buttons">
				<router-link to="/auth/login">Login</router-link>
				<router-link to="/auth/register">Register</router-link>
			</div>
			<router-view v-slot="{ Component, route }">
				<Transition name="fade" mode="out-in">
					<component :is="Component" :key="route.path" />
				</Transition>
			</router-view>
		</div>
	</div>
</template>

<style scoped>
	.auth-layout {
		position: absolute;
		width: 100%;
		height: calc(100% - 30px);
		display: flex;
		justify-content: center;
		align-items: center;
		overflow: hidden;
	}
	h2 {
		padding-bottom: 24px;
		color: var(--text);
		font-weight: 700;
	}

	.card {
		background: var(--bg-dark);
		padding: 40px;
		border-radius: 8px;
		width: 440px;
		box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4);
		text-align: center;
		z-index: 1;
		max-height: 90%;
		overflow: auto;
	}

	.buttons {
		display: flex;
		justify-content: center;
		margin-bottom: 8px;
		background: var(--bg-darker);
		padding: 5px;
		border-radius: 6px;
		gap: 5px;
	}

	.buttons a {
		flex: 1;
		margin: 0;
		padding: 10px 5px;
		border: none;
		background: transparent;
		cursor: pointer;
		font-weight: 600;
		border-radius: 4px;
		transition:
			background-color 0.2s,
			color 0.2s;
		color: #b5bac1;
		font-size: 0.95rem;
		text-decoration: none;
	}

	.buttons a.router-link-exact-active {
		background: var(--color);
		color: var(--text);
	}

	.buttons a:hover:not(.router-link-exact-active) {
		background: rgba(255, 255, 255, 0.05);
		color: var(--text-muted);
	}

	.fade-enter-active,
	.fade-leave-active {
		transition:
			opacity 0.3s ease,
			transform 0.3s ease;
	}
	.fade-enter-from,
	.fade-leave-to {
		opacity: 0;
		transform: translateY(10px);
	}
</style>
