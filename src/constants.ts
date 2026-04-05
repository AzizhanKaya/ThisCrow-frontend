const DOMAIN_ADDRESS = import.meta.env.VITE_DOMAIN_ADDRESS;
const API_PORT = import.meta.env.VITE_API_PORT;
const WS_PORT = import.meta.env.VITE_WS_PORT;
const HTTPS = import.meta.env.VITE_HTTPS === 'true';

const PROTOCOL = HTTPS ? 'https://' : 'http://';
const WS_PROTOCOL = HTTPS ? 'wss://' : 'ws://';

export const HOST_URL = PROTOCOL + DOMAIN_ADDRESS;

export const API_URL = API_PORT ? HOST_URL + ':' + API_PORT + '/api' : HOST_URL + '/api';

export const WS_URL = WS_PORT ? WS_PROTOCOL + DOMAIN_ADDRESS + ':' + WS_PORT + '/ws' : WS_PROTOCOL + DOMAIN_ADDRESS + '/ws';
