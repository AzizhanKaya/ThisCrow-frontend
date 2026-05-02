export { MediaType } from './types';
export type { PeerConnection, WebRTCConfig } from './types';
export { WebRTCService } from './WebRTCService';

import { WebRTCService } from './WebRTCService';

export const webrtcService: WebRTCService = new Proxy({} as WebRTCService, {
	get(_target, prop, _receiver) {
		const instance = WebRTCService.getInstance() as any;
		const value = instance[prop as keyof WebRTCService];
		if (typeof value === 'function') {
			return value.bind(instance);
		}
		return value;
	},
});
