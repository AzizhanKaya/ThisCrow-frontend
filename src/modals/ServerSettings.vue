<script setup lang="ts">
	import { ref, onMounted, computed, reactive, watch } from 'vue';
	import { useModalStore } from '@/stores/modal';
	import { useServerStore } from '@/stores/server';
	import { getGroupInvitations, deleteInvitation, type Invitation } from '@/api/invite';
	import { Permissions, type Role } from '@/types';
	import { Icon } from '@iconify/vue';
	import { useFiles } from '@/composables/useFiles';
	import { useErrorStore } from '@/stores/error';

	const modalStore = useModalStore();
	const serverStore = useServerStore();
	const errorStore = useErrorStore();
	const { uploadFiles } = useFiles();

	const activeTab = ref('general');
	const server_id = modalStore.data?.server_id;
	const server = computed(() => serverStore.getServerById(server_id));

	/* ───── Permission definitions ───── */
	const PERMISSION_FLAGS = [
		{ label: 'Administrator', bit: Permissions.ADMINISTRATOR, description: 'Full access to everything', category: 'Core' },
		{ label: 'View Audit Log', bit: Permissions.VIEW_AUDIT_LOG, description: 'View the server audit log', category: 'Core' },
		{ label: 'Manage Server', bit: Permissions.MANAGE_GROUP, description: 'Change name, icon and description', category: 'Core' },
		{ label: 'Manage Roles', bit: Permissions.MANAGE_ROLES, description: 'Create, edit and delete roles', category: 'Core' },
		{
			label: 'Manage Channels',
			bit: Permissions.MANAGE_CHANNELS,
			description: 'Create, edit and delete channels',
			category: 'Core',
		},
		{ label: 'Kick Members', bit: Permissions.KICK_MEMBERS, description: 'Kick members from the server', category: 'Core' },
		{ label: 'Ban Members', bit: Permissions.BAN_MEMBERS, description: 'Permanently ban members', category: 'Core' },
		{ label: 'Create Invite', bit: Permissions.CREATE_INVITE, description: 'Create invite links', category: 'Core' },
		{ label: 'Delete Invite', bit: Permissions.DELETE_INVITE, description: 'Revoke invite links', category: 'Core' },
		{ label: 'View Channels', bit: Permissions.VIEW_CHANNEL, description: 'View text and voice channels', category: 'Text' },
		{ label: 'View Messages', bit: Permissions.VIEW_MESSAGES, description: 'Read messages in channels', category: 'Text' },
		{ label: 'Send Messages', bit: Permissions.SEND_MESSAGE, description: 'Send messages in channels', category: 'Text' },
		{ label: 'Send TTS', bit: Permissions.SEND_TTS_MESSAGES, description: 'Send text-to-speech messages', category: 'Text' },
		{ label: 'Manage Messages', bit: Permissions.MANAGE_MESSAGES, description: 'Delete and pin messages', category: 'Text' },
		{ label: 'Embed Links', bit: Permissions.EMBED_LINKS, description: 'Post embedded links', category: 'Text' },
		{ label: 'Attach Files', bit: Permissions.ATTACH_FILES, description: 'Upload files and media', category: 'Text' },
		{ label: 'Read History', bit: Permissions.READ_MESSAGE_HISTORY, description: 'Read previous messages', category: 'Text' },
		{ label: 'Mention Everyone', bit: Permissions.MENTION_EVERYONE, description: 'Use @everyone mentions', category: 'Text' },
		{ label: 'Connect', bit: Permissions.CONNECT, description: 'Connect to voice channels', category: 'Voice' },
		{ label: 'Speak', bit: Permissions.SPEAK, description: 'Speak in voice channels', category: 'Voice' },
		{ label: 'Mute Members', bit: Permissions.MUTE_MEMBERS, description: 'Mute other members', category: 'Voice' },
		{ label: 'Deafen Members', bit: Permissions.DEAFEN_MEMBERS, description: 'Deafen other members', category: 'Voice' },
		{ label: 'Move Members', bit: Permissions.MOVE_MEMBERS, description: 'Move members between channels', category: 'Voice' },
	];

	const permissionCategories = computed(() => {
		const cats: Record<string, typeof PERMISSION_FLAGS> = {};
		for (const p of PERMISSION_FLAGS) {
			if (!cats[p.category]) cats[p.category] = [];
			cats[p.category].push(p);
		}
		return cats;
	});

	/* ───── General tab ───── */
	const serverName = ref('');
	const serverDescription = ref('');
	const serverIcon = ref('');
	const serverIconPreview = ref<string | null>(null);
	const iconFileInput = ref<HTMLInputElement | null>(null);
	const isUploadingIcon = ref(false);
	const isSaving = ref(false);

	const triggerIconUpload = () => {
		iconFileInput.value?.click();
	};

	const handleIconUpload = async (event: Event) => {
		const files = (event.target as HTMLInputElement).files;
		if (!files || !files[0]) return;

		const file = files[0];
		serverIconPreview.value = URL.createObjectURL(file);

		isUploadingIcon.value = true;
		try {
			const uploaded = await uploadFiles([file], 'icon');
			if (uploaded.length > 0) {
				serverIcon.value = uploaded[0].url;
			}
		} catch (e) {
			console.error('Icon upload failed:', e);
			errorStore.pushFrom(e, 'Icon upload failed.');
			serverIconPreview.value = serverIcon.value || null;
		} finally {
			isUploadingIcon.value = false;
			if (iconFileInput.value) iconFileInput.value.value = '';
		}
	};

	const hasGeneralChanges = computed(() => {
		if (!server.value) return false;
		return (
			serverName.value !== server.value.name ||
			serverDescription.value !== (server.value.description || '') ||
			serverIcon.value !== (server.value.icon || '')
		);
	});

	/* ───── Roles tab ───── */
	const roles = computed(() => {
		if (!server.value?.roles) return [];
		return Array.from(server.value.roles.values()).sort((a, b) => a.position - b.position);
	});
	const selectedRoleId = ref<number | null>(null);
	const selectedRole = computed(() => roles.value.find((r) => r.id === selectedRoleId.value) ?? null);
	const editRoleName = ref('');
	const editRoleColor = ref('#5865f2');
	const editRolePermissions = ref(0);

	const newRoleColor = ref('#5865f2');

	const hasRoleChanges = computed(() => {
		if (!selectedRole.value) return false;
		return (
			editRoleName.value !== selectedRole.value.name ||
			editRoleColor.value !== selectedRole.value.color ||
			editRolePermissions.value !== (selectedRole.value.permissions ?? 0)
		);
	});

	watch(selectedRole, (role) => {
		if (role) {
			editRoleName.value = role.name;
			editRoleColor.value = role.color;
			editRolePermissions.value = role.permissions ?? 0;
		}
	});

	function hasPermission(bit: number) {
		return (editRolePermissions.value & bit) !== 0;
	}

	function togglePermission(bit: number) {
		editRolePermissions.value ^= bit;
	}

	/* ───── Invites tab ───── */
	const invites = ref<Invitation[]>([]);
	const isLoadingInvites = ref(false);

	/* ───── Lifecycle ───── */
	onMounted(async () => {
		if (server.value) {
			serverName.value = server.value.name;
			serverDescription.value = server.value.description || '';
			serverIcon.value = server.value.icon || '';
			serverIconPreview.value = server.value.icon || null;
		}
		if (server_id) await loadInvites();
	});

	/* ───── Actions ───── */
	async function loadInvites() {
		if (!server_id) return;
		isLoadingInvites.value = true;
		try {
			invites.value = await getGroupInvitations(server_id);
		} catch (e) {
			console.error('Failed to fetch invites', e);
		} finally {
			isLoadingInvites.value = false;
		}
	}

	async function saveGeneralSettings() {
		if (!server_id) return;
		isSaving.value = true;
		try {
			await serverStore.updateServer(server_id, serverName.value, serverDescription.value, serverIcon.value || undefined);
		} finally {
			isSaving.value = false;
		}
	}

	async function createNewRole() {
		if (!server_id) return;
		const baseName = 'New Role';
		const existing = roles.value.map((r) => r.name);
		let name = baseName;
		let i = 2;
		while (existing.includes(name)) {
			name = `${baseName} ${i++}`;
		}
		await serverStore.createRole(server_id, name, newRoleColor.value, 0);
		newRoleColor.value = '#5865f2';
	}

	async function saveRole() {
		if (!server_id || !selectedRoleId.value) return;
		await serverStore.updateRole(
			server_id,
			selectedRoleId.value,
			editRoleName.value,
			undefined,
			editRoleColor.value,
			editRolePermissions.value
		);
	}

	async function removeRole(role_id: number) {
		if (!server_id) return;
		await serverStore.deleteRole(server_id, role_id);
		if (selectedRoleId.value === role_id) selectedRoleId.value = null;
	}

	async function removeInvite(id: number) {
		try {
			await deleteInvitation(id);
			await loadInvites();
		} catch (e) {
			console.error('Failed to delete invite', e);
			errorStore.pushFrom(e, 'Failed to delete invite.');
		}
	}

	function timeRemaining(expires_at: string) {
		const diff = new Date(expires_at).getTime() - Date.now();
		if (diff <= 0) return 'Expired';
		const d = Math.floor(diff / 86400000);
		if (d > 0) return `${d}d left`;
		const h = Math.floor(diff / 3600000);
		if (h > 0) return `${h}h left`;
		return `${Math.floor(diff / 60000)}m left`;
	}

	function close() {
		modalStore.closeModal();
	}
</script>

<template>
	<div class="modal-backdrop" @click="close">
		<div class="settings-root" @click.stop>
			<!-- Sidebar -->
			<aside class="settings-sidebar">
				<div class="sidebar-label">{{ server?.name }}</div>
				<nav class="sidebar-nav">
					<button :class="{ active: activeTab === 'general' }" @click="activeTab = 'general'">
						<Icon icon="mdi:cog" class="nav-icon" /> Overview
					</button>
					<button :class="{ active: activeTab === 'roles' }" @click="activeTab = 'roles'">
						<Icon icon="mdi:shield-account" class="nav-icon" /> Roles
					</button>
					<button :class="{ active: activeTab === 'invites' }" @click="activeTab = 'invites'">
						<Icon icon="mdi:link-variant" class="nav-icon" /> Invites
					</button>
				</nav>
			</aside>

			<!-- Content panel -->
			<main class="settings-main">
				<button class="close-btn" @click="close">
					<Icon icon="mdi:close" />
				</button>

				<!-- ─── GENERAL TAB ─── -->
				<div v-if="activeTab === 'general'" class="content-scroll" key="general">
					<h2 class="content-title">Server Overview</h2>

					<div class="input-group">
						<label>ICON</label>
						<div class="icon-upload-row">
							<div class="icon-upload-preview" @click="triggerIconUpload">
								<img v-if="serverIconPreview" :src="serverIconPreview" class="preview-img" />
								<div v-else class="preview-placeholder">
									<Icon icon="mdi:camera-plus" class="camera-icon" />
								</div>
								<div v-if="isUploadingIcon" class="icon-hover-overlay" style="opacity: 1">
									<Icon icon="eos-icons:loading" class="spin" />
								</div>
								<div v-else-if="serverIconPreview" class="icon-hover-overlay">
									<Icon icon="mdi:image-edit" />
								</div>
							</div>
						</div>
						<input type="file" accept="image/*" ref="iconFileInput" @change="handleIconUpload" hidden />
					</div>

					<div class="input-group">
						<label>SERVER NAME <span class="req">*</span></label>
						<div class="input-wrapper">
							<input type="text" v-model="serverName" />
						</div>
					</div>

					<div class="input-group">
						<label>DESCRIPTION</label>
						<div class="input-wrapper textarea-wrapper">
							<textarea v-model="serverDescription" rows="4"></textarea>
						</div>
					</div>
				</div>

				<!-- ─── ROLES TAB ─── -->
				<div v-if="activeTab === 'roles'" class="roles-split" key="roles">
					<!-- Left: role list -->
					<div class="roles-list-pane">
						<div class="section-label">ROLES — {{ roles.length }}</div>

						<div class="role-list">
							<div
								v-for="role in roles"
								:key="role.id"
								class="role-row"
								:class="{ selected: role.id === selectedRoleId }"
								@click="selectedRoleId = role.id"
							>
								<div class="role-dot" :style="{ backgroundColor: role.color }"></div>
								<span class="role-name">{{ role.name }}</span>
								<button class="icon-btn danger" @click.stop="removeRole(role.id)" title="Delete">
									<Icon icon="mdi:trash-can-outline" />
								</button>
							</div>
						</div>

						<button class="new-role-btn" @click="createNewRole"><Icon icon="mdi:plus" /> New Role</button>
					</div>

					<!-- Right: role editor -->
					<div class="roles-editor-pane">
						<template v-if="selectedRole">
							<div class="role-header">
								<div class="color-pick">
									<div class="color-preview" :style="{ backgroundColor: editRoleColor }"></div>
									<input type="color" v-model="editRoleColor" class="color-input-hidden" />
								</div>
								<div class="input-group flex-1" style="margin-bottom: 0">
									<label>ROLE NAME</label>
									<div class="input-wrapper">
										<input type="text" v-model="editRoleName" />
									</div>
								</div>
							</div>

							<div class="perm-section" v-for="(perms, cat) in permissionCategories" :key="cat">
								<div class="perm-cat-label">{{ cat }}</div>
								<div class="perm-grid">
									<div v-for="p in perms" :key="p.bit" class="perm-item" @click="togglePermission(p.bit)">
										<div class="perm-info">
											<span class="perm-label">{{ p.label }}</span>
											<span class="perm-desc">{{ p.description }}</span>
										</div>
										<div class="perm-toggle" :class="{ on: hasPermission(p.bit) }">
											<div class="toggle-knob"></div>
										</div>
									</div>
								</div>
							</div>
						</template>

						<div v-else class="empty-state">
							<Icon icon="mdi:shield-edit-outline" class="empty-icon" />
							<span>Select a role to edit permissions</span>
						</div>
					</div>
				</div>

				<!-- ─── INVITES TAB ─── -->
				<div v-if="activeTab === 'invites'" class="content-scroll" key="invites">
					<h2 class="content-title">Invites</h2>

					<div v-if="isLoadingInvites" class="empty-state">
						<Icon icon="mdi:loading" class="spin empty-icon" />
						<span>Loading…</span>
					</div>

					<div v-else-if="invites.length === 0" class="empty-state">
						<Icon icon="mdi:link-off" class="empty-icon" />
						<span>No active invites</span>
					</div>

					<div v-else class="invite-list">
						<div v-for="inv in invites" :key="inv.id" class="invite-row">
							<div class="invite-info">
								<span class="invite-code">{{ inv.code }}</span>
								<div class="invite-meta">
									<span><Icon icon="mdi:account-group" class="meta-icon" />{{ inv.uses }} / {{ inv.max_uses || '∞' }}</span>
									<span><Icon icon="mdi:clock-outline" class="meta-icon" />{{ timeRemaining(inv.expires_at) }}</span>
								</div>
							</div>
							<button class="icon-btn danger" @click="removeInvite(inv.id)" title="Revoke">
								<Icon icon="mdi:close-circle-outline" />
							</button>
						</div>
					</div>
				</div>

				<!-- ─── Floating save bar ─── -->
				<Transition name="save-bar">
					<div v-if="(activeTab === 'general' && hasGeneralChanges) || (activeTab === 'roles' && hasRoleChanges)" class="save-bar">
						<button class="btn-primary" :disabled="isSaving" @click="activeTab === 'general' ? saveGeneralSettings() : saveRole()">
							<Icon v-if="isSaving" icon="mdi:loading" class="spin" />
							<span v-else>Save Changes</span>
						</button>
					</div>
				</Transition>
			</main>
		</div>
	</div>
</template>

<style scoped>
	/* ─── Root layout ─── */
	.settings-root {
		display: flex;
		width: 1060px;
		max-width: 95vw;
		height: 720px;
		max-height: 90vh;
		border-radius: 12px;
		overflow: hidden;
		background-color: var(--bg);
		border: 1px solid var(--border);
		box-shadow: 0 12px 40px rgba(0, 0, 0, 0.55);
	}

	/* ─── Sidebar ─── */
	.settings-sidebar {
		width: 220px;
		flex-shrink: 0;
		background-color: var(--bg-dark);
		border-right: 1px solid var(--border);
		display: flex;
		flex-direction: column;
		padding: 24px 12px;
	}

	.sidebar-label {
		font-size: 0.7rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.6px;
		color: var(--text-muted);
		padding: 0 10px 20px;
		border-bottom: 1px solid var(--border);
		margin-bottom: 12px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.sidebar-nav {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.sidebar-nav button {
		display: flex;
		align-items: center;
		gap: 10px;
		background: transparent;
		border: none;
		color: var(--text-muted);
		text-align: left;
		padding: 9px 12px;
		border-radius: 6px;
		font-size: 0.9rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.15s;
	}

	.sidebar-nav button:hover {
		background-color: var(--bg-light);
		color: var(--text);
	}

	.sidebar-nav button.active {
		background-color: rgba(114, 137, 218, 0.15);
		color: var(--color-lighter);
	}

	.nav-icon {
		font-size: 1.1rem;
		flex-shrink: 0;
	}

	/* ─── Main content area ─── */
	.settings-main {
		flex: 1;
		display: flex;
		flex-direction: column;
		position: relative;
		overflow: hidden;
	}

	.content-scroll {
		flex: 1;
		overflow-y: auto;
		padding: 32px 40px 40px;
	}

	.content-title {
		font-size: 1.3rem;
		font-weight: 700;
		color: var(--text);
		margin: 0 0 24px;
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

	/* ─── Form elements ─── */
	.input-group {
		display: flex;
		flex-direction: column;
		margin-bottom: 20px;
	}

	.input-group label {
		font-size: 0.72rem;
		font-weight: 700;
		color: var(--text-muted);
		margin-bottom: 8px;
		letter-spacing: 0.3px;
	}

	.req {
		color: var(--danger, #f23f42);
	}

	.input-wrapper {
		background-color: var(--bg-dark);
		border: 1px solid var(--border-muted);
		border-radius: 8px;
		padding: 0 14px;
		display: flex;
		align-items: center;
		transition:
			border-color 0.2s,
			box-shadow 0.2s;
	}

	.input-wrapper:focus-within {
		border-color: var(--color);
		box-shadow: 0 0 0 2px rgba(114, 137, 218, 0.12);
	}

	.input-wrapper input {
		width: 100%;
		padding: 12px 0;
		background: transparent;
		border: none;
		color: var(--text);
		font-size: 15px;
		outline: none;
	}

	.textarea-wrapper {
		padding: 0;
	}

	.textarea-wrapper textarea {
		width: 100%;
		padding: 12px 14px;
		background: transparent;
		border: none;
		color: var(--text);
		font-size: 15px;
		outline: none;
		resize: none;
	}

	.action-divider {
		padding-top: 20px;
		border-top: 1px solid var(--border);
		margin-top: 8px;
		display: flex;
	}

	.btn-primary {
		background-color: var(--color);
		color: white;
		border: none;
		padding: 10px 24px;
		border-radius: 6px;
		font-weight: 600;
		font-size: 0.9rem;
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

	.btn-primary.sm {
		padding: 8px 16px;
		font-size: 0.85rem;
	}

	/* ─── Roles tab ─── */
	.roles-split {
		display: flex;
		flex: 1;
		overflow: hidden;
	}

	.roles-list-pane {
		width: 220px;
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		padding: 24px 16px;
		border-right: 1px solid var(--border);
		overflow-y: auto;
	}

	.roles-editor-pane {
		flex: 1;
		overflow-y: auto;
		padding: 28px 36px 36px;
	}

	.flex-1 {
		flex: 1;
	}

	/* Color picker */
	.color-pick {
		position: relative;
		cursor: pointer;
		flex-shrink: 0;
	}

	.color-preview {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		border: 2px solid var(--border);
		transition:
			border-color 0.2s,
			transform 0.2s;
	}

	.color-pick:hover .color-preview {
		border-color: var(--color);
		transform: scale(1.08);
	}

	.color-input-hidden {
		position: absolute;
		inset: 0;
		opacity: 0;
		cursor: pointer;
		width: 100%;
		height: 100%;
	}

	.section-label {
		font-size: 0.7rem;
		font-weight: 800;
		color: var(--text-muted);
		letter-spacing: 0.5px;
		margin-bottom: 10px;
	}

	.role-list {
		display: flex;
		flex-direction: column;
		gap: 2px;
		flex: 1;
	}

	.role-row {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 9px 10px;
		border-radius: 6px;
		cursor: pointer;
		transition: all 0.15s;
		color: var(--text-muted);
	}

	.role-row:hover {
		background-color: var(--bg-light);
		color: var(--text);
	}

	.role-row.selected {
		background-color: rgba(114, 137, 218, 0.12);
		color: var(--text);
	}

	.role-dot {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.role-name {
		flex: 1;
		font-size: 0.85rem;
		font-weight: 600;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.new-role-btn {
		margin-top: 8px;
		width: 100%;
		padding: 9px 0;
		background: transparent;
		border: 1px dashed var(--border);
		border-radius: 6px;
		color: var(--text-muted);
		font-size: 0.82rem;
		font-weight: 600;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		transition: all 0.15s;
		flex-shrink: 0;
	}

	.new-role-btn:hover {
		background-color: var(--bg-light);
		border-color: var(--color);
		color: var(--color);
	}

	.icon-btn {
		background: none;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		font-size: 1rem;
		width: 26px;
		height: 26px;
		border-radius: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.15s;
		flex-shrink: 0;
		opacity: 0;
	}

	.role-row:hover .icon-btn,
	.invite-row:hover .icon-btn {
		opacity: 1;
	}

	.icon-btn.danger:hover {
		color: var(--danger, #f23f42);
		background-color: rgba(242, 63, 66, 0.1);
	}

	/* Role editor header */
	.role-header {
		display: flex;
		align-items: center;
		gap: 16px;
		padding-bottom: 20px;
	}

	/* ─── Permission toggles ─── */
	.perm-section {
		margin-bottom: 24px;
	}

	.perm-cat-label {
		font-size: 0.72rem;
		font-weight: 800;
		color: var(--text-muted);
		letter-spacing: 0.5px;
		margin-bottom: 12px;
		padding-top: 16px;
		border-top: 1px solid var(--border);
	}

	.perm-section:first-of-type .perm-cat-label {
		border-top: none;
		padding-top: 0;
	}

	.perm-grid {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.perm-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		padding: 12px 14px;
		border-radius: 8px;
		cursor: pointer;
		transition: background 0.15s;
	}

	.perm-item:hover {
		background-color: var(--bg-dark);
	}

	.perm-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.perm-toggle {
		width: 42px;
		height: 24px;
		border-radius: 12px;
		background-color: var(--border-muted);
		position: relative;
		flex-shrink: 0;
		transition: background-color 0.25s;
	}

	.perm-toggle.on {
		background-color: var(--color);
	}

	.toggle-knob {
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background-color: white;
		position: absolute;
		top: 3px;
		left: 3px;
		transition: transform 0.25s;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
	}

	.perm-toggle.on .toggle-knob {
		transform: translateX(18px);
	}

	.perm-label {
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--text);
	}

	.perm-desc {
		font-size: 0.75rem;
		color: var(--text-muted);
		line-height: 1.3;
	}

	/* ─── Invite list ─── */
	.invite-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.invite-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 14px 16px;
		background-color: var(--bg-dark);
		border: 1px solid var(--border);
		border-radius: 8px;
		transition: background 0.15s;
	}

	.invite-row:hover {
		background-color: var(--bg-light);
	}

	.invite-info {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.invite-code {
		font-family: monospace;
		font-weight: 700;
		font-size: 1rem;
		color: var(--text);
		letter-spacing: 0.5px;
	}

	.invite-meta {
		display: flex;
		gap: 16px;
		font-size: 0.78rem;
		color: var(--text-muted);
	}

	.meta-icon {
		vertical-align: -2px;
		margin-right: 3px;
		font-size: 0.85rem;
	}

	/* ─── Empty state ─── */
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 40px 20px;
		color: var(--text-muted);
		text-align: center;
		gap: 8px;
	}

	.empty-icon {
		font-size: 2.5rem;
		opacity: 0.4;
	}

	/* ─── Icon upload ─── */
	.icon-upload-row {
		display: flex;
		align-items: center;
		gap: 16px;
	}

	.icon-upload-preview {
		width: 64px;
		height: 64px;
		border-radius: 50%;
		background-color: var(--bg-dark);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		position: relative;
		overflow: hidden;
		flex-shrink: 0;
		border: 2px solid var(--border);
		transition: border-color 0.2s;
	}

	.icon-upload-preview .preview-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		border-radius: 50%;
	}

	.icon-upload-preview .preview-placeholder {
		color: var(--text-muted);
	}

	.icon-upload-preview .camera-icon {
		font-size: 24px;
	}

	.icon-hover-overlay {
		position: absolute;

		background-color: rgba(0, 0, 0, 0.6);
		display: flex;
		align-items: center;
		justify-content: center;
		color: white;
		font-size: 20px;
		opacity: 0;
		transition: opacity 0.2s;
		border-radius: 50%;
	}

	.icon-upload-preview:hover .icon-hover-overlay {
		opacity: 1;
	}

	/* ─── Utility ─── */
	.spin {
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		100% {
			transform: rotate(360deg);
		}
	}

	/* ─── Floating save bar ─── */
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

	.save-bar-text {
		font-size: 0.85rem;
		color: var(--text-muted);
		font-weight: 500;
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
</style>
