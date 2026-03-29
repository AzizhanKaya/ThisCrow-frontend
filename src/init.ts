import { websocketService } from '@/services/websocket';
import { useFriendStore } from './stores/friend';
import { useServerStore } from './stores/server';
import { useDMStore } from './stores/dm';
import { useMessageStore } from './stores/message';
import { Status, type Me } from '@/types';
import { useMeStore } from './stores/me';
import { useUserStore } from './stores/user';
import { useVoiceStore } from './stores/voice';

export async function initApp() {
	const friendStore = useFriendStore();
	const serverStore = useServerStore();
	const messageStore = useMessageStore();
	const dmStore = useDMStore();
	const meStore = useMeStore();
	const userStore = useUserStore();
	const voiceStore = useVoiceStore();

	const me: Me = await websocketService.waitForSessionInit();
	messageStore.init();
	meStore.setMe(me);
	userStore.init(me);
	meStore.changeStatus(Status.Online);
	voiceStore.init();

	await Promise.all([
		friendStore.init(me.friends, me.friend_requests, me.friend_requests_sent),
		serverStore.init(me.groups),
		dmStore.init(),
	]);
}
