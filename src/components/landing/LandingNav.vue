<script setup lang="ts">
	import { ref, onMounted, onUnmounted } from 'vue';
	import { useRouter } from 'vue-router';
	import { useMeStore } from '@/stores/me';

	const router = useRouter();
	const meStore = useMeStore();
	const scrolled = ref(false);

	const onScroll = () => {
		const el = document.querySelector('.landing') as HTMLElement | null;
		scrolled.value = (el?.scrollTop ?? 0) > 20;
	};

	onMounted(() => {
		document.querySelector('.landing')?.addEventListener('scroll', onScroll);
	});
	onUnmounted(() => {
		document.querySelector('.landing')?.removeEventListener('scroll', onScroll);
	});

	const goApp = () => {
		router.push(meStore.me ? { name: 'chats' } : { name: 'login' });
	};

	const scrollTo = (id: string) => {
		document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
	};
</script>

<template>
	<header class="nav" :class="{ scrolled }">
		<div class="nav-inner">
			<a class="brand" @click="scrollTo('top')">
				<img src="/crow.png" alt="ThisCrow" />
				<span>ThisCrow</span>
			</a>

			<nav class="links">
				<a @click="scrollTo('download')">Download</a>
				<a @click="scrollTo('features')">Features</a>
			</nav>

			<button class="open-app" @click="goApp">{{ meStore.me ? 'Open ThisCrow' : 'Log In' }}</button>
		</div>
	</header>
</template>

<style scoped>
	.nav {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		z-index: 50;
		transition:
			background-color 0.25s ease,
			box-shadow 0.25s ease,
			backdrop-filter 0.25s ease;
	}
	.nav.scrolled {
		background: hsla(216, 7%, 7%, 0.7);
		backdrop-filter: blur(12px);
		box-shadow: 0 1px 0 hsla(0, 0%, 100%, 0.06);
	}
	.nav-inner {
		max-width: 1200px;
		margin: 0 auto;
		padding: 16px 24px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 24px;
	}
	.brand {
		display: flex;
		align-items: center;
		gap: 10px;
		cursor: pointer;
		font-weight: 800;
		font-size: 1.25rem;
		letter-spacing: 0.2px;
		color: var(--text);
	}
	.brand img {
		width: 34px;
		height: 34px;
		filter: brightness(0) invert(1);
	}
	.links {
		display: flex;
		gap: 28px;
		margin-left: auto;
	}
	.links a {
		color: var(--text-secondary);
		font-weight: 600;
		font-size: 0.95rem;
		cursor: pointer;
		transition: color 0.15s ease;
	}
	.links a:hover {
		color: var(--text);
	}
	.open-app {
		background: var(--text);
		color: var(--bg-darkest);
		border: none;
		border-radius: 999px;
		padding: 9px 20px;
		font-weight: 700;
		font-size: 0.9rem;
		cursor: pointer;
		transition:
			transform 0.12s ease,
			background-color 0.15s ease;
	}
	.open-app:hover {
		transform: translateY(-1px);
		background: hsl(0, 0%, 100%);
	}

	@media (max-width: 640px) {
		.links {
			display: none;
		}
		.nav-inner {
			padding: 14px 18px;
		}
	}
</style>
