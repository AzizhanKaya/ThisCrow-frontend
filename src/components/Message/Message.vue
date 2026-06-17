<script setup lang="ts">
	import { computed, type PropType, ref, onBeforeUnmount, watch, nextTick } from 'vue';
	import { computedAsync } from '@vueuse/core';
	import type { CallData, Message, MessageData, MultiData, ReplyData, User, id, snowflake_id } from '@/types';
	import { Icon } from '@iconify/vue';
	import { get_timestamp_from_snowflake, is_sent_from_snowflake, snowflake_to_date } from '@/utils/snowflake';
	import { decrypt_message } from '@/../pkg/wasm_lib';
	import { decode } from '@/utils/msgpack';
	import { getDefaultAvatar } from '@/utils/avatar';
	import { summarizeMessageData, type MessageSummary } from '@/utils/messagePreview';
	import { useUserStore } from '@/stores/user';
	import { useMessageStore, type ChatTarget } from '@/stores/message';
	import { useMeStore } from '@/stores/me';
	import { useProfileCardStore } from '@/stores/profileCard';

	const props = defineProps({
		message: {
			type: Object as PropType<Message>,
			required: true,
		},
		user: {
			type: Object as PropType<User>,
			required: false,
		},
		privateKey: {
			type: Object as PropType<Uint8Array | null | undefined>,
			required: false,
		},
		color: {
			type: String,
			required: false,
		},
		editing: {
			type: Boolean,
			default: false,
		},
		editText: {
			type: String,
			default: '',
		},
		isSavingEdit: {
			type: Boolean,
			default: false,
		},
	});

	const emit = defineEmits<{
		(e: 'scroll-to', id: snowflake_id): void;
		(e: 'toggle-reaction', emoji: string): void;
		(e: 'update:editText', value: string): void;
		(e: 'save-edit'): void;
		(e: 'cancel-edit'): void;
	}>();

	const userStore = useUserStore();
	const messageStore = useMessageStore();
	const meStore = useMeStore();
	const profileCardStore = useProfileCardStore();

	const displayUser = $computed(() => {
		if (props.user) return props.user;
		if (replyData) return userStore.users.get(props.message.from);
		return undefined;
	});

	const message = $computed(() => {
		if (props.privateKey === undefined) return;

		const data = props.message.data;
		if (typeof data !== 'object' || !('cipher' in data) || !props.privateKey) {
			return props.message;
		}

		try {
			const decrypted = decrypt_message(props.privateKey, data.cipher, data.nonce);
			const decoded = decode(decrypted) as MessageData;

			return { ...props.message, data: decoded } as Message;
		} catch (e) {
			console.error('Failed to decrypt message:', props.privateKey);
			return props.message;
		}
	});

	const callData = $computed<CallData | undefined>(() => {
		const data = message?.data;
		if (data && typeof data === 'object' && 'end_time' in data) {
			return data as CallData;
		}
		return undefined;
	});

	const replyData = $computed<ReplyData | undefined>(() => {
		const data = message?.data;
		if (data && typeof data === 'object' && 'replied' in data && 'data' in data) {
			return data as ReplyData;
		}
		return undefined;
	});

	const multiData = $computed<MultiData | undefined>(() => {
		if (replyData) return replyData.data;
		const data = message?.data;
		if (data && typeof data === 'object' && !('end_time' in data) && !('cipher' in data) && !('replied' in data)) {
			return data as MultiData;
		}
		return undefined;
	});

	const messageText = $computed<string | undefined>(() => {
		const data = message?.data;
		if (typeof data === 'string') {
			return data;
		}
		if (multiData?.text) {
			return multiData.text;
		}
		return undefined;
	});

	const formattedSegments = computed(() => {
		if (!messageText) return [];
		const urlRegex = /(https?:\/\/[^\s]+)/gi;
		const parts = messageText.split(urlRegex);
		const allowedLinks = multiData?.links || [];
		return parts.map((part) => {
			const isMatch = part.match(urlRegex);
			const isLink = !!(isMatch && allowedLinks.includes(part));
			if (isLink) {
				return {
					text: part,
					isLink: true,
					href: part,
				};
			}
			return {
				text: part,
				isLink: false,
			};
		});
	});

	const repliedPreview = $(
		computedAsync(async () => {
			if (!replyData) {
				return null;
			}

			const target: ChatTarget = props.message.group_id
				? { kind: 'channel', channel_id: props.message.to, group_id: props.message.group_id }
				: { kind: 'user', user_id: props.message.from === meStore.me!.id ? props.message.to : props.message.from };

			const original = await messageStore.findMessage(target, replyData.replied);
			if (!original) {
				return { user: undefined, snippet: { text: '(message unavailable)' } as MessageSummary };
			}
			return {
				user: userStore.users.get(original.from),
				snippet: summarizeMessageData(original.data, props.privateKey ?? undefined),
			};
		}, null)
	);

	function formatCallDuration(ms: number): string {
		const total = Math.max(0, Math.floor(ms / 1000));
		const h = Math.floor(total / 3600);
		const m = Math.floor((total % 3600) / 60);
		const s = total % 60;
		if (h > 0) return `${h}h ${m}m ${s}s`;
		if (m > 0) return `${m}m ${s}s`;
		return `${s}s`;
	}

	const now = ref(Date.now());
	let callTimer: ReturnType<typeof setInterval> | null = null;

	const callInfo = $computed(() => {
		if (!callData) return undefined;
		const startedAt = get_timestamp_from_snowflake(props.message.id);
		const ended = callData.end_time != null;
		const elapsedMs = ended ? (callData.end_time as number) - startedAt : now.value - startedAt;
		return {
			ended,
			duration: formatCallDuration(elapsedMs),
			outgoing: is_sent_from_snowflake(props.message.id),
		};
	});

	watch(
		() => callInfo?.ended,
		(ended) => {
			const ongoing = callInfo && !ended;
			if (ongoing && callTimer === null) {
				callTimer = setInterval(() => {
					now.value = Date.now();
				}, 1000);
			} else if (!ongoing && callTimer !== null) {
				clearInterval(callTimer);
				callTimer = null;
			}
		},
		{ immediate: true }
	);

	function onReplyClick() {
		if (replyData) emit('scroll-to', replyData.replied);
	}

	function openProfileCard(e: MouseEvent) {
		if (!displayUser) return;

		const target = e.currentTarget as HTMLElement;
		const rect = target.getBoundingClientRect();

		profileCardStore.open({
			target,
			x: rect.right + 10,
			y: rect.top,
			user: displayUser,
		});
	}

	const lightboxSrc = ref<string | null>(null);

	function openLightbox(src: string) {
		lightboxSrc.value = src;
	}

	function closeLightbox() {
		lightboxSrc.value = null;
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') closeLightbox();
	}

	watch(lightboxSrc, (src) => {
		if (src) {
			window.addEventListener('keydown', onKeydown);
			document.body.style.overflow = 'hidden';
		} else {
			window.removeEventListener('keydown', onKeydown);
			document.body.style.overflow = '';
		}
	});

	onBeforeUnmount(() => {
		window.removeEventListener('keydown', onKeydown);
		if (lightboxSrc.value) document.body.style.overflow = '';
		if (callTimer !== null) clearInterval(callTimer);
	});

	const editTextareaRef = ref<HTMLTextAreaElement | null>(null);

	watch(
		() => props.editing,
		async (editing) => {
			if (editing) {
				await nextTick();
				editTextareaRef.value?.focus();
			}
		}
	);

	function onEditKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			emit('save-edit');
		} else if (e.key === 'Escape') {
			e.preventDefault();
			emit('cancel-edit');
		}
	}

	const reactionsList = $computed(() => messageStore.getReactions(props.message.id));

	const groupedReactions = $computed(() => {
		const list = reactionsList;
		if (!list || list.length === 0) return [] as { emoji: string; count: number; mine: boolean; user_ids: id[] }[];
		const meId = meStore.me?.id;
		const map = new Map<string, { count: number; mine: boolean; user_ids: id[] }>();
		for (const r of list) {
			const entry = map.get(r.reaction) ?? { count: 0, mine: false, user_ids: [] };
			entry.count++;
			entry.user_ids.push(r.user_id);
			if (meId !== undefined && r.user_id === meId) entry.mine = true;
			map.set(r.reaction, entry);
		}
		return Array.from(map, ([emoji, v]) => ({ emoji, ...v }));
	});

	watch(
		() => reactionsList,
		(list) => {
			if (!list) return;
			const missing = list.map((r) => r.user_id).filter((uid) => !userStore.users.has(uid));
			if (missing.length > 0) userStore.getUsers(missing);
		},
		{ immediate: true }
	);

	function reactionTooltip(user_ids: id[]): string {
		return user_ids.map((uid) => userStore.users.get(uid)?.username ?? '…').join(', ');
	}

	watch(
		() => props.message.reacted === true && props.message.id,
		(shouldFetch) => {
			if (shouldFetch && !messageStore.getReactions(props.message.id)) {
				messageStore.loadReactions(props.message.id);
			}
		},
		{ immediate: true }
	);

	function fileExtension(name: string): string {
		const idx = name.lastIndexOf('.');
		return idx >= 0 ? name.slice(idx + 1).toLowerCase() : '';
	}

	function fileIcon(name: string): string {
		const ext = fileExtension(name);
		if (['pdf'].includes(ext)) return 'mdi:file-pdf-box';
		if (['doc', 'docx', 'odt', 'rtf'].includes(ext)) return 'mdi:file-word-box';
		if (['xls', 'xlsx', 'ods', 'csv'].includes(ext)) return 'mdi:file-excel-box';
		if (['ppt', 'pptx', 'odp'].includes(ext)) return 'mdi:file-powerpoint-box';
		if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'].includes(ext)) return 'mdi:folder-zip';
		if (['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac'].includes(ext)) return 'mdi:file-music';
		if (['mp4', 'mkv', 'mov', 'avi', 'webm', 'wmv'].includes(ext)) return 'mdi:file-video';
		if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'].includes(ext)) return 'mdi:file-image';
		if (
			[
				'js',
				'ts',
				'tsx',
				'jsx',
				'rs',
				'py',
				'go',
				'java',
				'c',
				'cpp',
				'h',
				'cs',
				'rb',
				'php',
				'sh',
				'json',
				'xml',
				'html',
				'css',
				'vue',
			].includes(ext)
		)
			return 'mdi:file-code';
		if (['txt', 'md', 'log'].includes(ext)) return 'mdi:file-document';
		return 'mdi:file';
	}
</script>

<template>
	<div class="message" :class="{ 'with-user': displayUser, 'has-reply': !!repliedPreview }">
		<div v-if="repliedPreview" class="reply-spine-area">
			<div class="reply-spine"></div>
		</div>
		<div v-if="repliedPreview" class="reply-preview" @click.stop="onReplyClick">
			<img
				v-if="repliedPreview.user"
				class="reply-avatar"
				:src="repliedPreview.user.avatar || getDefaultAvatar(repliedPreview.user.username)"
			/>
			<span v-if="repliedPreview.snippet.text" class="reply-preview-snippet">{{ repliedPreview.snippet.text }}</span>
			<Icon v-for="icon in repliedPreview.snippet.icons" :key="icon" :icon="icon" class="reply-preview-icon" />
		</div>

		<img
			v-if="displayUser && props.privateKey !== undefined"
			class="avatar"
			:src="displayUser.avatar || getDefaultAvatar(displayUser.username)"
			@click.stop="openProfileCard($event)"
		/>

		<div class="content">
			<div v-if="displayUser" class="message-header">
				<span class="name" :style="props.color ? { color: props.color } : undefined" @click.stop="openProfileCard($event)">{{
					displayUser.name
				}}</span>

				<span class="time-header">
					{{ snowflake_to_date(props.message.id).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }}
				</span>
			</div>

			<div class="data">
				<div v-if="callInfo" class="call-card" :class="{ ended: callInfo.ended, ongoing: !callInfo.ended }">
					<div class="call-icon">
						<Icon :icon="callInfo.ended ? 'mdi:phone-hangup' : 'mdi:phone'" />
					</div>
					<div class="call-info">
						<span class="call-title">{{ callInfo.ended ? 'Call ended' : 'Voice call' }}</span>
						<span class="call-meta">
							<span v-if="!callInfo.ended" class="live-dot" />
							<span class="duration">{{ callInfo.duration }}</span>
						</span>
					</div>
				</div>

				<div v-if="multiData?.images" class="media-container">
					<img v-for="img in multiData.images" :key="img" :src="img" class="image" @click="openLightbox(img)" />
				</div>

				<div v-if="multiData?.videos" class="media-container">
					<video v-for="video in multiData.videos" :key="video" :src="video" class="video" controls />
				</div>

				<div v-if="multiData?.files && multiData.files.length > 0" class="files-container">
					<div v-for="file in multiData.files" :key="file.url" class="file-item">
						<div class="file-icon">
							<Icon :icon="fileIcon(file.name)" />
						</div>

						<div class="file-info">
							<a :href="file.url" target="_blank" rel="noopener noreferrer" class="file-name">
								{{ file.name }}
							</a>
							<span class="file-meta">
								{{ fileExtension(file.name) ? fileExtension(file.name).toUpperCase() : 'FILE' }} ·
								{{ file.size }}
							</span>
						</div>

						<a
							:href="file.url"
							target="_blank"
							rel="noopener noreferrer"
							download
							class="file-download"
							:title="`Download ${file.name}`"
						>
							<Icon icon="mdi:download" />
						</a>
					</div>
				</div>

				<div v-if="props.editing" class="inline-edit-container">
					<textarea
						ref="editTextareaRef"
						class="inline-edit-input"
						:value="props.editText"
						@input="emit('update:editText', ($event.target as HTMLTextAreaElement).value)"
						@keydown="onEditKeydown"
						rows="1"
					/>
					<div class="inline-edit-hint">
						Escape to <span class="hint-link" @click="emit('cancel-edit')">cancel</span> · Enter to
						<span class="hint-link" @click="emit('save-edit')">save</span>
					</div>
				</div>
				<div v-else-if="messageText || message?.overwrited" class="text-content">
					<span v-if="messageText" class="text" :class="{ sent: is_sent_from_snowflake(props.message.id) }">
						<template v-for="(seg, idx) in formattedSegments" :key="idx">
							<a v-if="seg.isLink" :href="seg.href" target="_blank" rel="noopener noreferrer" class="message-link" draggable="false">{{
								seg.text
							}}</a>
							<template v-else>{{ seg.text }}</template>
						</template>
					</span>
					<span v-if="message?.overwrited" class="edited-indicator">(edited)</span>
				</div>

				<div v-if="message?.error" class="message-error">
					<Icon icon="mdi:alert-circle" class="error-icon" />
					<span class="error-text">{{ message.error }}</span>
				</div>

				<span class="time">
					{{ snowflake_to_date(props.message.id).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }}
				</span>

				<div v-if="groupedReactions.length > 0" class="reactions">
					<button
						v-for="r in groupedReactions"
						:key="r.emoji"
						class="reaction-pill"
						:class="{ mine: r.mine }"
						@click="emit('toggle-reaction', r.emoji)"
					>
						<span class="reaction-emoji">{{ r.emoji }}</span>
						<span class="reaction-count">{{ r.count }}</span>
						<span class="reaction-tooltip">
							<span class="reaction-tooltip-emoji">{{ r.emoji }}</span>
							<span class="reaction-tooltip-text">{{ reactionTooltip(r.user_ids) }}</span>
						</span>
					</button>
				</div>
			</div>
		</div>

		<Teleport to="body">
			<Transition name="lightbox-fade">
				<div v-if="lightboxSrc" class="lightbox" @click.self="closeLightbox">
					<img :src="lightboxSrc" class="lightbox-image" @click.self="closeLightbox" />
				</div>
			</Transition>
		</Teleport>
	</div>
</template>

<style scoped>
	.message {
		display: grid;
		grid-template-columns: 40px 1fr;
		gap: 0 12px;
		padding: 0px 20px;
		color: #7e7e7e;
	}

	.message:hover {
		background-color: var(--bg-light);
	}

	.reactions {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		padding-bottom: 2px;
	}

	.reaction-pill {
		position: relative;
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 2px 8px;
		background: var(--bg-dark);
		border: 1px solid var(--border);
		border-radius: 12px;
		cursor: pointer;
		transition:
			background 0.15s,
			border-color 0.15s;
		line-height: 1;
		height: 26px;
	}

	.reaction-tooltip {
		position: absolute;
		bottom: calc(100% + 6px);
		left: 50%;
		transform: translateX(-50%) translateY(4px);
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 10px;
		background: var(--bg-darkest, #0f0f12);
		border: 1px solid rgba(255, 255, 255, 0.07);
		border-radius: 6px;
		box-shadow: 0 6px 20px rgba(0, 0, 0, 0.5);
		font-size: 0.78rem;
		color: var(--text);
		white-space: nowrap;
		max-width: 280px;
		opacity: 0;
		pointer-events: none;
		transition:
			opacity 0.12s ease,
			transform 0.12s ease;
		z-index: 50;
	}

	.reaction-pill:hover .reaction-tooltip {
		opacity: 1;
		transform: translateX(-50%) translateY(0);
		transition-delay: 0.25s;
	}

	.reaction-tooltip-emoji {
		font-size: 1rem;
		line-height: 1;
	}

	.reaction-tooltip-text {
		overflow: hidden;
		text-overflow: ellipsis;
		color: var(--text-secondary);
	}

	.reaction-pill:hover {
		background: var(--bg);
		border-color: var(--color-lightest);
	}

	.reaction-pill.mine {
		border-color: var(--color-lighter);
	}

	.reaction-pill.mine .reaction-count {
		color: var(--text);
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

	.message.with-user {
		padding: 16px 20px 0px 20px;
	}

	.message:not(.with-user) {
		padding: 0px 20px 0px 20px;
	}

	.message:not(.with-user) .content {
		grid-column: 2;
	}

	.message:not(.with-user):not(.has-reply) .content {
		grid-column: 1 / -1;
		padding-left: 52px;
	}

	.reply-spine-area {
		grid-column: 1;
		grid-row: 1;
		position: relative;
	}

	.reply-spine {
		position: absolute;
		top: 12px;
		bottom: 4px;
		left: 18px;
		width: 28px;
		border-left: 2px solid #4f545c;
		border-top: 2px solid #4f545c;
		border-top-left-radius: 6px;
	}

	.reply-preview {
		grid-column: 2;
		grid-row: 1;
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 0.85rem;
		color: var(--text-muted);
		padding: 6px 0 4px 0;
		margin-bottom: 6px;
		max-width: 100%;
		overflow: hidden;
		cursor: pointer;
		transition: color 0.15s ease;
	}

	.reply-preview:hover {
		color: var(--text-secondary);
	}

	.reply-preview:hover .reply-preview-snippet {
		color: var(--text);
	}

	.reply-avatar {
		width: 16px;
		height: 16px;
		border-radius: 50%;
		flex-shrink: 0;
		object-fit: cover;
	}

	.reply-preview-icon {
		font-size: 1rem;
		flex-shrink: 0;
	}

	.reply-preview-snippet {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-width: 0;
		color: var(--text-muted);
	}

	.replied-to-name:hover {
		text-decoration: underline;
	}

	.avatar {
		grid-column: 1;
		width: 40px;
		height: 40px;
		border-radius: 50%;
		flex-shrink: 0;
		cursor: pointer;
	}

	.content {
		grid-column: 2;
		display: flex;
		flex-direction: column;
		flex: 1;
		min-width: 0;
	}

	.message-header {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-bottom: 2px;
	}

	.name {
		font-size: 1rem;
		color: var(--text);
		font-weight: 600;
		cursor: pointer;
	}
	.name:hover {
		text-decoration: underline;
	}

	.time-header {
		font-size: 0.8rem;
	}

	.data {
		position: relative;
		display: flex;
		flex-direction: column;
		padding-right: 50px;
	}

	.data:hover .time {
		opacity: 1;
	}

	.time {
		position: absolute;
		right: 0;
		top: 50%;
		font-size: 0.75rem;
		color: #666;
		opacity: 0;
		transition: opacity 0.2s;
		transform: translateY(-50%);
	}

	.with-user .time {
		display: none;
	}

	.text {
		font-size: 1rem;
		line-height: 1.4;
		word-break: break-word;
		-webkit-user-select: text;
		user-select: text;
		white-space: pre-wrap;
	}

	.message-link {
		color: var(--color-lighter, #a78bfa);
		text-decoration: underline;
		cursor: pointer;
		-webkit-user-select: text;
		user-select: text;
	}

	.message-link:hover {
		color: var(--color-light, #8b5cf6);
	}

	.edited-indicator {
		font-size: 0.72rem;
		color: var(--text-muted, #949ba4);
		margin-left: 4px;
		user-select: none;
	}

	.sent {
		color: var(--text);
	}

	.media-container {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		justify-content: flex-start;
		gap: 6px;
		margin: 2px 0;
	}

	.image,
	.video {
		max-width: 380px;
		max-height: 300px;
		width: auto;
		height: auto;
		border-radius: 6px;
		display: block;
		flex: 0 0 auto;
		align-self: flex-start;
	}

	.image {
		cursor: pointer;
		transition: filter 0.15s ease;
	}

	.image:hover {
		filter: brightness(0.92);
	}

	.lightbox {
		position: fixed;
		inset: 0;
		background-color: rgba(0, 0, 0, 0.85);
		z-index: 2000;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		font-family: Arial, Helvetica, sans-serif;
	}

	.lightbox-image {
		max-width: 92vw;
		max-height: 92vh;
		object-fit: contain;
		border-radius: 6px;
		box-shadow: 0 8px 40px rgba(0, 0, 0, 0.5);
		cursor: pointer;
	}

	.files-container {
		display: flex;
		flex-direction: column;
		gap: 4px;
		margin: 2px 0;
	}

	.file-item {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 12px;
		background-color: var(--bg-darker);
		border: 1px solid var(--border);
		border-radius: 8px;
		max-width: 420px;
		min-width: 0;
		transition:
			background-color 0.15s ease,
			border-color 0.15s ease;
	}

	.file-item:hover {
		background-color: var(--bg-dark);
		border-color: var(--bg-lighter);
	}

	.file-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		flex-shrink: 0;
		font-size: 1.75rem;
		color: var(--text-secondary);
	}

	.file-info {
		display: flex;
		flex-direction: column;
		min-width: 0;
		flex: 1;
		gap: 2px;
	}

	.file-name {
		color: var(--text);
		font-weight: 500;
		font-size: 0.95rem;
		text-decoration: none;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.file-name:hover {
		text-decoration: underline;
	}

	.file-meta {
		font-size: 0.75rem;
		color: var(--text-subtle);
	}

	.file-download {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		flex-shrink: 0;
		border-radius: 6px;
		color: var(--text-secondary);
		font-size: 1.25rem;
		text-decoration: none;
		transition:
			background-color 0.15s ease,
			color 0.15s ease;
	}

	.file-download:hover {
		background-color: var(--bg-light);
		color: var(--text);
	}

	.call-card {
		display: inline-flex;
		align-items: center;
		gap: 14px;
		padding: 10px 18px 10px 12px;
		background: linear-gradient(135deg, var(--bg-darker), var(--bg-dark));
		border: 1px solid var(--border);
		border-radius: 14px;
		max-width: 340px;
		margin: 4px 0;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.18);
		transition:
			transform 0.18s ease,
			box-shadow 0.18s ease,
			border-color 0.18s ease;
	}

	.call-card:hover {
		transform: translateY(-1px);
		box-shadow: 0 6px 16px rgba(0, 0, 0, 0.25);
	}

	.call-card.ongoing {
		border-color: hsla(141, 50%, 45%, 0.55);
		background: linear-gradient(135deg, hsla(141, 50%, 30%, 0.18), var(--bg-dark));
	}

	.call-card.ended {
		opacity: 0.85;
	}

	.call-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		flex-shrink: 0;
		font-size: 1.45rem;
		border-radius: 50%;
		background: linear-gradient(135deg, var(--bg), var(--bg-dark));
		color: var(--text-secondary);
		box-shadow: inset 0 0 0 1px var(--border-muted);
	}

	.call-card.ongoing .call-icon {
		background: linear-gradient(135deg, hsl(141, 55%, 42%), hsl(141, 55%, 32%));
		color: #fff;
		box-shadow:
			0 0 0 4px hsla(141, 55%, 45%, 0.18),
			inset 0 0 0 1px hsla(141, 55%, 60%, 0.4);
	}

	.call-card.ended .call-icon {
		color: var(--text-subtle);
	}

	.call-info {
		display: flex;
		flex-direction: column;
		min-width: 0;
		gap: 3px;
	}

	.call-title {
		color: var(--text);
		font-weight: 600;
		font-size: 0.95rem;
		letter-spacing: 0.1px;
	}

	.call-card.ended .call-title {
		color: var(--text-subtle);
		font-weight: 500;
	}

	.call-meta {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 0.78rem;
		color: var(--text-subtle);
		font-variant-numeric: tabular-nums;
	}

	.call-card.ongoing .call-meta .duration {
		color: hsl(141, 50%, 70%);
		font-weight: 500;
	}

	.live-dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background-color: hsl(141, 60%, 55%);
		box-shadow: 0 0 0 0 hsla(141, 60%, 55%, 0.6);
		animation: live-pulse 1.6s ease-out infinite;
	}

	@keyframes live-pulse {
		0% {
			box-shadow: 0 0 0 0 hsla(141, 60%, 55%, 0.55);
		}
		70% {
			box-shadow: 0 0 0 6px hsla(141, 60%, 55%, 0);
		}
		100% {
			box-shadow: 0 0 0 0 hsla(141, 60%, 55%, 0);
		}
	}

	.lightbox-fade-enter-active,
	.lightbox-fade-leave-active {
		transition: opacity 0.18s ease;
	}

	.lightbox-fade-enter-from,
	.lightbox-fade-leave-to {
		opacity: 0;
	}

	.inline-edit-container {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.inline-edit-input {
		width: 100%;
		padding: 8px 10px;
		background-color: var(--bg-darker, #1e1f22);
		border: 1px solid var(--color, #7c3aed);
		border-radius: 6px;
		color: var(--text);
		font-size: 1rem;
		font-family: inherit;
		line-height: 1.4;
		resize: none;
		outline: none;
		field-sizing: content;
		min-height: 36px;
		max-height: 200px;
		overflow-y: auto;
		transition: border-color 0.2s ease;
	}

	.inline-edit-input:focus {
		border-color: var(--color-light, #8b5cf6);
		box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.15);
	}

	.inline-edit-hint {
		font-size: 0.72rem;
		color: var(--text-muted, #949ba4);
		user-select: none;
	}

	.hint-link {
		color: var(--color-lighter, #a78bfa);
		cursor: pointer;
	}

	.hint-link:hover {
		text-decoration: underline;
	}

	.message-error {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-top: 4px;
		color: var(--error);
		font-size: 0.85rem;
		line-height: 1.4;
	}

	.error-icon {
		font-size: 1.1rem;
		flex-shrink: 0;
	}

	.error-text {
		font-weight: 500;
	}
</style>
