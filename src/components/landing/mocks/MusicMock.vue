<script setup lang="ts">
	const listeners = [
		{ av: 'A', color: 'hsl(261, 68%, 58%)' },
		{ av: 'M', color: 'hsl(145, 65%, 48%)' },
		{ av: 'D', color: 'hsl(330, 75%, 60%)' },
	];
	const bars = Array.from({ length: 28 }, () => 20 + Math.random() * 80);
</script>

<template>
	<div class="music">
		<div class="now">
			<div class="cover">
				<div class="vinyl"></div>
				♪
			</div>
			<div class="track">
				<span class="listening"><i></i>Listening along</span>
				<span class="song">Midnight City</span>
				<span class="artist">M83 — Hurry Up, We're Dreaming</span>
				<div class="people">
					<div v-for="(l, i) in listeners" :key="i" class="lb" :style="{ background: l.color, zIndex: 5 - i }">{{ l.av }}</div>
					<span>+3 in sync</span>
				</div>
			</div>
		</div>

		<div class="wave">
			<i v-for="(h, i) in bars" :key="i" :style="{ height: h + '%', opacity: i / bars.length < 0.46 ? 1 : 0.3 }"></i>
		</div>

		<div class="controls">
			<span class="t">1:42</span>
			<div class="bar"><div class="fill"></div></div>
			<span class="t">4:03</span>
			<div class="btns">⏮ <span class="pp">⏸</span> ⏭</div>
		</div>
	</div>
</template>

<style scoped>
	.music {
		height: 100%;
		background: linear-gradient(160deg, hsl(261, 40%, 16%), var(--bg-dark) 60%);
		padding: 18px;
		display: flex;
		flex-direction: column;
		gap: 16px;
		text-align: left;
	}
	.now {
		display: flex;
		gap: 16px;
		align-items: center;
	}
	.cover {
		position: relative;
		width: 84px;
		height: 84px;
		border-radius: 12px;
		background: linear-gradient(135deg, var(--color-light), var(--color-darkest));
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 30px;
		color: #fff;
		flex-shrink: 0;
		box-shadow: 0 10px 30px hsla(261, 68%, 10%, 0.6);
	}
	.vinyl {
		position: absolute;
		right: -16px;
		width: 60px;
		height: 60px;
		border-radius: 50%;
		background: repeating-radial-gradient(circle, #1a1a1a 0 2px, #000 2px 4px);
		border: 1px solid #333;
		animation: spin 4s linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
	.track {
		display: flex;
		flex-direction: column;
		gap: 3px;
		min-width: 0;
	}
	.listening {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		font-size: 11px;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.6px;
		color: var(--color-lightest);
	}
	.listening i {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--color-lightest);
	}
	.song {
		font-size: 1.3rem;
		font-weight: 800;
		color: var(--text);
	}
	.artist {
		font-size: 0.85rem;
		color: var(--text-secondary);
	}
	.people {
		display: flex;
		align-items: center;
		margin-top: 6px;
		font-size: 11px;
		color: var(--text-subtle);
		gap: 8px;
	}
	.lb {
		width: 22px;
		height: 22px;
		border-radius: 50%;
		border: 2px solid var(--bg-dark);
		margin-left: -7px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #fff;
		font-size: 10px;
		font-weight: 700;
	}
	.lb:first-child {
		margin-left: 0;
	}
	.wave {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 3px;
		min-height: 0;
	}
	.wave i {
		flex: 1;
		background: var(--color-light);
		border-radius: 2px;
		min-height: 4px;
	}
	.controls {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.t {
		font-size: 11px;
		color: var(--text-subtle);
	}
	.bar {
		flex: 1;
		height: 4px;
		background: hsla(0, 0%, 100%, 0.15);
		border-radius: 4px;
		position: relative;
	}
	.fill {
		position: absolute;
		inset: 0 60% 0 0;
		background: var(--color-light);
		border-radius: 4px;
	}
	.btns {
		display: flex;
		align-items: center;
		gap: 10px;
		color: var(--text-secondary);
		font-size: 13px;
	}
	.pp {
		font-size: 18px;
		color: var(--text);
	}
</style>
