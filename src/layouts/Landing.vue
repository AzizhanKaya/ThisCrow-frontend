<script setup lang="ts">
	import StarryNightBackground from '@/components/StarryNightBackground.vue';
	import LandingNav from '@/components/landing/LandingNav.vue';
	import LandingHero from '@/components/landing/LandingHero.vue';
	import LandingDownloads from '@/components/landing/LandingDownloads.vue';
	import LandingFeature from '@/components/landing/LandingFeature.vue';
	import LandingFooter from '@/components/landing/LandingFooter.vue';
	import WatchPartyMock from '@/components/landing/mocks/WatchPartyMock.vue';
	import ActivityMock from '@/components/landing/mocks/ActivityMock.vue';
	import EncryptionMock from '@/components/landing/mocks/EncryptionMock.vue';

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
					title="Watch together, in perfect sync"
					text="Start a watch party and experience video side-by-side with your friends. Playback stays in sync for everyone in the room automatically."
					accent="hsl(0, 77%, 59%)"
				>
					<WatchPartyMock />
				</LandingFeature>

				<LandingFeature
					eyebrow="Live Activity"
					title="See what everyone's up to"
					text="Your crew's activity shows up live what they're playing, what they're listening to, and how long they've been at it. Everything updates in real time."
					reverse
					accent="hsl(236, 72%, 49%)"
				>
					<ActivityMock />
				</LandingFeature>

				<LandingFeature
					eyebrow="End-to-End Encryption"
					title="Your messages, only your eyes"
					text="Every message is encrypted before it leaves your device and only decrypted on the recipient's. Not even ThisCrow can read what you send your privacy is non-negotiable."
					accent="hsl(145, 60%, 45%)"
				>
					<EncryptionMock />
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
		padding: 0;
		scrollbar-width: none;
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
		transition:
			transform 0.12s ease,
			background-color 0.15s ease;
	}
	.closing .cta:hover {
		transform: translateY(-2px);
		background: var(--color-light);
	}
</style>
