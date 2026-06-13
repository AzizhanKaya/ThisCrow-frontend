<script setup lang="ts">
	const friends = [
		{ name: 'Kerem', av: 'K', color: 'hsl(28, 90%, 56%)', game: 'Valorant', detail: 'Ranked · Ascent', time: '24:18', emoji: '🎯' },
		{ name: 'Mira', av: 'M', color: 'hsl(145, 65%, 48%)', game: 'Minecraft', detail: 'Survival world', time: '01:12:40', emoji: '⛏️' },
		{ name: 'Defne', av: 'D', color: 'hsl(330, 75%, 60%)', game: 'League of Legends', detail: 'In champion select', time: '08:55', emoji: '⚔️' },
	];
</script>

<template>
	<div class="game">
		<div class="g-head">
			<span class="status"><i></i>Playing now</span>
		</div>
		<div class="list">
			<div v-for="(f, i) in friends" :key="i" class="rp">
				<div class="art" :style="{ background: f.color }">{{ f.emoji }}</div>
				<div class="info">
					<div class="row">
						<div class="av" :style="{ background: f.color }">{{ f.av }}</div>
						<span class="name">{{ f.name }}</span>
					</div>
					<span class="game-name">{{ f.game }}</span>
					<span class="detail">{{ f.detail }}</span>
					<span class="time">⏱ {{ f.time }} elapsed</span>
				</div>
				<button class="join">Join</button>
			</div>
		</div>
	</div>
</template>

<style scoped>
	.game {
		height: 100%;
		background: var(--bg-dark);
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 12px;
		text-align: left;
	}
	.g-head {
		display: flex;
		align-items: center;
	}
	.status {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		font-size: 12px;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.6px;
		color: var(--text-subtle);
	}
	.status i {
		width: 9px;
		height: 9px;
		border-radius: 50%;
		background: var(--status-online);
		box-shadow: 0 0 0 3px hsla(145, 65%, 50%, 0.2);
	}
	.list {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.rp {
		display: flex;
		align-items: center;
		gap: 14px;
		background: var(--bg-darker);
		border: 1px solid hsla(0, 0%, 100%, 0.05);
		border-radius: 12px;
		padding: 12px;
	}
	.art {
		width: 52px;
		height: 52px;
		border-radius: 10px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 24px;
		flex-shrink: 0;
	}
	.info {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}
	.row {
		display: flex;
		align-items: center;
		gap: 7px;
	}
	.av {
		width: 18px;
		height: 18px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 9px;
		font-weight: 700;
		color: #fff;
	}
	.name {
		font-size: 12px;
		font-weight: 700;
		color: var(--text);
	}
	.game-name {
		font-size: 13px;
		font-weight: 700;
		color: var(--color-lighter);
	}
	.detail {
		font-size: 11px;
		color: var(--text-secondary);
	}
	.time {
		font-size: 10px;
		color: var(--text-subtle);
	}
	.join {
		background: hsla(0, 0%, 100%, 0.08);
		color: var(--text);
		border: none;
		border-radius: 8px;
		padding: 9px 16px;
		font-weight: 700;
		font-size: 12px;
		cursor: pointer;
		transition: background-color 0.15s ease;
	}
	.join:hover {
		background: var(--color);
	}
</style>
