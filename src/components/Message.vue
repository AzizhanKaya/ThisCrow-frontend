<script lang="ts">
	import type { PropType } from 'vue';
	import type { Message, User } from '@/types';
	import { Icon } from '@iconify/vue';

	export default {
		props: {
			message: {
				type: Object as PropType<Message>,
				required: true,
			},
			user: {
				type: Object as PropType<User>,
				required: false,
			},
		},
	};
</script>

<template>
	<div class="message" :class="{ 'with-user': user }">
		<img v-if="user" class="avatar" :src="user.avatar || '/default-user-icon.png'" />

		<div class="content">
			<div v-if="user" class="message-header">
				<span class="name">{{ user.name }}</span>
				<span class="time-header">
					{{ message.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }}
				</span>
			</div>

			<div class="data">
				<div v-if="message.data.images" class="media-container">
					<img v-for="img in message.data.images" :key="img" :src="img" class="image" />
				</div>

				<div v-if="message.data.videos" class="media-container">
					<video v-for="video in message.data.videos" :key="video" class="video" controls>
						<source :src="video" type="video/mp4" />
					</video>
				</div>

				<div v-if="message.data.files" class="files-container">
					<div v-for="file in message.data.files" :key="file.name" class="file">
						<span class="file-name">{{ file.name }}</span>
						<span class="file-size">{{ file.size }}</span>
					</div>
				</div>

				<span v-if="message.data.text" class="text" :class="{ sent: message.sent }">
					{{ message.data.text }}
				</span>

				<span class="time">
					{{ message.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }}
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
		-webkit-user-drag: none;
	}

	.sent {
		color: #dbdbdb;
	}
</style>
