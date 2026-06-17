<script setup lang="ts">
	import { computed } from 'vue';
	import { useRouter } from 'vue-router';
	import { Icon } from '@iconify/vue';
	import { useMeStore } from '@/stores/me';
	import { useReleases, detectOS, RELEASES_URL } from '@/composables/useReleases';
	import ChatMock from './mocks/ChatMock.vue';

	const router = useRouter();
	const meStore = useMeStore();
	const { downloads } = useReleases();

	const os = detectOS();
	const primary = computed(() => downloads.value[os]);

	const download = () => {
		window.open(primary.value.url ?? RELEASES_URL, '_blank');
	};

	const openApp = () => {
		router.push(meStore.me ? { name: 'chats' } : { name: 'login' });
	};
</script>

<template>
	<section class="hero">
		<div class="hero-copy">
			<h1>HANG OUT,<br />PLAY &amp; <span>VIBE</span></h1>
			<p>
				ThisCrow is the place to talk, watch together, share what you're playing and listen to music with your crew — all in one cozy,
				lightning-fast app.
			</p>
			<div class="cta">
				<button class="btn btn-primary" @click="download">
					<Icon :icon="primary.icon" />
					<span>Download for {{ primary.label }}</span>
				</button>
				<button class="btn btn-ghost" @click="openApp">
					<Icon icon="mdi:open-in-app" />
					<span>Open in your browser</span>
				</button>
			</div>
		</div>

		<div class="hero-visual">
			<div class="window">
				<div class="title-bar">
					<i class="tdot r"></i><i class="tdot y"></i><i class="tdot g"></i>
					<span class="tb-title">ThisCrow</span>
				</div>
				<div class="window-body">
					<ChatMock />
				</div>
			</div>
		</div>
	</section>
</template>

<style scoped>
	.hero {
		max-width: 1400px;
		margin: 0 auto;
		padding: 140px 48px 80px;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 56px;
	}
	.hero-copy {
		flex: 1;
		min-width: 0;
		max-width: 550px;
	}
	.hero-copy h1 {
		font-size: clamp(2.6rem, 5vw, 4.5rem);
		line-height: 0.95;
		font-weight: 900;
		letter-spacing: -1px;
		color: var(--text);
		margin-bottom: 24px;
	}
	.hero-copy h1 span {
		background: linear-gradient(90deg, var(--color-light), var(--color-lightest));
		-webkit-background-clip: text;
		background-clip: text;
		-webkit-text-fill-color: transparent;
	}
	.hero-copy p {
		font-size: 1.15rem;
		line-height: 1.6;
		color: var(--text-secondary);
		max-width: 520px;
		margin-bottom: 32px;
	}
	.cta {
		display: flex;
		gap: 14px;
		flex-wrap: wrap;
	}
	.btn {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		border: none;
		border-radius: 999px;
		padding: 15px 26px;
		font-weight: 700;
		font-size: 1rem;
		cursor: pointer;
		transition:
			transform 0.12s ease,
			box-shadow 0.2s ease,
			background-color 0.2s ease;
	}
	.btn :deep(svg) {
		font-size: 1.3em;
	}
	.btn-primary {
		background: var(--text);
		color: var(--bg-darkest);
		box-shadow: 0 8px 30px hsla(0, 0%, 0%, 0.35);
	}
	.btn-primary:hover {
		transform: translateY(-2px);
	}
	.btn-ghost {
		background: hsla(0, 0%, 100%, 0.08);
		color: var(--text);
	}
	.btn-ghost:hover {
		background: hsla(0, 0%, 100%, 0.14);
		transform: translateY(-2px);
	}

	.hero-visual {
		perspective: 1600px;
		flex: 1.5;
		min-width: 0;
		display: flex;
		justify-content: flex-end;
	}
	.window {
		border-radius: 12px;
		overflow: hidden;
		box-shadow:
			0 40px 90px hsla(261, 68%, 8%, 0.7),
			0 0 0 1px hsla(0, 0%, 100%, 0.06);
		transform: rotateY(-10deg) rotateX(5deg);
		transform-style: preserve-3d;
		transition: transform 0.5s ease;

		width: 100%;
		max-width: 780px;
		aspect-ratio: 760 / 420;
		display: flex;
		flex-direction: column;
		background: var(--bg-dark);
	}
	.window:hover {
		transform: rotateY(0deg) rotateX(0deg);
	}
	.title-bar {
		height: 30px;
		background: var(--bg-dark);
		display: flex;
		align-items: center;
		gap: 7px;
		padding: 0 14px;
		flex-shrink: 0;
	}
	.tdot {
		width: 11px;
		height: 11px;
		border-radius: 50%;
	}
	.tdot.r {
		background: #ff5f57;
	}
	.tdot.y {
		background: #febc2e;
	}
	.tdot.g {
		background: #28c840;
	}
	.tb-title {
		margin: 0 auto;
		font-size: 14px;
		font-weight: 600;
	}
	.window-body {
		flex: 1;
		min-height: 0;
	}

	@media (max-width: 1200px) {
		.hero {
			flex-direction: column;
			padding-top: 110px;
			text-align: center;
		}
		.hero-copy p {
			margin-left: auto;
			margin-right: auto;
		}
		.cta {
			justify-content: center;
		}
		.window {
			transform: none;
		}
		.window:hover {
			transform: none;
		}
	}

	@media (max-width: 800px) {
		.window {
			zoom: 0.9;
		}
	}
	@media (max-width: 700px) {
		.window {
			zoom: 0.8;
		}
	}
	@media (max-width: 600px) {
		.window {
			zoom: 0.7;
		}
	}
	@media (max-width: 500px) {
		.window {
			zoom: 0.58;
		}
	}
	@media (max-width: 400px) {
		.window {
			zoom: 0.46;
		}
	}
	@media (max-width: 350px) {
		.window {
			zoom: 0.38;
		}
	}
</style>
