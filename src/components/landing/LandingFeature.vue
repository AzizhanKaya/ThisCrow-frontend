<script setup lang="ts">
	defineProps<{
		eyebrow: string;
		title: string;
		text: string;
		reverse?: boolean;
		accent?: string;
	}>();
</script>

<template>
	<section class="feature" :class="{ reverse }">
		<div class="copy">
			<span class="eyebrow" :style="accent ? { color: accent } : {}">{{ eyebrow }}</span>
			<h2>{{ title }}</h2>
			<p>{{ text }}</p>
		</div>
		<div class="visual" :style="accent ? { '--glow': accent } : {}">
			<div class="visual-frame">
				<slot />
			</div>
		</div>
	</section>
</template>

<style scoped>
	.feature {
		max-width: 1100px;
		margin: 0 auto;
		padding: 70px 24px;
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 56px;
		align-items: center;
	}
	.feature.reverse .copy {
		order: 2;
	}
	.eyebrow {
		display: inline-block;
		font-size: 0.85rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 1.5px;
		color: var(--color-lighter);
		margin-bottom: 14px;
	}
	.copy h2 {
		font-size: clamp(1.8rem, 3.5vw, 2.8rem);
		font-weight: 900;
		color: var(--text);
		line-height: 1.05;
		margin-bottom: 18px;
	}
	.copy p {
		font-size: 1.1rem;
		line-height: 1.65;
		color: var(--text-secondary);
		max-width: 460px;
	}
	.visual {
		--glow: var(--color);
	}
	.visual-frame {
		border-radius: 16px;
		overflow: hidden;
		background: var(--bg-darker);
		border: 1px solid hsla(0, 0%, 100%, 0.07);
		box-shadow: 0 30px 70px hsla(0, 0%, 0%, 0.5), 0 0 60px -20px var(--glow);
		aspect-ratio: 16 / 11;
	}

	@media (max-width: 850px) {
		.feature {
			grid-template-columns: 1fr;
			gap: 32px;
			text-align: center;
		}
		.feature.reverse .copy {
			order: 0;
		}
		.copy p {
			margin: 0 auto;
		}
	}
</style>
