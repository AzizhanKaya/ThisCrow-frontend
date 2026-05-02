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
import { useActivityStore } from './stores/activity';

export async function initApp() {
	const friendStore = useFriendStore();
	const serverStore = useServerStore();
	const messageStore = useMessageStore();
	const dmStore = useDMStore();
	const meStore = useMeStore();
	const userStore = useUserStore();
	const voiceStore = useVoiceStore();
	const appStore = useAppStore();
	const keyStore = useKeyStore();
	const activityStore = useActivityStore();
	const watchStore = useWatchStore();

	const me: Me = await websocketService.waitForSessionInit();
	userStore.init(me);
	meStore.setMe(me);
	messageStore.init();
	meStore.changeStatus(Status.Online);
	voiceStore.init();
	keyStore.init();
	await activityStore.init();

	if (appStore.isTauri) {
		watchStore.init();
	}

	await Promise.all([
		friendStore.init(me.friends, me.friend_requests, me.friend_requests_sent),
		serverStore.init(me.groups),
		dmStore.init(),
	]);
}
