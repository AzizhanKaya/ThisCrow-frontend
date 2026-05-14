<script setup lang="ts">
	import { ref, computed, watch } from 'vue';
	import { useServerStore } from '@/stores/server';
	import { Icon } from '@iconify/vue';
	import draggable from 'vuedraggable';
	import type { Role, id } from '@/types';
	import { Permissions } from '@/types';

	const props = defineProps<{
		serverId: id;
	}>();

	const serverStore = useServerStore();

	const server = computed(() => serverStore.getServerById(props.serverId));

	const PERMISSION_FLAGS = [
		{ label: 'Administrator', bit: Permissions.ADMINISTRATOR, description: 'Full access to everything', category: 'Core' },
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

	const isDragging = ref(false);
	const roleList = ref<Role[]>([]);

	const everyoneRole = computed<Role>(() => ({
		id: 0,
		name: 'everyone',
		color: '#ffffff',
		position: -1,
		permissions: server.value?.everyone ?? 0,
	}));

	const roles = computed<Role[]>(() => [...roleList.value, everyoneRole.value]);

	watch(
		() => (server.value?.roles ? Array.from(server.value.roles.keys()).sort().join(',') : ''),
		() => {
			if (isDragging.value) return;
			roleList.value = server.value?.roles ? Array.from(server.value.roles.values()).sort((a, b) => b.position - a.position) : [];
		},
		{ immediate: true }
	);

	function onRoleDragEnd() {
		isDragging.value = false;
		if (!props.serverId) return;

		const total = roleList.value.length;
		roleList.value.forEach((role, idx) => {
			const newPos = total - idx;
			const target = server.value?.roles?.get(role.id);
			if (!target) return;
			if (target.position !== newPos) {
				target.position = newPos;
				serverStore.updateRole(props.serverId, role.id, { position: newPos });
			}
		});
	}

	const selectedRoleId = ref<number | null>(null);
	const selectedRole = computed(() => roles.value.find((r) => r.id === selectedRoleId.value) ?? null);
	const editRoleName = ref('');
	const editRoleColor = ref('#5865f2');
	const editRolePermissions = ref(0);

	const newRoleColor = ref('#5865f2');

	const isEveryoneSelected = computed(() => selectedRoleId.value === 0);

	const hasRoleChanges = computed(() => {
		if (!selectedRole.value) return false;
		if (isEveryoneSelected.value) {
			return editRolePermissions.value !== (selectedRole.value.permissions ?? 0);
		}
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

	const isSaving = ref(false);

	async function createNewRole() {
		if (!props.serverId) return;
		const baseName = 'New Role';
		const existing = roles.value.map((r) => r.name);
		let name = baseName;
		let i = 2;
		while (existing.includes(name)) {
			name = `${baseName} ${i++}`;
		}
		await serverStore.createRole(props.serverId, name, newRoleColor.value, 0);
		newRoleColor.value = '#5865f2';
	}

	async function saveRole() {
		if (!props.serverId || selectedRoleId.value === null || !selectedRole.value) return;
		const role = selectedRole.value;
		const fields: { name?: string; color?: string; permissions?: number } = {};

		if (isEveryoneSelected.value) {
			if (editRolePermissions.value !== (role.permissions ?? 0)) {
				fields.permissions = editRolePermissions.value;
			}
		} else {
			if (editRoleName.value !== role.name) fields.name = editRoleName.value;
			if (editRoleColor.value !== role.color) fields.color = editRoleColor.value;
			if (editRolePermissions.value !== (role.permissions ?? 0)) fields.permissions = editRolePermissions.value;
		}

		if (Object.keys(fields).length === 0) return;

		isSaving.value = true;
		try {
			await serverStore.updateRole(props.serverId, selectedRoleId.value, fields);
		} finally {
			isSaving.value = false;
		}
	}

	async function removeRole(role_id: number) {
		if (!props.serverId) return;
		await serverStore.deleteRole(props.serverId, role_id);
		if (selectedRoleId.value === role_id) selectedRoleId.value = null;
	}
</script>

<template>
	<div class="roles-split">
		<!-- Left: role list -->
		<div class="roles-list-pane">
			<div class="section-label">ROLES — {{ roles.length }}</div>

			<div class="role-list" :class="{ 'is-dragging': isDragging }">
				<draggable
					v-model="roleList"
					item-key="id"
					tag="div"
					class="draggable-zone"
					ghost-class="ghost-role"
					:animation="200"
					@start="isDragging = true"
					@end="onRoleDragEnd"
				>
					<template #item="{ element: role }">
						<div class="role-row" :class="{ selected: role.id === selectedRoleId }" @click="selectedRoleId = role.id">
							<div class="role-dot" :style="{ backgroundColor: role.color || 'var(--border)' }"></div>
							<span class="role-name">{{ role.name }}</span>
							<button class="icon-btn danger" @click.stop="removeRole(role.id)" title="Delete">
								<Icon icon="mdi:trash-can-outline" />
							</button>
						</div>
					</template>
				</draggable>
				<div class="role-row everyone-row" :class="{ selected: 0 === selectedRoleId }" @click="selectedRoleId = 0">
					<div class="role-dot" :style="{ backgroundColor: '#ffffff' }"></div>
					<span class="role-name">everyone</span>
				</div>
			</div>

			<button class="new-role-btn" @click="createNewRole"><Icon icon="mdi:plus" /> New Role</button>
		</div>

		<!-- Right: role editor -->
		<div class="roles-editor-pane">
			<template v-if="selectedRole">
				<div class="role-header" v-if="!isEveryoneSelected">
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
				<div class="role-header" v-else>
					<div class="input-group flex-1" style="margin-bottom: 0">
						<label>ROLE NAME</label>
						<div class="input-wrapper">
							<input type="text" value="everyone" disabled />
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

		<Transition name="save-bar">
			<div v-if="hasRoleChanges" class="save-bar">
				<button class="btn-primary" :disabled="isSaving" @click="saveRole()">
					<Icon v-if="isSaving" icon="mdi:loading" class="spin" />
					<span v-else>Save Changes</span>
				</button>
			</div>
		</Transition>
	</div>
</template>

<style scoped>
	.roles-split {
		display: flex;
		flex: 1;
		overflow: hidden;
		height: 100%;
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
		position: relative;
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

	.draggable-zone {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.role-row {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 4px 10px;
		min-height: 32px;
		border-radius: 6px;
		cursor: grab;
		transition:
			background-color 0.15s,
			color 0.15s;
		color: var(--text-muted);
		-webkit-user-drag: element;
	}

	.role-row .icon-btn {
		width: 22px;
		height: 22px;
		font-size: 0.9rem;
	}

	.role-row:active {
		cursor: grabbing;
	}

	.role-row.everyone-row {
		cursor: pointer;
		-webkit-user-drag: none;
	}

	.role-list.is-dragging,
	.role-list.is-dragging * {
		cursor: grabbing !important;
	}

	.ghost-role {
		position: relative !important;
		height: 36px !important;
		min-height: 0 !important;
		margin: 0 !important;
		padding: 0 !important;
		background: transparent !important;
		border: none !important;
		overflow: visible !important;
		opacity: 1 !important;
	}

	.ghost-role > * {
		display: none !important;
	}

	.ghost-role::before {
		content: '';
		position: absolute;
		top: calc(50% - 2px);
		left: 4px;
		right: 4px;
		height: 4px;
		border-radius: 2px;
		background-color: var(--color, #5865f2);
		box-shadow: 0 0 8px var(--color, #5865f2);
	}

	.drag-role {
		width: 188px !important;
		box-sizing: border-box !important;
		background-color: var(--bg-light) !important;
		color: var(--text) !important;
		box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3) !important;
		border-radius: 6px !important;
		opacity: 0.95 !important;
	}

	.drag-role .icon-btn {
		opacity: 0 !important;
	}

	.role-list:not(.is-dragging) .role-row:hover {
		background-color: var(--bg-lighter);
		color: var(--text);
	}

	.role-row.selected {
		background-color: var(--bg-light);
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
		margin-top: 12px;
		width: 100%;
		padding: 9px 0;
		background-color: var(--color);
		border: none;
		border-radius: 6px;
		color: #fff;
		font-size: 0.85rem;
		font-weight: 600;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		transition:
			background-color 0.15s,
			transform 0.1s;
		flex-shrink: 0;
	}

	.new-role-btn:hover {
		background-color: var(--color-light, var(--color));
		filter: brightness(1.1);
	}

	.new-role-btn:active {
		transform: translateY(1px);
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

	.role-list:not(.is-dragging) .role-row:hover .icon-btn {
		opacity: 1;
	}

	.icon-btn.danger:hover {
		color: var(--danger, #f23f42);
		background-color: rgba(242, 63, 66, 0.1);
	}

	.role-header {
		display: flex;
		align-items: center;
		gap: 16px;
		padding-bottom: 20px;
	}

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

	.spin {
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		100% {
			transform: rotate(360deg);
		}
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
