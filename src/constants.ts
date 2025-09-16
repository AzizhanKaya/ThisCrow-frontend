const DOMAIN_ADDRESS = 'localhost:8080';
const HTTPS = false;
export const HOST_URL = HTTPS ? 'https://' : 'http://' + DOMAIN_ADDRESS;
export const API_URL = HOST_URL + '/api';
export const WS_URL = HTTPS ? 'wss://' : 'ws://' + DOMAIN_ADDRESS + '/api/ws';
