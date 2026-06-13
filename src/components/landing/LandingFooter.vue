<script setup lang="ts">
	import { RELEASES_URL, REPO } from '@/composables/useReleases';
	const year = new Date().getFullYear();
</script>

<template>
	<footer class="footer">
		<div class="inner">
			<div class="brand">
				<img src="/crow.png" alt="ThisCrow" />
				<span>ThisCrow</span>
			</div>
			<div class="cols">
				<a :href="RELEASES_URL" target="_blank">Download</a>
				<a :href="`https://github.com/${REPO}`" target="_blank">GitHub</a>
				<a :href="`https://github.com/${REPO}/releases`" target="_blank">Releases</a>
			</div>
			<span class="copy">© {{ year }} ThisCrow</span>
		</div>
	</footer>
</template>

<style scoped>
	.footer {
		border-top: 1px solid hsla(0, 0%, 100%, 0.07);
		background: hsla(216, 7%, 6%, 0.6);
		margin-top: 60px;
	}
	.inner {
		max-width: 1100px;
		margin: 0 auto;
		padding: 40px 24px;
		display: flex;
		align-items: center;
		gap: 24px;
		flex-wrap: wrap;
	}
	.brand {
		display: flex;
		align-items: center;
		gap: 10px;
		font-weight: 800;
		color: var(--text);
	}
	.brand img {
		width: 30px;
		height: 30px;
		filter: brightness(0) invert(1);
	}
	.cols {
		display: flex;
		gap: 26px;
		margin: 0 auto;
	}
	.cols a {
		color: var(--text-secondary);
		font-weight: 600;
		font-size: 0.95rem;
	}
	.cols a:hover {
		color: var(--text);
	}
	.copy {
		color: var(--text-subtle);
		font-size: 0.9rem;
	}
	@media (max-width: 600px) {
		.inner {
			justify-content: center;
			text-align: center;
		}
		.cols {
			margin: 0;
		}
	}
</style>
