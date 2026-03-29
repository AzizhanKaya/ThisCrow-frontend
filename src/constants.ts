const DOMAIN_ADDRESS = import.meta.env.VITE_DOMAIN_ADDRESS;
const API_PORT = import.meta.env.VITE_API_PORT;
const WS_PORT = import.meta.env.VITE_WS_PORT;
const HTTPS = import.meta.env.VITE_HTTPS === 'true';

export const HOST_URL = (HTTPS ? 'https://' : 'http://') + DOMAIN_ADDRESS;
export const API_URL = HOST_URL + (API_PORT ? ':' + API_PORT : '') + '/api';
export const WS_URL = (HTTPS ? 'wss://' : 'ws://') + DOMAIN_ADDRESS + (WS_PORT ? ':' + WS_PORT : '');
