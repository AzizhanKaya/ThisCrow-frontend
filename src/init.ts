import { websocketService } from '@/services/websocket';
import { useFriendStore } from './stores/friends';
import { useServerStore } from './stores/servers';
import { useDMStore } from './stores/dm';

export async function initApp() {
	const friendStore = useFriendStore();
	const serverStore = useServerStore();
	const dmStore = useDMStore();
	websocketService.connect();
	await friendStore.initFriend();
	await serverStore.initServers();
	await dmStore.initDms();
}
