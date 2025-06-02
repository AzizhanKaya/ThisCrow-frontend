import { ref, readonly } from 'vue';
import { websocketService } from '@/services/websocket';
import type { Message } from '@/types';

export function useWebSocket() {
	const typing = ref(false);
	const pendingMessages = ref<Message[]>([]);

	function sendMessage(message: Message) {
		if (websocketService.getConnectionState() === 'open') {
			websocketService.sendMessage(message);
		} else {
			pendingMessages.value.push(message);
		}
	}

	function handleConnectionStateChange(state: string) {
		if (state === 'OPEN') {
			pendingMessages.value.forEach((msg) => websocketService.sendMessage(msg));
			pendingMessages.value = [];
		}
	}

	return {
		typing: readonly(typing),
		sendMessage,
		handleConnectionStateChange,
		pendingMessages: readonly(pendingMessages),
	};
}
