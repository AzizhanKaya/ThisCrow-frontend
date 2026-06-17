<script setup lang="ts">
	import { ref, computed } from 'vue';
	import { Icon } from '@iconify/vue';
	import { getDefaultAvatar } from '@/utils/avatar';

	type Reaction = { e: string; n: number };
	type Msg = { name: string; username: string; time: string; lines: string[]; reactions?: Reaction[] };
	type Member = {
		name: string;
		username: string;
		status: 'online' | 'idle' | 'dnd' | 'offline';
		emoji?: string;
		note: string;
		owner?: boolean;
	};
	type Scene = {
		server: string;
		category: string;
		me: { name: string; username: string; status: 'online' | 'idle' | 'dnd' | 'offline' };
		messages: Msg[];
		members: Member[];
	};

	const scenes: Scene[] = [
		{
			server: 'ThisCrow',
			category: 'GENEL',
			me: { name: 'kaan', username: 'kaan', status: 'online' },
			messages: [
				{
					name: 'kaan',
					username: 'kaan',
					time: '13:59',
					lines: ['selam millet 👋'],
					reactions: [
						{ e: '😄', n: 1 },
						{ e: '🔥', n: 2 },
					],
				},
				{ name: 'mira', username: 'mira', time: '14:01', lines: ['watch party başlıyor, herkes gelsin 🍿'] },
				{ name: 'kerem', username: 'kerem', time: '14:02', lines: ['geldim! sesi açıyorum'], reactions: [{ e: '🎉', n: 1 }] },
			],
			members: [
				{ name: 'kaan', username: 'kaan', status: 'online', emoji: '👾', note: 'Elden Ring', owner: true },
				{ name: 'mira', username: 'mira', status: 'online', emoji: '🎶', note: "Can't Feel My Face" },
				{ name: 'kerem', username: 'kerem', status: 'idle', note: 'Idle' },
			],
		},
		{
			server: 'ThisCrow',
			category: 'OYUN',
			me: { name: 'defne', username: 'defne', status: 'dnd' },
			messages: [
				{ name: 'defne', username: 'defne', time: '20:14', lines: ['bu akşam cs2 giren var mı? 🎮'], reactions: [{ e: '🎮', n: 1 }] },
				{ name: 'can', username: 'can', time: '20:15', lines: ['5 dk sonra sunucuya giriyorum'] },
				{ name: 'murat', username: 'murat', time: '20:16', lines: ['ben de geliyorum!'], reactions: [{ e: '🔥', n: 2 }] },
			],
			members: [
				{ name: 'defne', username: 'defne', status: 'online', emoji: '👾', note: 'Counter-Strike 2', owner: true },
				{ name: 'can', username: 'can', status: 'dnd', note: 'Do Not Disturb' },
				{ name: 'murat', username: 'murat', status: 'online', note: 'Online' },
			],
		},
		{
			server: 'ThisCrow',
			category: 'GENEL',
			me: { name: 'mira', username: 'mira', status: 'online' },
			messages: [
				{ name: 'mira', username: 'mira', time: '22:30', lines: ['yeni güncelleme yayınlandı mı?'] },
				{
					name: 'bora',
					username: 'bora',
					time: '22:31',
					lines: ['evet indirdim bile ⚡', 'aşırı hızlı çalışıyor'],
					reactions: [{ e: '⚡', n: 3 }],
				},
				{
					name: 'selin',
					username: 'selin',
					time: '22:33',
					lines: ['bende de yüklendi, test ediyorum'],
					reactions: [{ e: '🔥', n: 2 }],
				},
			],
			members: [
				{ name: 'mira', username: 'mira', status: 'online', emoji: '🎶', note: 'YEAH RIGHT', owner: true },
				{ name: 'bora', username: 'bora', status: 'online', emoji: '👾', note: 'Stardew Valley' },
				{ name: 'selin', username: 'selin', status: 'idle', note: 'Idle' },
			],
		},
	];

	const idx = ref(Math.floor(Math.random() * scenes.length));
	const scene = computed(() => scenes[idx.value]);

	const statusClass = (s: string) => `status-${s}`;
</script>

<template>
	<div class="chat-mock">
		<div class="rail">
			<div class="rail-item home"><img src="/crow.png" alt="" /></div>
			<div class="sep"></div>
			<div class="rail-item selected server"><img src="/default-server-icon.png" alt="" /></div>
			<div class="rail-item server"><img src="/default-server-icon.png" alt="" /></div>
			<div class="rail-item server"><img src="/default-server-icon.png" alt="" /></div>
			<div class="rail-item add"><Icon icon="mdi:plus" /></div>
		</div>

		<div class="content-view">
			<div class="channels">
				<div class="server-header">
					<div class="server-info">
						<img src="/default-server-icon.png" alt="" />
						<span>{{ scene.server }}</span>
					</div>
					<Icon icon="fluent:chevron-down-16-filled" class="srv-chevron" />
				</div>

				<div class="channel-list">
					<div class="category">
						<div class="category-title">
							<Icon icon="mdi:chevron-down" class="chevron" />
							<span>{{ scene.category }}</span>
							<Icon icon="mdi:plus" class="add-icon" />
						</div>
						<div class="category-channels">
							<div class="channel-item active">
								<Icon icon="octicon:hash-16" class="channel-icon" />
								<span class="channel-name">genel</span>
							</div>
							<div class="channel-item">
								<Icon icon="mdi:volume-high" class="channel-icon" />
								<span class="channel-name">genel</span>
							</div>
						</div>
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
						<Icon icon="glyphs:hash-bold" class="header-channel-icon" />
						genel
					</h3>
				</div>

				<div class="messages">
					<div v-for="(m, i) in scene.messages" :key="i" class="message" :class="{ 'with-user': true }">
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
	</div>
</template>

<style scoped>
	.chat-mock {
		display: grid;
		grid-template-columns: 60px 1fr;
		height: 100%;
		width: 100%;
		font-size: 13px;
		color: var(--text-secondary);
		text-align: left;
		background-color: var(--bg-dark);
	}

	.rail {
		height: 100%;
		padding-top: 4px;
		padding-inline: 8px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
	}
	.rail-item {
		aspect-ratio: 1;
		width: 100%;
		padding: 2px;
		border-radius: 50%;
		background: var(--bg-darker);
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		box-sizing: border-box;
		flex-shrink: 0;
	}
	.rail-item.selected {
		border-radius: 16px;
	}
	.rail-item img {
		width: 100%;
		height: 100%;
		object-fit: contain;
	}
	.rail-item.home {
		background-color: transparent;
		border-radius: 15px;
		border: 2px solid #444;
	}
	.rail-item.home img {
		width: 80%;
		height: 80%;
	}
	.rail-item.add {
		background: var(--bg);
		color: var(--success);
		font-size: 22px;
	}
	.sep {
		width: 100%;
		height: 1px;
		background: var(--border);
		margin: 4px 0;
	}

	.content-view {
		display: grid;
		grid-template-columns: 160px 1fr 150px;
		height: 100%;
		min-width: 0;
		border-left: 1px solid var(--border);
		border-top: 1px solid var(--border);
		border-top-left-radius: 20px;
		overflow: hidden;
	}

	.channels {
		border-right: 1px solid var(--border);
		overflow: hidden;
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.server-header {
		flex-shrink: 0;
		height: 40px;
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
		width: 32px;
		height: 32px;
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
		overflow-y: auto;
		padding: 8px;
		display: flex;
		flex-direction: column;
		min-height: 0;
	}
	.category {
		margin-bottom: 8px;
	}
	.category-title {
		display: flex;
		align-items: center;
		margin-bottom: 2px;
		padding: 4px 0;
		color: var(--text-muted);
		font-size: 0.75rem;
		font-weight: 700;
		cursor: default;
		user-select: none;
	}
	.chevron {
		margin-right: 4px;
		font-size: 1rem;
	}
	.add-icon {
		margin-left: auto;
	}
	.category-channels {
		padding: 0 4px;
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
		font-size: 1rem;
		flex-shrink: 0;
	}
	.channel-name {
		font-size: 16px;
		font-weight: 500;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.user-card {
		margin: 8px;
		background-color: var(--bg);
		padding: 10px;
		border-radius: 10px;
		height: 54px;
		display: flex;
		align-items: center;
		gap: 8px;
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
		font-size: 1.2rem;
		color: var(--text);
		white-space: nowrap;
		text-overflow: ellipsis;
	}
	.username {
		font-size: 0.9em;
		color: var(--text-muted);
		white-space: nowrap;
		text-overflow: ellipsis;
	}
	.status-container {
		margin-left: auto;
		margin-right: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.status {
		height: 16px;
		aspect-ratio: 1;
		border-radius: 50%;
		border: 2px var(--bg) solid;
	}

	.main {
		display: flex;
		flex-direction: column;
		background-color: var(--bg);
		min-width: 0;
		position: relative;
		overflow: hidden;
		min-width: 300px;
	}
	.channel-header {
		height: 40px;
		flex-shrink: 0;
		border-bottom: 1px solid var(--border);
		padding: 0 12px;
		background-color: var(--bg-dark);
		color: var(--text);
		display: flex;
		align-items: center;
	}
	.channel-header h3 {
		display: flex;
		align-items: center;
		font-size: 1.1rem;
		font-weight: 100;
		margin: 0;
	}
	.header-channel-icon {
		font-size: 20px;
		margin-right: 4px;
		color: var(--text-muted);
	}

	.messages {
		flex: 1;
		margin-bottom: 50px;
		display: flex;
		flex-direction: column;
		min-height: 0;
		overflow-x: hidden;
		overflow-y: scroll;
	}

	.message {
		display: grid;
		grid-template-columns: 40px 1fr;
		gap: 0 12px;
		padding: 12px 16px 0;
	}
	.avatar {
		grid-column: 1;
		width: 40px;
		height: 40px;
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
		font-size: 1rem;
		color: var(--text);
		font-weight: 600;
	}
	.time-header {
		font-size: 0.8rem;
		color: #7e7e7e;
	}
	.data {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}
	.text {
		font-size: 1rem;
		line-height: 1.4;
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
		padding: 2px 8px;
		background: var(--bg-dark);
		border: 1px solid var(--border);
		border-radius: 12px;
		height: 26px;
		line-height: 1;
	}
	.reaction-emoji {
		font-size: 1rem;
		line-height: 1;
	}
	.reaction-count {
		font-size: 0.78rem;
		font-weight: 600;
		color: var(--text-muted);
	}

	.input-area {
		flex-shrink: 0;
		width: 100%;
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

	.rightbar {
		background-color: var(--bg-dark);
		border-left: 1px solid var(--border);
		display: flex;
		flex-direction: column;
		padding: 12px 8px;
		gap: 8px;
		flex-shrink: 0;
	}
	.group-title {
		font-size: 0.7rem;
		font-weight: 555;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-muted);
		margin-bottom: 4px;
	}
	.member-card {
		position: relative;
		border-radius: 4px;
	}
	.user-info {
		display: flex;
		align-items: center;
		gap: 8px;
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
		height: 12px;
		width: 12px;
		border-radius: 50%;
		position: absolute;
		border: 2px var(--bg-dark) solid;
		right: -2px;
		bottom: -2px;
	}
	.crown {
		color: orange;
		position: absolute;
		left: 16px;
		top: -4px;
		transform: translate(-50%, -50%);
		font-size: 24px;
	}
	.user-text {
		display: flex;
		flex-direction: column;
		gap: 0px;
		min-width: 0;
		flex: 1;
	}
	.m-names {
		display: flex;
		align-items: center;
		gap: 4px;
		min-width: 0;
	}
	.m-name {
		font-weight: 600;
		font-size: 0.9rem;
		color: var(--text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.m-status {
		color: #b9bbbe;
		font-size: 11px;
		display: flex;
		align-items: center;
		gap: 3px;
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
		color: #8e9197;
	}

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

	/* Responsive layout rules for mock chat application window */
	.main {
		min-width: 0;
	}
</style>
