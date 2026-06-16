<script setup lang="ts">
	import { Icon } from '@iconify/vue';
	import { useReleases, detectOS, RELEASES_URL, type OS } from '@/composables/useReleases';

	const { downloads, version, loading } = useReleases();
	const current = detectOS();
	const order: OS[] = ['windows', 'macos', 'linux'];
</script>

<template>
	<section id="download" class="downloads">
		<div class="head">
			<h2>Download ThisCrow</h2>
			<p>
				Available for every desktop. Grab the build for your platform — or
				<a :href="RELEASES_URL" target="_blank">see all releases</a>.
			</p>
		</div>

		<div class="cards">
			<a
				v-for="os in order"
				:key="os"
				class="card"
				:class="{ recommended: os === current }"
				:href="downloads[os].url ?? RELEASES_URL"
				target="_blank"
			>
				<Icon class="os-icon" :icon="downloads[os].icon" />
				<h3>{{ downloads[os].label }}</h3>
				<span class="meta">
					<template v-if="loading">Loading…</template>
					<template v-else-if="downloads[os].url">{{ version }}</template>
					<template v-else>View releases</template>
				</span>
				<span class="dl-btn">
					<Icon icon="mdi:download" />
					Download
				</span>
			</a>
		</div>
	</section>
</template>

<style scoped>
	.downloads {
		max-width: 1100px;
		margin: 0 auto;
		padding: 80px 24px;
	}
	.head {
		text-align: center;
		margin-bottom: 48px;
	}
	.head h2 {
		font-size: clamp(2rem, 4vw, 3rem);
		font-weight: 900;
		color: var(--text);
		margin-bottom: 12px;
	}
	.head p {
		color: var(--text-secondary);
		font-size: 1.1rem;
	}
	.head a {
		color: var(--color-lighter);
		font-weight: 600;
	}
	.cards {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 22px;
	}
	.card {
		position: relative;
		background: hsla(216, 7%, 14%, 0.7);
		border: 1px solid hsla(0, 0%, 100%, 0.07);
		border-radius: 16px;
		padding: 36px 24px 28px;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 10px;
		cursor: pointer;
		transition:
			transform 0.18s ease,
			border-color 0.18s ease,
			box-shadow 0.18s ease,
			background-color 0.18s ease;
	}
	.card:hover {
		transform: translateY(-6px);
		border-color: var(--color-light);
		background: hsla(216, 7%, 16%, 0.9);
		box-shadow: 0 20px 50px hsla(261, 68%, 6%, 0.6);
	}
	.card.recommended {
		border-color: var(--color);
		box-shadow:
			0 0 0 1px var(--color),
			0 20px 50px hsla(261, 68%, 6%, 0.5);
	}

	.os-icon {
		font-size: 56px;
		color: var(--text);
	}
	.card h3 {
		font-size: 1.4rem;
		font-weight: 800;
		color: var(--text);
	}
	.meta {
		color: var(--text-subtle);
		font-size: 0.9rem;
		min-height: 1.1em;
	}
	.dl-btn {
		margin-top: 12px;
		display: inline-flex;
		align-items: center;
		gap: 8px;
		background: var(--color);
		color: #fff;
		font-weight: 700;
		padding: 11px 24px;
		border-radius: 999px;
		font-size: 0.95rem;
		transition: background-color 0.15s ease;
	}
	.card:hover .dl-btn {
		background: var(--color-light);
	}

	@media (max-width: 800px) {
		.cards {
			grid-template-columns: 1fr;
			max-width: 420px;
			margin: 0 auto;
		}
	}
</style>
