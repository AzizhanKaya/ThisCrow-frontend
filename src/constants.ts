const DOMAIN_ADDRESS = 'localhost';
const API_PORT = 8080;
const WS_PORT = 8081;
const HTTPS = false;
export const HOST_URL = HTTPS ? 'https://' : 'http://' + DOMAIN_ADDRESS;
export const API_URL = HOST_URL + ':' + API_PORT + '/api';
export const WS_URL = HTTPS ? 'wss://' : 'ws://' + DOMAIN_ADDRESS + ':' + WS_PORT;
