<script setup lang="ts">
	import { ref, computed } from 'vue';
	import { Icon } from '@iconify/vue';
	import { getDefaultAvatar } from '@/utils/avatar';

	type Reaction = { e: string; n: number };
	type Msg = { name: string; username: string; time: string; lines: string[]; reactions?: Reaction[] };
	type Member = { name: string; username: string; status: 'online' | 'idle' | 'dnd' | 'offline'; emoji?: string; note: string; owner?: boolean };
	type Scene = {
		server: string;
		me: { name: string; username: string; status: 'online' | 'idle' | 'dnd' | 'offline' };
		messages: Msg[];
		members: Member[];
	};

	const scenes: Scene[] = [
		{
			server: 'Mürettebat',
			me: { name: 'aziz', username: 'aziz', status: 'online' },
			messages: [
				{ name: 'aziz', username: 'aziz', time: '13:59', lines: ['selam millet 👋'], reactions: [{ e: '😄', n: 1 }, { e: '🔥', n: 2 }] },
				{ name: 'mira', username: 'mira', time: '14:01', lines: ['watch party başlıyor, herkes gelsin 🍿'] },
				{ name: 'kerem', username: 'kerem', time: '14:02', lines: ['geldim! sesi açıyorum'], reactions: [{ e: '🎉', n: 1 }] },
			],
			members: [
				{ name: 'aziz', username: 'aziz', status: 'online', emoji: '👾', note: 'Valorant', owner: true },
				{ name: 'mira', username: 'mira', status: 'online', emoji: '🎶', note: 'Midnight City' },
				{ name: 'kerem', username: 'kerem', status: 'idle', note: 'Idle' },
			],
		},
		{
			server: 'Gece Kuşları',
			me: { name: 'defne', username: 'defne', status: 'dnd' },
			messages: [
				{ name: 'defne', username: 'defne', time: '20:14', lines: ['ranked çekelim mi? 🎮'], reactions: [{ e: '🎮', n: 1 }] },
				{ name: 'can', username: 'can', time: '20:15', lines: ['5 dk sonra hazırım'] },
				{ name: 'zeynep', username: 'zeynep', time: '20:16', lines: ['ben supportum 💜'], reactions: [{ e: '💜', n: 3 }] },
			],
			members: [
				{ name: 'defne', username: 'defne', status: 'online', emoji: '👾', note: 'League of Legends', owner: true },
				{ name: 'can', username: 'can', status: 'dnd', note: 'Do Not Disturb' },
				{ name: 'zeynep', username: 'zeynep', status: 'online', note: 'Online' },
			],
		},
		{
			server: 'Stüdyo',
			me: { name: 'mira', username: 'mira', status: 'online' },
			messages: [
				{ name: 'mira', username: 'mira', time: '22:30', lines: ['aynı şarkıyı dinleyelim 🎶'] },
				{ name: 'aziz', username: 'aziz', time: '22:31', lines: ['sync başlattım', 'herkes bağlandı 🎧'], reactions: [{ e: '🎧', n: 2 }] },
				{ name: 'selin', username: 'selin', time: '22:33', lines: ['bu albüm efsane 🔥'], reactions: [{ e: '🔥', n: 4 }] },
			],
			members: [
				{ name: 'mira', username: 'mira', status: 'online', emoji: '🎶', note: 'Midnight City', owner: true },
				{ name: 'aziz', username: 'aziz', status: 'online', emoji: '🎶', note: 'Midnight City' },
				{ name: 'selin', username: 'selin', status: 'idle', note: 'Idle' },
			],
		},
	];

	// Pick a random scene once, when the component first opens.
	const idx = ref(Math.floor(Math.random() * scenes.length));
	const scene = computed(() => scenes[idx.value]);

	const statusClass = (s: string) => `status-${s}`;
</script>

<template>
	<div class="chat-mock">
		<div class="rail">
			<div class="rail-item home"><img src="/crow.png" alt="" /></div>
			<div class="sep"></div>
			<div class="rail-item server"><img src="/default-server-icon.png" alt="" /></div>
			<div class="rail-item server"><img src="/default-server-icon.png" alt="" /></div>
			<div class="rail-item server"><img src="/default-server-icon.png" alt="" /></div>
			<div class="rail-item add"><Icon icon="mdi:plus" /></div>
		</div>

		<div class="channels">
			<div class="server-header">
				<div class="server-info">
					<img src="/crow.png" alt="" />
					<span>{{ scene.server }}</span>
				</div>
				<Icon icon="fluent:chevron-down-16-filled" class="srv-chevron" />
			</div>

			<div class="channel-list">
				<div class="channel-item">
					<Icon icon="mdi:volume-high" class="channel-icon" />
					<span class="channel-name">general</span>
				</div>
				<div class="channel-item active">
					<Icon icon="octicon:hash-16" class="channel-icon" />
					<span class="channel-name">general</span>
				</div>
			</div>

			<div class="user-card">
				<img class="uc-avatar" :src="getDefaultAvatar(scene.me.username)" alt="" />
				<div class="names">
					<span class="name">{{ scene.me.name }}</span>
					<span class="username">@{{ scene.me.username }}</span>
				</div>
				<div class="status-container">
					<div class="status" :class="statusClass(scene.me.status)"></div>
				</div>
			</div>
		</div>

		<div class="main">
			<div class="channel-header">
				<h3>
					<Icon icon="glyphs:hash-bold" class="channel-icon" />
					general
				</h3>
			</div>

			<div class="messages">
				<div v-for="(m, i) in scene.messages" :key="i" class="message">
					<img class="avatar" :src="getDefaultAvatar(m.username)" alt="" />
					<div class="content">
						<div class="message-header">
							<span class="msg-name">{{ m.name }}</span>
							<span class="time-header">{{ m.time }}</span>
						</div>
						<div class="data">
							<span v-for="(l, j) in m.lines" :key="j" class="text">{{ l }}</span>
							<div v-if="m.reactions" class="reactions">
								<div v-for="(r, k) in m.reactions" :key="k" class="reaction-pill">
									<span class="reaction-emoji">{{ r.e }}</span>
									<span class="reaction-count">{{ r.n }}</span>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>

			<div class="input-area">
				<div class="input-container">
					<div class="input-row">
						<div class="icon-btn plus"><Icon icon="mdi:plus" width="20" height="20" /></div>
						<div class="fake-textarea">Type a message...</div>
						<div class="icon-btn"><Icon icon="mdi:emoticon-outline" width="20" height="20" /></div>
						<div class="icon-btn send"><Icon icon="mdi:send" width="20" height="20" /></div>
					</div>
				</div>
			</div>
		</div>

		<div class="rightbar">
			<h4 class="group-title">Members - {{ scene.members.length }}</h4>
			<div v-for="(m, i) in scene.members" :key="i" class="member-card">
				<div class="user-info">
					<div class="avatar-container">
						<img class="m-avatar" :src="getDefaultAvatar(m.username)" alt="" />
						<div class="state" :class="statusClass(m.status)"></div>
					</div>
					<div class="user-text">
						<div class="m-names">
							<span class="m-name">{{ m.name }}</span>
							<span class="m-username">@{{ m.username }}</span>
						</div>
						<span class="m-status">
							<span v-if="m.emoji" class="status-emoji">{{ m.emoji }}</span>
							<span class="status-text">{{ m.note }}</span>
						</span>
					</div>
					<Icon v-if="m.owner" class="crown" icon="mdi:crown" />
				</div>
			</div>
		</div>
	</div>
</template>

<style scoped>
	.chat-mock {
		display: grid;
		grid-template-columns: 46px 140px 1fr 132px;
		height: 100%;
		width: 100%;
		background: var(--bg);
		font-size: 13px;
		color: var(--text-secondary);
		text-align: left;
	}

	/* ---------- Server rail (ServerList) ---------- */
	.rail {
		background: var(--bg-darkest);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		padding: 10px 0;
	}
	.rail-item {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		background: var(--bg-darker);
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		box-sizing: border-box;
		flex-shrink: 0;
	}
	.rail-item img {
		width: 80%;
		height: 80%;
		object-fit: contain;
	}
	.rail-item.home {
		border-radius: 14px;
		border: 2px solid #444;
	}
	.rail-item.add {
		background: var(--bg);
		color: var(--success);
		font-size: 22px;
	}
	.sep {
		width: 28px;
		height: 1px;
		background: var(--border);
	}

	/* ---------- Channels sidebar ---------- */
	.channels {
		border-right: 1px solid var(--border);
		display: flex;
		flex-direction: column;
		min-width: 0;
		background: var(--bg-dark);
	}
	.server-header {
		flex-shrink: 0;
		height: 46px;
		padding-right: 12px;
		padding-left: 10px;
		border-bottom: 1px solid var(--border);
		font-weight: 800;
		color: var(--text);
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.server-info {
		display: flex;
		align-items: center;
		gap: 8px;
		min-width: 0;
	}
	.server-info img {
		width: 28px;
		height: 28px;
		border-radius: 8px;
		object-fit: cover;
		border: 1px solid var(--border);
		flex-shrink: 0;
	}
	.server-info span {
		font-size: 14px;
		font-weight: 500;
		color: var(--text);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.srv-chevron {
		color: var(--text-muted);
		font-size: 15px;
		flex-shrink: 0;
	}
	.channel-list {
		flex: 1;
		padding: 10px 8px;
		display: flex;
		flex-direction: column;
		min-height: 0;
	}
	.channel-item {
		display: flex;
		align-items: center;
		margin-bottom: 2px;
		padding: 6px 8px;
		border-radius: 4px;
		color: var(--text-muted);
	}
	.channel-item.active {
		background-color: var(--bg-lighter);
		color: var(--text);
	}
	.channel-icon {
		margin-right: 5px;
		font-size: 15px;
		flex-shrink: 0;
	}
	.channel-name {
		font-size: 14px;
		font-weight: 500;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* ---------- Bottom user card (UserCard) ---------- */
	.user-card {
		margin: 8px;
		background-color: var(--bg);
		padding: 7px;
		border-radius: 10px;
		height: 48px;
		display: flex;
		align-items: center;
		gap: 9px;
	}
	.uc-avatar {
		height: 100%;
		aspect-ratio: 1;
		border-radius: 50%;
		object-fit: cover;
		flex-shrink: 0;
	}
	.names {
		display: flex;
		flex-direction: column;
		justify-content: center;
		min-width: 0;
		flex: 1;
	}
	.name {
		font-weight: bold;
		font-size: 14px;
		color: var(--text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.username {
		font-size: 11px;
		color: var(--text-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.status-container {
		margin-left: auto;
		margin-right: 5px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}
	.status {
		height: 14px;
		width: 14px;
		border-radius: 50%;
		border: 2px var(--bg) solid;
	}

	/* ---------- Main chat ---------- */
	.main {
		display: flex;
		flex-direction: column;
		background-color: var(--bg);
		min-width: 0;
		position: relative;
		overflow: hidden;
	}
	.channel-header {
		height: 46px;
		flex-shrink: 0;
		border-bottom: 1px solid var(--border);
		padding: 0 14px;
		background-color: var(--bg-dark);
		color: var(--text);
		display: flex;
		align-items: center;
	}
	.channel-header h3 {
		display: flex;
		align-items: center;
		font-size: 1rem;
		font-weight: 100;
		margin: 0;
	}
	.channel-header .channel-icon {
		font-size: 20px;
		margin-right: 6px;
		color: var(--text-muted);
	}
	.messages {
		flex: 1;
		padding: 10px 0 14px;
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-height: 0;
		overflow: hidden;
	}
	.message {
		display: grid;
		grid-template-columns: 34px 1fr;
		gap: 0 10px;
		padding: 8px 14px 0;
	}
	.avatar {
		grid-column: 1;
		width: 34px;
		height: 34px;
		border-radius: 50%;
		flex-shrink: 0;
	}
	.content {
		grid-column: 2;
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.message-header {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-bottom: 2px;
	}
	.msg-name {
		font-size: 0.92rem;
		color: var(--text);
		font-weight: 600;
	}
	.time-header {
		font-size: 0.72rem;
		color: #7e7e7e;
	}
	.data {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}
	.text {
		font-size: 0.92rem;
		line-height: 1.35;
		color: var(--text-secondary);
		word-break: normal;
		overflow-wrap: break-word;
	}
	.reactions {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		margin-top: 3px;
	}
	.reaction-pill {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 1px 7px;
		background: var(--bg-dark);
		border: 1px solid var(--border);
		border-radius: 10px;
		height: 22px;
		line-height: 1;
	}
	.reaction-emoji {
		font-size: 0.9rem;
		line-height: 1;
	}
	.reaction-count {
		font-size: 0.72rem;
		font-weight: 600;
		color: var(--text-muted);
	}

	/* ---------- Composer (MessageInput) ---------- */
	.input-area {
		flex-shrink: 0;
		width: 100%;
		padding: 0 8px 8px;
	}
	.input-container {
		width: 100%;
		background-color: var(--bg-dark);
		border-radius: 8px;
	}
	.input-row {
		display: flex;
		align-items: center;
		padding: 4px 6px;
	}
	.icon-btn {
		color: #888;
		width: 28px;
		height: 28px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		border-radius: 8px;
	}
	.icon-btn.send {
		color: #555;
	}
	.fake-textarea {
		flex: 1;
		color: var(--text-subtle);
		opacity: 0.6;
		font-size: 0.92rem;
		padding: 6px 6px;
		display: flex;
		align-items: center;
		min-width: 0;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}

	/* ---------- Members (rightbar) ---------- */
	.rightbar {
		border-left: 1px solid var(--border);
		display: flex;
		flex-direction: column;
		padding: 14px 8px;
		background: var(--bg-dark);
		min-width: 0;
	}
	.group-title {
		text-transform: uppercase;
		font-size: 11px;
		font-weight: 600;
		color: var(--text-muted);
		margin-bottom: 8px;
		padding-left: 8px;
	}
	.member-card {
		border-radius: 8px;
		padding: 4px 8px;
		display: flex;
		align-items: center;
	}
	.user-info {
		display: flex;
		align-items: center;
		gap: 10px;
		min-width: 0;
		flex: 1;
		position: relative;
	}
	.avatar-container {
		position: relative;
		width: 30px;
		height: 30px;
		flex-shrink: 0;
	}
	.m-avatar {
		width: 100%;
		height: 100%;
		border-radius: 50%;
		object-fit: cover;
		background-color: var(--bg-dark);
	}
	.state {
		height: 11px;
		width: 11px;
		border-radius: 50%;
		position: absolute;
		border: 2px var(--bg-dark) solid;
		right: -1px;
		bottom: -1px;
	}
	.crown {
		color: orange;
		position: absolute;
		left: 15px;
		top: -5px;
		transform: translate(-50%, -50%);
		font-size: 17px;
	}
	.user-text {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}
	.m-names {
		display: flex;
		align-items: center;
		gap: 4px;
		min-width: 0;
	}
	.m-name {
		font-weight: 600;
		font-size: 13px;
		color: var(--text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.m-username {
		font-weight: 100;
		font-size: 10px;
		color: var(--text-muted);
		white-space: nowrap;
		flex-shrink: 0;
	}
	.m-status {
		color: #b9bbbe;
		font-size: 11px;
		display: flex;
		align-items: center;
		gap: 4px;
		min-width: 0;
	}
	.status-emoji {
		flex-shrink: 0;
		font-size: 10px;
		line-height: 1;
	}
	.status-text {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		min-width: 0;
	}

	/* status dot colors (mirror App.vue globals) */
	.status-online {
		background-color: var(--status-online);
	}
	.status-idle {
		background-color: var(--status-idle);
	}
	.status-dnd {
		background-color: var(--status-dnd);
	}
	.status-offline {
		background-color: var(--status-offline);
	}
</style>
