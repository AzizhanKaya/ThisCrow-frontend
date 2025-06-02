<script lang="ts">
	import type { PropType } from 'vue';
	import type { Messages } from '@/types';
	import { Icon } from '@iconify/vue';

	export default {
		props: {
			block: {
				type: Object as PropType<Messages>,
				required: true,
			},
		},
	};
</script>

<template>
	<div class="message-block">
		<img class="avatar" :src="block.user.avatar || '/default-user-icon.png'" />
		<div class="message-header">
			<span class="name">{{ block.user.name }}</span>
			<span class="time-header">{{ block.messages[0].time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }}</span>
		</div>
		<div class="messages">
			<div v-for="(message, index) in block.messages" :key="index" class="message">
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
				<span v-if="message.data.text" class="text" :class="{ 'not-sent': message.notSent }">{{ message.data.text }}</span>
				<span class="time">{{ message.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }}</span>
			</div>
		</div>
	</div>
</template>

<style scoped>
	.message-block {
		display: flex;
		gap: 10px;
		position: relative;
		padding: 5px 20px;
		color: #dbdbdb;
	}

	.messages {
		flex: 1;
		display: flex;
		flex-direction: column;
		padding-top: 20px;
	}

	.avatar {
		border-radius: 50%;
		width: 40px;
		height: 40px;
		flex-shrink: 0;
		z-index: 2;
	}

	.name {
		font-size: 1.2rem;
		font-weight: 500;
		font-weight: bold;
		margin-bottom: 2px;
	}

	.name:hover {
		text-decoration: underline;
		cursor: pointer;
	}

	.time-header {
		font-size: 0.8rem;
		color: #7e7e7e;
		margin-left: 5px;
		cursor: default;
	}

	.message-header {
		position: absolute;
		left: 70px;
		top: 0px;
	}

	.message {
		position: relative;
		padding-right: 65px;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.not-sent {
		color: #7e7e7e;
	}

	.message:hover .time {
		opacity: 1;
	}

	.time {
		position: absolute;
		right: 0;
		top: 50%;
		transform: translateY(-50%);
		font-size: 0.75rem;
		color: #666;
		opacity: 0;
		transition: opacity 0.2s;
	}

	.text {
		font-size: 1rem;
		line-height: 1.4;
		word-break: break-word;
	}

	.media-container {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}

	.image {
		width: 150px;
		height: 150px;
		object-fit: cover;
		border-radius: 4px;
	}

	.video {
		width: 250px;
		max-height: 200px;
		border-radius: 4px;
	}

	.files-container {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.file {
		display: flex;
		flex-direction: column;
		background: rgba(255, 255, 255, 0.05);
		padding: 8px;
		border-radius: 4px;
		max-width: 250px;
	}

	.file-name {
		font-weight: 500;
	}

	.file-size {
		font-size: 0.8rem;
		color: #888;
	}

	.last-in-group {
		margin-bottom: 4px;
	}
</style>
