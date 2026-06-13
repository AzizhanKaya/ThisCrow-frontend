<script setup lang="ts">
	const servers = ['🐦', '🎮', '🎧', '🎬', '🚀'];
	const channels = ['welcome', 'general', 'memes', 'music', 'clips'];
	const messages = [
		{ name: 'Aziz', color: 'hsl(261, 68%, 60%)', text: 'watch party başlıyor, herkes gelsin 🍿', av: 'A' },
		{ name: 'Mira', color: 'hsl(145, 65%, 50%)', text: 'geldim! sesi açıyorum', av: 'M' },
		{ name: 'Kerem', color: 'hsl(28, 90%, 58%)', text: 'oyunu bırakıp geliyorum', av: 'K' },
		{ name: 'Defne', color: 'hsl(330, 75%, 62%)', text: 'aynı şarkıyı dinleyelim 🎶', av: 'D' },
	];
	const members = [
		{ name: 'Aziz', color: 'hsl(261, 68%, 60%)', av: 'A', status: 'online' },
		{ name: 'Mira', color: 'hsl(145, 65%, 50%)', av: 'M', status: 'online' },
		{ name: 'Kerem', color: 'hsl(28, 90%, 58%)', av: 'K', status: 'idle' },
		{ name: 'Defne', color: 'hsl(330, 75%, 62%)', av: 'D', status: 'dnd' },
	];
</script>

<template>
	<div class="chat-mock">
		<div class="rail">
			<div class="rail-item home">🐦</div>
			<div class="sep"></div>
			<div v-for="(s, i) in servers" :key="i" class="rail-item" :class="{ active: i === 0 }">{{ s }}</div>
		</div>

		<div class="channels">
			<div class="ch-head">The Crew</div>
			<div class="ch-list">
				<div v-for="(c, i) in channels" :key="i" class="ch" :class="{ active: i === 1 }"># {{ c }}</div>
			</div>
			<div class="me-bar">
				<div class="av" style="background: hsl(261, 68%, 55%)">A</div>
				<div class="me-info">
					<span class="me-name">Aziz</span>
					<span class="me-tag">online</span>
				</div>
			</div>
		</div>

		<div class="main">
			<div class="main-head"># general</div>
			<div class="msgs">
				<div v-for="(m, i) in messages" :key="i" class="msg">
					<div class="av" :style="{ background: m.color }">{{ m.av }}</div>
					<div class="msg-body">
						<span class="msg-name" :style="{ color: m.color }">{{ m.name }}</span>
						<span class="msg-text">{{ m.text }}</span>
					</div>
				</div>
			</div>
			<div class="composer"><span>Message #general</span></div>
		</div>

		<div class="members">
			<div class="m-label">Online — 4</div>
			<div v-for="(m, i) in members" :key="i" class="member">
				<div class="av small" :style="{ background: m.color }">
					{{ m.av }}<i class="dot" :class="m.status"></i>
				</div>
				<span>{{ m.name }}</span>
			</div>
		</div>
	</div>
</template>

<style scoped>
	.chat-mock {
		display: grid;
		grid-template-columns: 54px 180px 1fr 150px;
		height: 100%;
		width: 100%;
		background: var(--bg-dark);
		font-size: 13px;
		color: var(--text-secondary);
		text-align: left;
	}
	.rail {
		background: var(--bg-darkest);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		padding: 10px 0;
	}
	.rail-item {
		width: 38px;
		height: 38px;
		border-radius: 50%;
		background: var(--bg);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 16px;
		transition: border-radius 0.15s;
	}
	.rail-item.home {
		background: var(--color);
	}
	.rail-item.active {
		border-radius: 14px;
		box-shadow: 0 0 0 2px var(--color-light);
	}
	.sep {
		width: 24px;
		height: 2px;
		background: var(--bg-light);
		border-radius: 2px;
	}
	.channels {
		background: var(--bg-darker);
		display: flex;
		flex-direction: column;
	}
	.ch-head {
		padding: 14px 14px;
		font-weight: 700;
		color: var(--text);
		box-shadow: 0 1px 0 hsla(0, 0%, 0%, 0.3);
	}
	.ch-list {
		flex: 1;
		padding: 8px;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.ch {
		padding: 6px 8px;
		border-radius: 5px;
		color: var(--text-subtle);
		font-weight: 500;
	}
	.ch.active {
		background: var(--bg-light);
		color: var(--text);
	}
	.me-bar {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 10px;
		background: var(--bg-darkest);
	}
	.me-info {
		display: flex;
		flex-direction: column;
		line-height: 1.2;
	}
	.me-name {
		color: var(--text);
		font-weight: 600;
		font-size: 12px;
	}
	.me-tag {
		color: var(--success);
		font-size: 10px;
	}
	.main {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.main-head {
		padding: 14px;
		font-weight: 700;
		color: var(--text);
		box-shadow: 0 1px 0 hsla(0, 0%, 0%, 0.3);
	}
	.msgs {
		flex: 1;
		padding: 14px;
		display: flex;
		flex-direction: column;
		gap: 14px;
	}
	.msg {
		display: flex;
		gap: 10px;
	}
	.msg-body {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.msg-name {
		font-weight: 700;
		font-size: 12px;
	}
	.msg-text {
		color: var(--text-secondary);
	}
	.composer {
		margin: 10px 14px 14px;
		padding: 11px 14px;
		background: var(--bg-light);
		border-radius: 8px;
		color: var(--text-subtle);
	}
	.members {
		background: var(--bg-darker);
		padding: 14px 10px;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.m-label {
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		color: var(--text-subtle);
		letter-spacing: 0.4px;
	}
	.member {
		display: flex;
		align-items: center;
		gap: 8px;
		color: var(--text-secondary);
	}
	.av {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #fff;
		font-weight: 700;
		font-size: 13px;
		position: relative;
	}
	.av.small {
		width: 28px;
		height: 28px;
		font-size: 11px;
	}
	.dot {
		position: absolute;
		right: -2px;
		bottom: -2px;
		width: 11px;
		height: 11px;
		border-radius: 50%;
		border: 2px solid var(--bg-darker);
	}
	.dot.online {
		background: var(--status-online);
	}
	.dot.idle {
		background: var(--status-idle);
	}
	.dot.dnd {
		background: var(--status-dnd);
	}
</style>
