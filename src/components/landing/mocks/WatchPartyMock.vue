<script setup lang="ts">
	const viewers = [
		{ av: 'A', color: 'hsl(261, 68%, 58%)' },
		{ av: 'M', color: 'hsl(145, 65%, 48%)' },
		{ av: 'K', color: 'hsl(28, 90%, 56%)' },
		{ av: 'D', color: 'hsl(330, 75%, 60%)' },
	];
</script>

<template>
	<div class="wp">
		<div class="screen">
			<div class="netflix">N</div>
			<div class="play"><div class="tri"></div></div>
			<div class="live">
				<i class="rec"></i>WATCH PARTY
			</div>
			<div class="viewers">
				<div v-for="(v, i) in viewers" :key="i" class="vb" :style="{ background: v.color, zIndex: 10 - i }">{{ v.av }}</div>
				<span class="count">+2 watching</span>
			</div>
			<div class="scrub">
				<div class="bar"><div class="fill"></div><i class="knob"></i></div>
				<div class="time"><span>48:12</span><span>1:52:30</span></div>
			</div>
		</div>
		<div class="side">
			<div class="s-title">In sync 🍿</div>
			<div class="bubble me">geçti mi o sahne?</div>
			<div class="bubble">hayır birlikteyiz 😄</div>
			<div class="bubble">duraklatıyorum</div>
		</div>
	</div>
</template>

<style scoped>
	.wp {
		display: grid;
		grid-template-columns: 1fr 130px;
		height: 100%;
		background: var(--bg-dark);
	}
	.screen {
		position: relative;
		background: radial-gradient(120% 120% at 50% 0%, hsl(216, 30%, 16%), #000);
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.netflix {
		position: absolute;
		top: 14px;
		left: 16px;
		color: #e50914;
		font-weight: 900;
		font-size: 26px;
		font-family: Arial, sans-serif;
	}
	.play {
		width: 64px;
		height: 64px;
		border-radius: 50%;
		background: hsla(0, 0%, 100%, 0.15);
		backdrop-filter: blur(4px);
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.tri {
		width: 0;
		height: 0;
		border-left: 20px solid #fff;
		border-top: 12px solid transparent;
		border-bottom: 12px solid transparent;
		margin-left: 5px;
	}
	.live {
		position: absolute;
		top: 14px;
		right: 16px;
		display: flex;
		align-items: center;
		gap: 6px;
		background: hsla(0, 0%, 0%, 0.5);
		color: #fff;
		font-size: 10px;
		font-weight: 800;
		letter-spacing: 0.5px;
		padding: 5px 9px;
		border-radius: 999px;
	}
	.rec {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: #f04747;
		animation: pulse 1.4s infinite;
	}
	@keyframes pulse {
		50% {
			opacity: 0.3;
		}
	}
	.viewers {
		position: absolute;
		bottom: 46px;
		left: 16px;
		display: flex;
		align-items: center;
	}
	.vb {
		width: 26px;
		height: 26px;
		border-radius: 50%;
		border: 2px solid var(--bg-dark);
		margin-left: -8px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #fff;
		font-size: 11px;
		font-weight: 700;
	}
	.vb:first-child {
		margin-left: 0;
	}
	.count {
		margin-left: 8px;
		font-size: 11px;
		color: var(--text-secondary);
	}
	.scrub {
		position: absolute;
		bottom: 12px;
		left: 16px;
		right: 16px;
	}
	.bar {
		position: relative;
		height: 4px;
		background: hsla(0, 0%, 100%, 0.2);
		border-radius: 4px;
	}
	.fill {
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		width: 43%;
		background: var(--color-light);
		border-radius: 4px;
	}
	.knob {
		position: absolute;
		left: 43%;
		top: 50%;
		width: 11px;
		height: 11px;
		background: #fff;
		border-radius: 50%;
		transform: translate(-50%, -50%);
	}
	.time {
		display: flex;
		justify-content: space-between;
		font-size: 10px;
		color: var(--text-subtle);
		margin-top: 5px;
	}
	.side {
		background: var(--bg-darker);
		padding: 12px 10px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.s-title {
		font-size: 12px;
		font-weight: 700;
		color: var(--text);
		margin-bottom: 4px;
	}
	.bubble {
		background: var(--bg-light);
		color: var(--text-secondary);
		font-size: 11px;
		padding: 7px 9px;
		border-radius: 10px 10px 10px 3px;
		max-width: 95%;
	}
	.bubble.me {
		align-self: flex-end;
		background: var(--color);
		color: #fff;
		border-radius: 10px 10px 3px 10px;
	}
</style>
