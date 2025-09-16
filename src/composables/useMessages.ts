import { ref, watch, type Ref, reactive } from 'vue';
import type { Message, Messages, User, MessageData } from '@/types';
import { MessageType } from '@/types';
import { websocketService } from '@/services/websocket';
import { messageService } from '@/services/message';

export function useMessages(selectedUser: User, currentUser: User) {
	const messageBlocks = ref<Messages[]>([]) as Ref<Messages[]>;
	const pendingMessages: Message[] = [];
	const typing = ref(false);

	function getUserFromId(id: string): User {
		if (id === currentUser.id) {
			return currentUser;
		}
		return selectedUser;
	}

	function addMessageToBlocks(newMessage: Message, reverse = false) {
		const blocks = messageBlocks.value;
		const existingBlock = reverse ? blocks[0] : blocks[blocks.length - 1];

		if (existingBlock?.user.id === newMessage.from) {
			if (reverse) {
				existingBlock.messages.unshift(newMessage);
			} else {
				existingBlock.messages.push(newMessage);
			}
		} else {
			const user = getUserFromId(newMessage.from);
			const newBlock = {
				user,
				messages: [newMessage],
			};

			if (reverse) {
				blocks.unshift(newBlock);
			} else {
				blocks.push(newBlock);
			}
		}
	}

	const handleDirectMessage = (message: Message) => {
		if (message.from === selectedUser.id) {
			addMessageToBlocks(message);
			messageService.storeMessage(message);
		}
	};

	const handleInfoMessage = (message: Message) => {
		if (message.from === selectedUser.id) {
			switch (message.data.type) {
				case 'typing':
					typing.value = message.data.typing;
					break;
			}
		}
	};

	const handleConnectionStateChange = (state: string) => {
		console.log(state);
		if (state === 'OPEN') {
			try {
				while (pendingMessages.length > 0) {
					const msg = pendingMessages.shift()!;
					try {
						websocketService.sendMessage(msg);
						msg.sent = true;
						messageService.storeMessage(msg);
					} catch (e) {
						pendingMessages.unshift(msg);
						break;
					}
				}
			} catch (e) {
				console.error(e);
			}
		}
	};

	function sendMessage(messageData: MessageData) {
		const message: Message = reactive({
			from: currentUser.id,
			to: selectedUser.id,
			data: messageData,
			type: MessageType.Direct,
			time: new Date(),
			sent: false,
		});

		try {
			websocketService.sendMessage(message);
			message.sent = true;
			messageService.storeMessage(message);
		} catch (e) {
			message.sent = false;
			pendingMessages.push(message);
		}

		addMessageToBlocks(message);
	}

	async function loadMessages() {
		const messages = await messageService.getMessages(selectedUser.id, MessageType.Direct, 50);

		messages.forEach((msg) => {
			msg.time = new Date(msg.time);
			addMessageToBlocks(msg);
		});
	}

	async function loadOldMessages() {
		const firstMessageDate = messageBlocks.value[0].messages[0].time;

		if (!firstMessageDate) {
			throw new Error('No message block found.');
		}

		const oldMessages = await messageService.getMessages(selectedUser.id, MessageType.Direct, 50, firstMessageDate);

		oldMessages.reverse().forEach((msg) => {
			addMessageToBlocks(msg, true);
		});

		return oldMessages;
	}

	return {
		messageBlocks,
		typing,
		handleDirectMessage,
		handleInfoMessage,
		handleConnectionStateChange,
		sendMessage,
		loadMessages,
		loadOldMessages,
	};
}
