import { ref, watch, type Ref } from 'vue';
import type { Message, Messages, User, MessageData } from '@/types';
import { MessageType } from '@/types';
import { websocketService } from '@/services/websocket';
import { getMessages } from '@/api/message';

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
		if (state === 'OPEN') {
			pendingMessages.forEach((msg) => {
				websocketService.sendMessage(msg);
			});

			messageBlocks.value.forEach((block) => {
				if (block.user.id === currentUser.id) {
					block.messages.forEach((m) => {
						delete m.notSent;
					});
				}
			});
		}
	};

	function sendMessage(messageData: MessageData) {
		const wsMessage: Message = {
			from: currentUser.id,
			to: selectedUser.id,
			data: messageData,
			type: MessageType.Direct,
			time: new Date(),
		};

		if (websocketService.getConnectionState() === 'OPEN') {
			websocketService.sendMessage(wsMessage);
		} else {
			pendingMessages.push(wsMessage);
			wsMessage.notSent = true;
		}

		addMessageToBlocks(wsMessage);
	}

	async function loadMessages() {
		const messages = await getMessages({ from: selectedUser.id });

		messages.forEach((msg) => {
			msg.time = new Date(msg.time);
		});

		[...messages, ...pendingMessages].forEach((msg) => addMessageToBlocks(msg));
		pendingMessages.forEach((msg) => websocketService.sendMessage(msg));
	}

	async function loadOldMessages() {
		const firstMessageDate = messageBlocks.value[0].messages[0].time;

		if (!firstMessageDate) {
			throw new Error('No message block found.');
		}

		const oldMessages = await getMessages({ from: selectedUser.id, len: 50, end: firstMessageDate });

		oldMessages.reverse().forEach((msg) => {
			msg.time = new Date(msg.time);
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
