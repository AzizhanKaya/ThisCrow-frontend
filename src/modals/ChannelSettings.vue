<script setup lang="ts">
	import { ref, computed, onMounted, watch } from 'vue';
	import { Icon } from '@iconify/vue';
	import { useModalStore } from '@/stores/modal';
	import { useServerStore } from '@/stores/server';
	import { Permissions, type OverrideTarget, type id, ChannelType } from '@/types';
	import { getDefaultAvatar } from '@/utils/avatar';

	const modalStore = useModalStore();
	const serverStore = useServerStore();

	const server_id = modalStore.data?.server_id as id;
	const channel_id = modalStore.data?.channel_id as id;

	const server = computed(() => serverStore.getServerById(server_id));
	const channel = computed(() => server.value?.channels?.get(channel_id));
	const isVoice = computed(() => channel.value?.type === ChannelType.Voice);

	const PERMISSION_FLAGS = [
		{ label: 'View Channel', bit: Permissions.VIEW_CHANNEL, description: 'See the channel in the list', category: 'General' },
		{ label: 'Manage Channel', bit: Permissions.MANAGE_CHANNELS, description: 'Edit name, category, delete', category: 'General' },
		{
			label: 'Manage Permissions',
			bit: Permissions.MANAGE_ROLES,
			description: 'Change channel-specific overrides',
			category: 'General',
		},
		{ label: 'Create Invite', bit: Permissions.CREATE_INVITE, description: 'Generate invite links', category: 'General' },

		{ label: 'View Messages', bit: Permissions.VIEW_MESSAGES, description: 'Read messages in this channel', category: 'Messages' },
		{ label: 'Send Messages', bit: Permissions.SEND_MESSAGE, description: 'Send new messages', category: 'Messages' },
		{ label: 'Send TTS', bit: Permissions.SEND_TTS_MESSAGES, description: 'Use /tts to send text-to-speech', category: 'Messages' },
		{ label: 'Manage Messages', bit: Permissions.MANAGE_MESSAGES, description: 'Delete or pin any message', category: 'Messages' },
		{ label: 'Embed Links', bit: Permissions.EMBED_LINKS, description: 'Render link previews', category: 'Messages' },
		{ label: 'Attach Files', bit: Permissions.ATTACH_FILES, description: 'Upload files and media', category: 'Messages' },
		{ label: 'Read History', bit: Permissions.READ_MESSAGE_HISTORY, description: 'Read past messages', category: 'Messages' },
		{ label: 'Mention Everyone', bit: Permissions.MENTION_EVERYONE, description: 'Use @everyone and @here', category: 'Messages' },

		{ label: 'Connect', bit: Permissions.CONNECT, description: 'Join this voice channel', category: 'Voice' },
		{ label: 'Speak', bit: Permissions.SPEAK, description: 'Transmit audio', category: 'Voice' },
		{ label: 'Mute Members', bit: Permissions.MUTE_MEMBERS, description: 'Mute others in voice', category: 'Voice' },
		{ label: 'Deafen Members', bit: Permissions.DEAFEN_MEMBERS, description: 'Deafen others in voice', category: 'Voice' },
		{ label: 'Move Members', bit: Permissions.MOVE_MEMBERS, description: 'Move members between channels', category: 'Voice' },
	];

	const permissionCategories = computed(() => {
		const cats: Record<string, typeof PERMISSION_FLAGS> = {};
		for (const p of PERMISSION_FLAGS) {
			if (p.category === 'Voice' && !isVoice.value) continue;
			if (p.category === 'Messages' && isVoice.value) continue;
			if (!cats[p.category]) cats[p.category] = [];
			cats[p.category].push(p);
		}
		return cats;
	});

	const channelName = ref('');
	const channelTitle = ref('');

	onMounted(() => {
		if (channel.value) {
			channelName.value = channel.value.name;
			channelTitle.value = channel.value.title ?? '';
		}
	});

	watch(
		() => channel.value?.id,
		() => {
			if (channel.value) {
				channelName.value = channel.value.name;
				channelTitle.value = channel.value.title ?? '';
			}
		}
	);

	const hasMetaChange = computed(() => {
		if (!channel.value) return false;
		const trimmedName = channelName.value.trim();
		const trimmedTitle = channelTitle.value.trim();
		if (trimmedName.length === 0) return false;
		return trimmedName !== channel.value.name || trimmedTitle !== (channel.value.title ?? '');
	});

	type LocalOverride = { allow: number; deny: number };
	const localOverrides = ref<Map<string, LocalOverride>>(new Map());
	const selectedKey = ref<string | null>(null);

	function targetKey(t: OverrideTarget): string {
		return 'role' in t ? `r:${t.role}` : `u:${t.user}`;
	}

	function targetFromKey(key: string): OverrideTarget {
		const [kind, idStr] = key.split(':');
		const idNum = Number(idStr);
		return kind === 'r' ? { role: idNum } : { user: idNum };
	}

	function loadServerOverrides() {
		const map = new Map<string, LocalOverride>();
		for (const o of channel.value?.permission_overrides ?? []) {
			map.set(targetKey(o.target), { allow: o.allow, deny: o.deny });
		}
		localOverrides.value = map;
	}

	watch(channel, loadServerOverrides, { immediate: true });

	type TargetRow =
		| { key: string; kind: 'role'; role_id: id; label: string; color: string; hasOverride: boolean }
		| { key: string; kind: 'user'; user_id: id; label: string; username: string; avatar?: string; hasOverride: boolean };

	const allTargets = computed<TargetRow[]>(() => {
		const list: TargetRow[] = [];
		list.push({
			key: 'r:0',
			kind: 'role',
			role_id: 0,
			label: '@everyone',
			color: '#ffffff',
			hasOverride: isOverrideActive('r:0'),
		});
		const roles = Array.from(server.value?.roles?.values() ?? []).sort((a, b) => b.position - a.position);
		for (const r of roles) {
			list.push({
				key: `r:${r.id}`,
				kind: 'role',
				role_id: r.id,
				label: r.name,
				color: r.color || 'hsl(0 0% 60%)',
				hasOverride: isOverrideActive(`r:${r.id}`),
			});
		}
		const members = Array.from(server.value?.members?.values() ?? []);
		members.sort((a, b) => {
			const pa = a.roles.length ? Math.max(...a.roles.map((r) => r.position)) : -1;
			const pb = b.roles.length ? Math.max(...b.roles.map((r) => r.position)) : -1;
			if (pa !== pb) return pb - pa;
			return a.user.name.localeCompare(b.user.name);
		});
		for (const m of members) {
			list.push({
				key: `u:${m.user.id}`,
				kind: 'user',
				user_id: m.user.id,
				label: m.user.name,
				username: m.user.username,
				avatar: m.user.avatar,
				hasOverride: isOverrideActive(`u:${m.user.id}`),
			});
		}
		return list;
	});

	const searchQuery = ref('');

	const filteredTargets = computed(() => {
		const q = searchQuery.value.trim().toLowerCase();
		const list = allTargets.value;
		if (!q) return list;
		return list.filter((t) => {
			const inLabel = t.label.toLowerCase().includes(q);
			const inUsername = t.kind === 'user' && t.username.toLowerCase().includes(q);
			return inLabel || inUsername;
		});
	});

	function selectTarget(row: TargetRow) {
		selectedKey.value = row.key;
		if (!localOverrides.value.has(row.key)) {
			localOverrides.value.set(row.key, { allow: 0, deny: 0 });
		}
	}

	function isOverrideActive(key: string): boolean {
		const local = localOverrides.value.get(key);
		return local !== undefined && (local.allow !== 0 || local.deny !== 0);
	}

	const selectedTarget = computed<TargetRow | null>(() => {
		if (!selectedKey.value) return null;
		return allTargets.value.find((t) => t.key === selectedKey.value) ?? null;
	});

	const selectedOverride = computed<LocalOverride | null>(() => {
		if (!selectedKey.value) return null;
		return localOverrides.value.get(selectedKey.value) ?? null;
	});

	type TriState = 'allow' | 'neutral' | 'deny';

	function permState(bit: number): TriState {
		const o = selectedOverride.value;
		if (!o) return 'neutral';
		if ((o.allow & bit) !== 0) return 'allow';
		if ((o.deny & bit) !== 0) return 'deny';
		return 'neutral';
	}

	function setPermState(bit: number, state: TriState) {
		if (!selectedKey.value) return;
		const cur = localOverrides.value.get(selectedKey.value);
		if (!cur) return;
		let { allow, deny } = cur;
		allow &= ~bit;
		deny &= ~bit;
		if (state === 'allow') allow |= bit;
		else if (state === 'deny') deny |= bit;
		localOverrides.value.set(selectedKey.value, { allow, deny });
	}

	const permissionDiffs = computed(() => {
		const server_map = new Map<string, LocalOverride>();
		for (const o of channel.value?.permission_overrides ?? []) {
			server_map.set(targetKey(o.target), { allow: o.allow, deny: o.deny });
		}

		const toUpsert: { target: OverrideTarget; allow: number; deny: number }[] = [];
		const toDelete: OverrideTarget[] = [];

		for (const [key, local] of localOverrides.value) {
			const target = targetFromKey(key);
			const srv = server_map.get(key);
			if (local.allow === 0 && local.deny === 0) {
				if (srv) toDelete.push(target);
				continue;
			}
			if (!srv || srv.allow !== local.allow || srv.deny !== local.deny) {
				toUpsert.push({ target, allow: local.allow, deny: local.deny });
			}
		}

		for (const [key] of server_map) {
			if (!localOverrides.value.has(key)) {
				toDelete.push(targetFromKey(key));
			}
		}

		return { toUpsert, toDelete };
	});

	const pendingCount = computed(() => {
		const meta = hasMetaChange.value ? 1 : 0;
		return permissionDiffs.value.toUpsert.length + permissionDiffs.value.toDelete.length + meta;
	});

	const isSaving = ref(false);

	async function saveAll() {
		if (pendingCount.value === 0 || isSaving.value) return;
		isSaving.value = true;
		try {
			if (hasMetaChange.value && channel.value) {
				const newName = channelName.value.trim();
				const newTitle = channelTitle.value.trim();
				await serverStore.updateChannel(server_id, channel_id, newName, newTitle.length === 0 ? undefined : newTitle);
			}
			const { toUpsert, toDelete } = permissionDiffs.value;
			for (const o of toUpsert) {
				await serverStore.setPermissionOverride(server_id, channel_id, o.target, o.allow, o.deny);
			}
			for (const t of toDelete) {
				await serverStore.deletePermissionOverride(server_id, channel_id, t);
			}
		} finally {
			isSaving.value = false;
		}
	}

	function close() {
		modalStore.closeModal();
	}
</script>

<template>
	<div class="modal-backdrop" @click="close">
		<div class="settings-root" @click.stop>
			<button class="close-btn" @click="close">
				<Icon icon="mdi:close" />
			</button>

			<div class="content-scroll">
				<div class="modal-header">
					<Icon :icon="isVoice ? 'mdi:volume-high' : 'octicon:hash-16'" class="header-icon" />
					<h2 class="content-title">{{ channel?.name }}</h2>
				</div>

				<div class="meta-stack">
					<div class="input-group">
						<label>Category</label>
						<div class="input-wrapper">
							<Icon icon="lucide:folder" class="prefix-icon" />
							<input
								type="text"
								v-model="channelTitle"
								maxlength="100"
								placeholder="No category"
								spellcheck="false"
								autocomplete="off"
							/>
						</div>
					</div>

					<div class="input-group">
						<label>Channel name <span class="req">*</span></label>
						<div class="input-wrapper">
							<Icon :icon="isVoice ? 'mdi:volume-high' : 'octicon:hash-16'" class="prefix-icon" />
							<input
								type="text"
								v-model="channelName"
								maxlength="100"
								placeholder="channel-name"
								spellcheck="false"
								autocomplete="off"
							/>
						</div>
					</div>
				</div>

				<div class="section-divider"></div>

				<div class="section-head">
					<h3 class="section-heading">Permission Overrides</h3>
					<p class="section-sub">Allow or deny specific roles and members for this channel.</p>
				</div>

				<div class="perm-split">
					<div class="targets-pane">
						<div class="input-wrapper search-wrapper">
							<Icon icon="mdi:magnify" class="prefix-icon" />
							<input type="text" v-model="searchQuery" placeholder="Search roles or members" spellcheck="false" autocomplete="off" />
						</div>

						<div class="target-list">
							<div
								v-for="row in filteredTargets"
								:key="row.key"
								class="target-row"
								:class="{ selected: row.key === selectedKey, 'has-override': row.hasOverride }"
								@click="selectTarget(row)"
							>
								<div class="row-icon">
									<div v-if="row.kind === 'role'" class="role-dot" :style="{ backgroundColor: row.color }"></div>
									<img v-else :src="row.avatar || getDefaultAvatar(row.username)" alt="" class="member-avatar" />
								</div>
								<div class="row-label">
									<span class="row-name">{{ row.label }}</span>
									<span v-if="row.kind === 'user'" class="row-sub">@{{ row.username }}</span>
								</div>
							</div>

							<div v-if="filteredTargets.length === 0" class="empty-list">
								<span>No matches</span>
							</div>
						</div>
					</div>

					<div class="editor-pane">
						<template v-if="selectedTarget">
							<div class="editor-head">
								<div class="row-icon lg">
									<div v-if="selectedTarget.kind === 'role'" class="role-dot lg" :style="{ backgroundColor: selectedTarget.color }"></div>
									<img v-else :src="selectedTarget.avatar || getDefaultAvatar(selectedTarget.username)" alt="" class="member-avatar lg" />
								</div>
								<div class="editor-title">
									<span class="editor-name">{{ selectedTarget.label }}</span>
									<span v-if="selectedTarget.kind === 'user'" class="editor-sub">@{{ selectedTarget.username }}</span>
									<span v-else class="editor-sub">role</span>
								</div>
							</div>

							<div class="perm-section" v-for="(perms, cat) in permissionCategories" :key="cat">
								<div class="perm-cat-label">{{ cat }}</div>
								<div class="perm-grid">
									<div class="perm-item" v-for="p in perms" :key="p.bit">
										<div class="perm-info">
											<span class="perm-label">{{ p.label }}</span>
											<span class="perm-desc">{{ p.description }}</span>
										</div>
										<div class="tri-toggle" role="radiogroup">
											<button
												class="tri-btn deny"
												:class="{ active: permState(p.bit) === 'deny' }"
												@click="setPermState(p.bit, permState(p.bit) === 'deny' ? 'neutral' : 'deny')"
												:aria-pressed="permState(p.bit) === 'deny'"
												title="Deny"
											>
												<Icon icon="mdi:close" />
											</button>
											<button
												class="tri-btn neutral"
												:class="{ active: permState(p.bit) === 'neutral' }"
												@click="setPermState(p.bit, 'neutral')"
												:aria-pressed="permState(p.bit) === 'neutral'"
												title="Inherit"
											>
												<Icon icon="mdi:minus" />
											</button>
											<button
												class="tri-btn allow"
												:class="{ active: permState(p.bit) === 'allow' }"
												@click="setPermState(p.bit, permState(p.bit) === 'allow' ? 'neutral' : 'allow')"
												:aria-pressed="permState(p.bit) === 'allow'"
												title="Allow"
											>
												<Icon icon="mdi:check" />
											</button>
										</div>
									</div>
								</div>
							</div>
						</template>

						<div v-else class="empty-state">
							<Icon icon="mdi:shield-key-outline" class="empty-icon" />
							<span>Select a role or member to set permissions</span>
						</div>
					</div>
				</div>
			</div>

			<Transition name="save-bar">
				<div v-if="pendingCount > 0" class="save-bar">
					<button class="btn-primary" :disabled="isSaving" @click="saveAll">
						<Icon v-if="isSaving" icon="mdi:loading" class="spin" />
						<span v-else>Save Changes</span>
					</button>
				</div>
			</Transition>
		</div>
	</div>
</template>

<style scoped>
	.modal-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		width: 100vw;
		height: 100vh;
		background-color: var(--overlay);
		z-index: 1000;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.settings-root {
		position: relative;
		display: flex;
		flex-direction: column;
		width: 650px;
		max-width: 95vw;
		height: 800px;
		max-height: 90vh;
		border-radius: 12px;
		overflow: hidden;
		background-color: var(--bg);
		border: 1px solid var(--border);
		box-shadow: 0 12px 40px rgba(0, 0, 0, 0.55);
		font-feature-settings: 'ss01', 'cv11';
	}

	.close-btn {
		position: absolute;
		top: 20px;
		right: 20px;
		z-index: 2;
		background: none;
		border: 1px solid var(--border);
		color: var(--text-muted);
		cursor: pointer;
		font-size: 1.1rem;
		width: 32px;
		height: 32px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s;
	}

	.close-btn:hover {
		background-color: var(--bg-light);
		color: var(--text);
	}

	.content-scroll {
		flex: 1;
		overflow-y: auto;
		padding: 26px 32px 24px;
		display: flex;
		flex-direction: column;
		min-height: 0;
	}

	.modal-header {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-bottom: 18px;
	}

	.header-icon {
		font-size: 1.5rem;
		color: var(--text-subtle);
	}

	.content-title {
		font-size: 1.35rem;
		font-weight: 700;
		color: var(--text);
		margin: 0;
		letter-spacing: -0.015em;
		line-height: 1.1;
	}

	.meta-stack {
		display: flex;
		flex-direction: column;
		margin-bottom: 4px;
	}

	.input-group {
		display: flex;
		flex-direction: column;
		margin-bottom: 12px;
	}

	.input-group label {
		font-size: 0.78rem;
		font-weight: 600;
		color: var(--text-secondary);
		margin-bottom: 6px;
		letter-spacing: -0.005em;
	}

	.req {
		color: var(--error);
		margin-left: 2px;
	}

	.input-wrapper {
		background-color: var(--bg-dark);
		border: 1px solid var(--border-muted);
		border-radius: 8px;
		padding: 0 13px;
		display: flex;
		align-items: center;
		gap: 10px;
		transition:
			border-color 0.18s,
			box-shadow 0.18s;
	}

	.input-wrapper:focus-within {
		border-color: var(--color);
		box-shadow: 0 0 0 3px hsla(261, 68%, 55%, 0.15);
	}

	.prefix-icon {
		color: var(--text-subtle);
		font-size: 1rem;
		flex-shrink: 0;
	}

	.input-wrapper input {
		width: 100%;
		padding: 11px 0;
		background: transparent;
		border: none;
		color: var(--text);
		font-size: 14.5px;
		font-family: inherit;
		font-weight: 500;
		letter-spacing: -0.003em;
		outline: none;
	}

	.input-wrapper input::placeholder {
		color: var(--text-subtle);
		font-weight: 400;
	}

	.section-divider {
		height: 1px;
		background-color: var(--border);
		margin: 8px 0 12px;
	}

	.section-head {
		margin-bottom: 10px;
	}

	.section-heading {
		font-size: 0.78rem;
		font-weight: 700;
		color: var(--text-muted);
		margin: 0 0 4px;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.section-sub {
		font-size: 0.82rem;
		color: var(--text-subtle);
		margin: 0;
		line-height: 1.45;
	}

	.perm-split {
		flex: 1;
		display: grid;
		grid-template-columns: 240px 1fr;
		gap: 0;
		border: 1px solid var(--border);
		border-radius: 10px;
		overflow: hidden;
		background-color: var(--bg-dark);
		min-height: 0;
	}

	.targets-pane {
		display: flex;
		flex-direction: column;
		border-right: 1px solid var(--border);
		padding: 10px 8px 10px;
		min-height: 0;
		overflow: hidden;
	}

	.search-wrapper {
		padding: 0 12px;
		margin: 2px 4px 8px;
		flex-shrink: 0;
	}

	.search-wrapper input {
		padding: 9px 0;
		font-size: 0.88rem;
	}

	.target-list {
		flex: 1;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 1px;
		padding-right: 2px;
		min-height: 0;
	}

	.target-row {
		position: relative;
		display: flex;
		align-items: center;
		gap: 11px;
		padding: 7px 11px;
		min-height: 38px;
		border-radius: 6px;
		cursor: pointer;
		color: var(--text-subtle);
		transition:
			background-color 0.15s,
			color 0.15s;
	}

	.target-row:hover {
		background-color: var(--bg);
		color: var(--text-secondary);
	}

	.target-row.has-override {
		color: var(--text);
	}

	.target-row.selected {
		background-color: var(--bg-light);
		color: var(--text);
	}

	.target-row.selected .row-name {
		font-weight: 700;
	}

	.row-icon {
		width: 26px;
		height: 26px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.row-icon.lg {
		width: 32px;
		height: 32px;
	}

	.role-dot {
		width: 14px;
		height: 14px;
		border-radius: 50%;
	}

	.role-dot.lg {
		width: 18px;
		height: 18px;
	}

	.member-avatar {
		width: 26px;
		height: 26px;
		border-radius: 50%;
		object-fit: cover;
	}

	.member-avatar.lg {
		width: 32px;
		height: 32px;
	}

	.row-label {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-width: 0;
		overflow: hidden;
	}

	.row-name {
		display: block;
		max-width: 100%;
		font-size: 0.92rem;
		font-weight: 500;
		letter-spacing: -0.005em;
		line-height: 1.25;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.row-sub {
		display: block;
		max-width: 100%;
		font-size: 0.74rem;
		font-weight: 400;
		color: var(--text-subtle);
		line-height: 1.2;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.empty-list {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 30px 12px;
		color: var(--text-subtle);
		font-size: 0.85rem;
	}

	.editor-pane {
		display: flex;
		flex-direction: column;
		padding: 16px 22px 20px;
		overflow-y: auto;
		min-height: 0;
	}

	.editor-head {
		display: flex;
		align-items: center;
		gap: 12px;
		padding-bottom: 14px;
		margin-bottom: 2px;
		flex-shrink: 0;
	}

	.editor-title {
		display: flex;
		flex-direction: column;
		min-width: 0;
		gap: 2px;
	}

	.editor-name {
		font-size: 1.02rem;
		font-weight: 700;
		color: var(--text);
		letter-spacing: -0.01em;
		line-height: 1.15;
	}

	.editor-sub {
		font-size: 0.68rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text-subtle);
		font-weight: 600;
	}

	.perm-section {
		margin-bottom: 20px;
	}

	.perm-cat-label {
		font-size: 0.68rem;
		font-weight: 700;
		color: var(--text-subtle);
		letter-spacing: 0.1em;
		text-transform: uppercase;
		margin-bottom: 8px;
		padding-top: 14px;
		border-top: 1px solid var(--border);
	}

	.perm-section:first-of-type .perm-cat-label {
		border-top: none;
		padding-top: 14px;
	}

	.perm-grid {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.perm-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		padding: 8px 12px;
		border-radius: 6px;
		transition: background 0.15s;
	}

	.perm-item:hover {
		background-color: var(--bg-dark);
	}

	.perm-info {
		display: flex;
		flex-direction: column;
		gap: 1px;
		min-width: 0;
	}

	.perm-label {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--text);
		letter-spacing: -0.005em;
	}

	.perm-desc {
		font-size: 0.74rem;
		font-weight: 400;
		color: var(--text-subtle);
		line-height: 1.35;
	}

	.tri-toggle {
		display: flex;
		align-items: stretch;
		gap: 2px;
		padding: 2px;
		background-color: var(--bg);
		border: 1px solid var(--border);
		border-radius: 8px;
		flex-shrink: 0;
	}

	.tri-btn {
		width: 30px;
		height: 24px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: none;
		border-radius: 5px;
		color: var(--text-muted);
		cursor: pointer;
		font-size: 0.95rem;
		transition: all 0.15s;
	}

	.tri-btn:hover {
		color: var(--text);
		background-color: var(--bg-light);
	}

	.tri-btn.deny.active {
		background-color: var(--error);
		color: white;
	}

	.tri-btn.allow.active {
		background-color: var(--success);
		color: white;
	}

	.tri-btn.neutral.active {
		background-color: var(--bg-lighter);
		color: var(--text);
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 24px;
		gap: 10px;
		color: var(--text-subtle);
		text-align: center;
		flex: 1;
		font-size: 0.85rem;
	}

	.empty-icon {
		font-size: 2.2rem;
		opacity: 0.35;
	}

	.save-bar {
		position: absolute;
		bottom: 0;
		right: 0;
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 16px;
		padding: 14px 28px;
		z-index: 5;
	}

	.btn-primary {
		background-color: var(--color);
		color: white;
		border: none;
		padding: 10px 24px;
		border-radius: 6px;
		font-weight: 600;
		font-size: 0.9rem;
		font-family: inherit;
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 6px;
		transition: all 0.2s;
	}

	.btn-primary:hover:not(:disabled) {
		background-color: var(--color-light);
		transform: translateY(-1px);
	}

	.btn-primary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.spin {
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		100% {
			transform: rotate(360deg);
		}
	}

	.save-bar-enter-active,
	.save-bar-leave-active {
		transition:
			transform 0.1s ease-in,
			opacity 0.1s ease-in-out;
	}

	.save-bar-enter-from,
	.save-bar-leave-to {
		transform: translateY(100%);
		opacity: 0;
	}

	@media (max-width: 720px) {
		.perm-split {
			grid-template-columns: 1fr;
		}
		.targets-pane {
			border-right: none;
			border-bottom: 1px solid var(--border);
			max-height: 220px;
		}
	}
</style>
