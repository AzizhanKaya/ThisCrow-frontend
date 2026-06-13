<script setup lang="ts">
	import StarryNightBackground from '@/components/StarryNightBackground.vue';
	import LandingNav from '@/components/landing/LandingNav.vue';
	import LandingHero from '@/components/landing/LandingHero.vue';
	import LandingDownloads from '@/components/landing/LandingDownloads.vue';
	import LandingFeature from '@/components/landing/LandingFeature.vue';
	import LandingFooter from '@/components/landing/LandingFooter.vue';
	import WatchPartyMock from '@/components/landing/mocks/WatchPartyMock.vue';
	import GameMock from '@/components/landing/mocks/GameMock.vue';
	import MusicMock from '@/components/landing/mocks/MusicMock.vue';

	const scrollToDownload = () => {
		document.getElementById('download')?.scrollIntoView({ behavior: 'smooth' });
	};
</script>

<template>
	<div class="landing">
		<div class="bg-layer">
			<StarryNightBackground />
		</div>

		<div class="content">
			<LandingNav />
			<span id="top"></span>

			<LandingHero />

			<LandingDownloads />

			<div id="features">
				<LandingFeature
					eyebrow="Watch Party"
					title="Watch together, perfectly in sync"
					text="Start a watch party and stream movies, shows or clips with your friends. Playback stays in sync for everyone, with live reactions and chat right next to the screen."
					accent="hsl(0, 77%, 59%)"
				>
					<WatchPartyMock />
				</LandingFeature>

				<LandingFeature
					eyebrow="Game Activity"
					title="See what everyone's playing"
					text="Your crew's game activity shows up live — what they're playing, how long they've been at it, and a one-tap button to jump in and play together."
					reverse
					accent="hsl(28, 90%, 56%)"
				>
					<GameMock />
				</LandingFeature>

				<LandingFeature
					eyebrow="Music Activity"
					title="Listen along to the same beat"
					text="Share what's playing and vibe to the same track at the same time. Friends can listen along in sync, so the whole room moves to one rhythm."
					accent="hsl(261, 68%, 55%)"
				>
					<MusicMock />
				</LandingFeature>
			</div>

			<section class="closing">
				<h2>Your crew is waiting.</h2>
				<p>Download ThisCrow and bring everyone into one place.</p>
				<a class="cta" href="#download" @click.prevent="scrollToDownload">Get ThisCrow</a>
			</section>

			<LandingFooter />
		</div>
	</div>
</template>

<style scoped>
	.landing {
		position: absolute;
		inset: 0;
		height: 100%;
		width: 100%;
		overflow-y: auto;
		overflow-x: hidden;
		background: #000;
	}
	.bg-layer {
		position: fixed;
		inset: 0;
		z-index: 0;
		pointer-events: none;
	}
	.content {
		position: relative;
		z-index: 1;
	}
	.closing {
		max-width: 700px;
		margin: 40px auto 0;
		padding: 60px 24px;
		text-align: center;
	}
	.closing h2 {
		font-size: clamp(2rem, 4vw, 3rem);
		font-weight: 900;
		color: var(--text);
		margin-bottom: 12px;
	}
	.closing p {
		color: var(--text-secondary);
		font-size: 1.15rem;
		margin-bottom: 28px;
	}
	.closing .cta {
		display: inline-block;
		background: var(--color);
		color: #fff;
		font-weight: 800;
		font-size: 1.05rem;
		padding: 15px 40px;
		border-radius: 999px;
		transition: transform 0.12s ease, background-color 0.15s ease;
	}
	.closing .cta:hover {
		transform: translateY(-2px);
		background: var(--color-light);
	}
</style>
