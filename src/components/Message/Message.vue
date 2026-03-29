<script setup lang="ts">
	import { computed, type PropType } from 'vue';
	import type { Message, MessageData, MultiData, User } from '@/types';
	import { Icon } from '@iconify/vue';
	import { is_sent_from_snowflake, snowflake_to_date } from '@/utils/snowflake';
	import { decrypt_message } from '@/../pkg/wasm_lib';
	import { decode } from '@msgpack/msgpack';
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
			type: Object as PropType<Uint8Array>,
			required: false,
		},
	});

	const message = $computed(() => {
		const data = props.message.data;
		if (typeof data !== 'object' || data === null || !('cipher' in data)) {
			return props.message;
		}

		if (!props.privateKey) {
			return props.message;
		}

		if (props.message.overwrited) console.log(props.message.overwrited);

		try {
			const decrypted = decrypt_message(props.privateKey, data.cipher, data.nonce);
			const decoded = decode(decrypted) as MessageData;

			return { ...props.message, data: decoded } as Message;
		} catch (e) {
			console.error('Failed to decrypt message:', e);
			return props.message;
		}
	});

	const multiData = $computed<MultiData | undefined>(() => {
		const data = message?.data;
		if (typeof data === 'object') {
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
</script>

<template>
	<div class="message" :class="{ 'with-user': user }">
		<img v-if="user" class="avatar" :src="user.avatar || getDefaultAvatar(user.username)" />

		<div class="content">
			<div v-if="user" class="message-header">
				<span class="name">{{ user.name }}</span>
				<span class="time-header">
					{{ snowflake_to_date(props.message.id).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }}
				</span>
			</div>

			<div class="data">
				<div v-if="multiData?.images" class="media-container">
					<img v-for="img in multiData.images" :key="img" :src="img" class="image" />
				</div>

				<div v-if="multiData?.videos" class="media-container">
					<video v-for="video in multiData.videos" :key="video" :src="video" class="video" controls />
				</div>

				<div v-if="multiData?.files && multiData.files.length > 0" class="files-container">
					<div
						v-for="file in multiData.files"
						:key="file.url"
						class="file-item"
						style="
							display: flex;
							justify-content: space-between;
							align-items: center;
							padding: 8px;
							border: 1px solid #ccc;
							border-radius: 4px;
							margin-bottom: 4px;
						"
					>
						<div class="file-info" style="display: flex; flex-direction: column">
							<span class="file-name" style="font-weight: bold">{{ file.name }}</span>
							<span class="file-meta" style="font-size: 0.85em; color: gray">
								{{ file.name.includes('.') ? file.name.split('.').pop()?.toUpperCase() : 'BİLİNMEYEN' }} • {{ file.size }}
							</span>
						</div>

						<a
							:href="file.url"
							target="_blank"
							rel="noopener noreferrer"
							download
							class="download-link"
							style="display: flex; align-items: center; gap: 4px; text-decoration: none; color: #007bff"
						>
							<Icon icon="mdi:download" /> İndir
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
		color: #dbdbdb;
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
		-webkit-user-select: auto;
		user-select: auto;
	}

	.sent {
		color: #dbdbdb;
	}
</style>
