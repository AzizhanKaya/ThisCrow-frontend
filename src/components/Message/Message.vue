<script setup lang="ts">
	import { computed, type PropType, ref, onBeforeUnmount, watch } from 'vue';
	import type { CallData, Message, MessageData, MultiData, User } from '@/types';
	import { Icon } from '@iconify/vue';
	import { get_timestamp_from_snowflake, is_sent_from_snowflake, snowflake_to_date } from '@/utils/snowflake';
	import { decrypt_message } from '@/../pkg/wasm_lib';
	import { decode } from '@/utils/msgpack';
	import { getDefaultAvatar } from '@/utils/avatar';

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

	const multiData = $computed<MultiData | undefined>(() => {
		const data = message?.data;
		if (data && typeof data === 'object' && !('end_time' in data) && !('cipher' in data)) {
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
		{ immediate: true },
	);

	const emit = defineEmits<{
		(e: 'open-profile', payload: { user: User; x: number; y: number }): void;
	}>();

	function openProfileCard(e: MouseEvent) {
		if (!props.user) return;

		document.dispatchEvent(new Event('click'));
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();

		emit('open-profile', {
			user: props.user,
			x: rect.right + 10,
			y: rect.top,
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
			['js', 'ts', 'tsx', 'jsx', 'rs', 'py', 'go', 'java', 'c', 'cpp', 'h', 'cs', 'rb', 'php', 'sh', 'json', 'xml', 'html', 'css', 'vue'].includes(
				ext,
			)
		)
			return 'mdi:file-code';
		if (['txt', 'md', 'log'].includes(ext)) return 'mdi:file-document';
		return 'mdi:file';
	}
</script>

<template>
	<div class="message" :class="{ 'with-user': user }">
		<img
			v-if="user && props.privateKey !== undefined"
			class="avatar"
			:src="user.avatar || getDefaultAvatar(user.username)"
			@click.stop="openProfileCard($event)"
		/>

		<div class="content">
			<div v-if="user" class="message-header">
				<span class="name" @click.stop="openProfileCard($event)">{{ user.name }}</span>
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
					<img
						v-for="img in multiData.images"
						:key="img"
						:src="img"
						class="image"
						@click="openLightbox(img)"
					/>
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
							<a
								:href="file.url"
								target="_blank"
								rel="noopener noreferrer"
								class="file-name"
							>
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

				<span v-if="messageText" class="text" :class="{ sent: is_sent_from_snowflake(props.message.id) }">
					{{ messageText }}
				</span>

				<span class="time">
					{{ snowflake_to_date(props.message.id).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }}
				</span>
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
		display: flex;
		gap: 12px;
		padding: 0px 20px;
		color: #7e7e7e;
	}

	.message:hover {
		background-color: var(--bg-light);
	}

	.message.with-user {
		margin-top: 10px;
		padding: 5px 20px 0px 20px;
	}

	.message:not(.with-user) {
		padding: 0px 20px 0px 72px;
	}

	.avatar {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		flex-shrink: 0;
		cursor: pointer;
	}

	.content {
		display: flex;
		flex-direction: column;
		flex: 1;
	}

	.message-header {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-bottom: 2px;
	}

	.name {
		font-size: 1rem;
		color: var(--text-secondary);
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
		gap: 4px;
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
	}

	.sent {
		color: var(--text-secondary);
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
		transition: background-color 0.15s ease, border-color 0.15s ease;
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
		transition: background-color 0.15s ease, color 0.15s ease;
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
		transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
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
		box-shadow: 0 0 0 4px hsla(141, 55%, 45%, 0.18), inset 0 0 0 1px hsla(141, 55%, 60%, 0.4);
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
</style>
