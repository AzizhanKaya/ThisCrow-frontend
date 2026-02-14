import { websocketService } from '@/services/websocket';
import { useFriendStore } from './stores/friend';
import { useServerStore } from './stores/server';
import { useDMStore } from './stores/dm';
import { useMessageStore } from './stores/message';
import type { Me } from '@/types';

export async function initApp() {
	const friendStore = useFriendStore();
	const serverStore = useServerStore();
	const messageStore = useMessageStore();
	const dmStore = useDMStore();
	websocketService.connect();

	const me: Me = await websocketService.waitForSessionInit();

	messageStore.init();
	await friendStore.init();
	await serverStore.init();
	await dmStore.init(me.dms);
}
