<script setup lang="ts">
	import { webrtcService } from '@/services/webrtc';
	import { computed } from 'vue';

	const peers = computed(() => {
		const _ = webrtcService.stateUpdate.value;
		return Array.from(webrtcService.pcs.values());
	});
</script>

<template>
	<div class="voice-audio-renderer" style="display: none">
		<audio v-for="peer in peers" :key="peer.userId" :srcObject="peer.remoteStream" autoplay playsinline></audio>
	</div>
</template>
