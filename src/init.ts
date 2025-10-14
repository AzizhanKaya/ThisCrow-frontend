import { websocketService } from '@/services/websocket';
import { useFriendStore } from './stores/friends';
import { useServerStore } from './stores/servers';

export async function initApp() {
	const friendStore = useFriendStore();
	const serverStore = useServerStore();
	websocketService.connect();
	await friendStore.initFriend();
	await serverStore.initServers();
}
