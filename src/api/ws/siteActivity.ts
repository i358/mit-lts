import { WebSocketServer } from 'ws';
import type { Server as HttpServer } from 'http';
import { apiLogger as logger } from '../../logger';
import { validateActivityToken } from './wsTokenStore';

const WS_PATH = '/v1/ws/activity';

const activityClients = new Set<any>();

function broadcastCount() {
  const count = activityClients.size;
  const msg = JSON.stringify({ type: 'active_count', count });
  activityClients.forEach((ws) => {
    try {
      if (ws.readyState === 1) ws.send(msg);
    } catch (_) {}
  });
}

function send(ws: any, obj: object) {
  try {
    if (ws.readyState === 1) ws.send(JSON.stringify(obj));
  } catch (_) {}
}

export function registerSiteActivityWebSocket(server: HttpServer) {
  const wss = new WebSocketServer({ noServer: true });

  const handleUpgrade = (request: any, socket: any, head: Buffer) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  };

  wss.on('connection', (ws: any) => {
    let authenticated = false;

    ws.on('message', (raw: Buffer | string) => {
      try {
        const data = typeof raw === 'string' ? raw : raw.toString('utf8');
        const msg = JSON.parse(data);
        if (msg?.type !== 'auth' || authenticated) return;
        const token = typeof msg.token === 'string' ? msg.token : null;
        if (!token) {
          send(ws, { type: 'error', error: 'Token gerekli' });
          ws.close();
          return;
        }
        const claim = validateActivityToken(token);
        if (!claim) {
          send(ws, { type: 'error', error: 'Geçersiz veya süresi dolmuş token' });
          ws.close();
          return;
        }
        authenticated = true;
        activityClients.add(ws);
        send(ws, { type: 'auth_ok' });
        broadcastCount();
      } catch (_) {
        send(ws, { type: 'error', error: 'Geçersiz mesaj' });
      }
    });

    ws.on('close', () => {
      if (authenticated) activityClients.delete(ws);
      if (authenticated) broadcastCount();
    });

    ws.on('error', () => {
      if (authenticated) activityClients.delete(ws);
      if (authenticated) broadcastCount();
    });
  });

  logger.info(`Site activity WebSocket registered at ${WS_PATH}`);
  return { path: WS_PATH, handleUpgrade };
}

export function getSiteActivityCount(): number {
  return activityClients.size;
}
