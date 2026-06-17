const DOMAIN_ADDRESS = import.meta.env.VITE_DOMAIN_ADDRESS;
const API_PORT = import.meta.env.VITE_API_PORT;
const WS_PORT = import.meta.env.VITE_WS_PORT;
const HTTPS = import.meta.env.VITE_HTTPS === 'true';

const PROTOCOL = HTTPS ? 'https://' : 'http://';
const WS_PROTOCOL = HTTPS ? 'wss://' : 'ws://';

export const HOST_URL = PROTOCOL + DOMAIN_ADDRESS;

const PROXY_ENABLED = import.meta.env.VITE_PROXY_ENABLED !== 'false';

export const API_URL = (import.meta.env.DEV && PROXY_ENABLED) ? '/api' : API_PORT ? HOST_URL + ':' + API_PORT + '/api' : HOST_URL + '/api';

export const WS_URL = (import.meta.env.DEV && PROXY_ENABLED)
	? `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`
	: WS_PORT
		? WS_PROTOCOL + DOMAIN_ADDRESS + ':' + WS_PORT + '/ws'
		: WS_PROTOCOL + DOMAIN_ADDRESS + '/ws';

const TURN_URLS = import.meta.env.VITE_TURN_URLS as string | undefined;
const TURN_USERNAME = import.meta.env.VITE_TURN_USERNAME as string | undefined;
const TURN_CREDENTIAL = import.meta.env.VITE_TURN_CREDENTIAL as string | undefined;
const FORCE_RELAY = import.meta.env.VITE_TURN_FORCE_RELAY === 'true';

const turnUrls = TURN_URLS
	? TURN_URLS.split(',')
			.map((u) => u.trim())
			.filter(Boolean)
	: [];

export const ICE_SERVERS: RTCIceServer[] = [
	{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
	...(turnUrls.length
		? [
				{
					urls: turnUrls,
					...(TURN_USERNAME ? { username: TURN_USERNAME } : {}),
					...(TURN_CREDENTIAL ? { credential: TURN_CREDENTIAL } : {}),
				},
			]
		: []),
];

export const ICE_TRANSPORT_POLICY: RTCIceTransportPolicy = FORCE_RELAY ? 'relay' : 'all';
