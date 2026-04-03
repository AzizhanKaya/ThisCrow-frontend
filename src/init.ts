import { websocketService } from '@/services/websocket';
import { useFriendStore } from './stores/friend';
import { useServerStore } from './stores/server';
import { useDMStore } from './stores/dm';
import { useMessageStore } from './stores/message';
import { Status, type Me } from '@/types';
import { useMeStore } from './stores/me';
import { useUserStore } from './stores/user';
import { useVoiceStore } from './stores/voice';
import { useWatchStore } from './stores/watch';
import { useAppStore } from './stores/app';
import { useKeyStore } from './stores/key';

export async function initApp() {
	const friendStore = useFriendStore();
	const serverStore = useServerStore();
	const messageStore = useMessageStore();
	const dmStore = useDMStore();
	const meStore = useMeStore();
	const userStore = useUserStore();
	const voiceStore = useVoiceStore();
	const watchStore = useWatchStore();
	const appStore = useAppStore();
	const keyStore = useKeyStore();

	const me: Me = await websocketService.waitForSessionInit();
	messageStore.init();
	meStore.setMe(me);
	userStore.init(me);
	meStore.changeStatus(Status.Online);
	voiceStore.init();

	if (appStore.isTauri) {
		watchStore.init();
	}

	await Promise.all([
		friendStore.init(me.friends, me.friend_requests, me.friend_requests_sent),
		serverStore.init(me.groups),
		dmStore.init(),
		keyStore.init(),
	]);
}
