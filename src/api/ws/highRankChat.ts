import { WebSocketServer } from 'ws';
import type { Server as HttpServer } from 'http';
import { apiLogger as logger } from '../../logger';
import { consumeWsToken } from './wsTokenStore';
import { encodeWire, decodeWire, WIRE } from './chatWire';
import {
  getHighRankChatMessages,
  insertHighRankChatMessage,
  updateHighRankChatMessage,
  deleteHighRankChatMessage,
} from '../../db_utilities/postgres';

const WS_PATH = '/v1/ws/chat';

interface ClientSession {
  userId: string;
  username: string;
}

const clientSessions = new Map<any, ClientSession>();

function broadcast(data: Buffer, excludeWs?: any) {
  clientSessions.forEach((_, ws) => {
    if (ws.readyState === 1 && ws !== excludeWs) ws.send(data);
  });
}

function sendError(ws: any, message: string) {
  try {
    ws.send(encodeWire(WIRE.ERROR, { error: message }));
  } catch (_) {}
}

export function registerChatWebSocket(server: HttpServer) {
  const wss = new WebSocketServer({ noServer: true });

  const handleUpgrade = (request: any, socket: any, head: Buffer) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  };

  wss.on('connection', (ws: any) => {
    let session: ClientSession | null = null;

    ws.on('message', async (raw: Buffer) => {
      try {
        const { type, payload } = decodeWire(Buffer.isBuffer(raw) ? raw : Buffer.from(raw));

        if (!session) {
          if (type !== WIRE.AUTH) {
            sendError(ws, 'Önce kimlik doğrulama gerekli');
            return;
          }
          const token = typeof payload?.token === 'string' ? payload.token : null;
          if (!token) {
            sendError(ws, 'Token gerekli');
            return;
          }
          const claim = consumeWsToken(token);
          if (!claim) {
            sendError(ws, 'Geçersiz veya süresi dolmuş token');
            ws.close();
            return;
          }
          session = { userId: claim.userId, username: claim.username };
          clientSessions.set(ws, session);
          ws.send(encodeWire(WIRE.AUTH_OK, { user_id: session.userId, username: session.username }));

          const messages = await getHighRankChatMessages(100);
          ws.send(encodeWire(WIRE.HISTORY, { messages }));
          return;
        }

        switch (type) {
          case WIRE.PING:
            ws.send(encodeWire(WIRE.PONG, {}));
            break;
          case WIRE.SEND: {
            const text = typeof payload?.message === 'string' ? payload.message : '';
            if (!text.trim()) {
              sendError(ws, 'Mesaj boş olamaz');
              return;
            }
            const created = await insertHighRankChatMessage(session.userId, text);
            broadcast(encodeWire(WIRE.MESSAGE, created));
            break;
          }
          case WIRE.EDIT: {
            const messageId = typeof payload?.message_id === 'number' ? payload.message_id : Number(payload?.message_id);
            const text = typeof payload?.message === 'string' ? payload.message : '';
            if (!messageId || !Number.isInteger(messageId)) {
              sendError(ws, 'Geçersiz message_id');
              return;
            }
            const updated = await updateHighRankChatMessage(messageId, session.userId, text);
            if (!updated) {
              sendError(ws, 'Mesaj bulunamadı veya düzenleme yetkiniz yok');
              return;
            }
            const buf = encodeWire(WIRE.EDIT_BROADCAST, updated);
            broadcast(buf);
            break;
          }
          case WIRE.DELETE: {
            const messageId = typeof payload?.message_id === 'number' ? payload.message_id : Number(payload?.message_id);
            if (!messageId || !Number.isInteger(messageId)) {
              sendError(ws, 'Geçersiz message_id');
              return;
            }
            const deleted = await deleteHighRankChatMessage(messageId, session.userId);
            if (!deleted) {
              sendError(ws, 'Mesaj bulunamadı veya silme yetkiniz yok');
              return;
            }
            broadcast(encodeWire(WIRE.DELETE_BROADCAST, { id: messageId }));
            break;
          }
          default:
            sendError(ws, 'Bilinmeyen komut');
        }
      } catch (err: any) {
        logger.error('Chat WS message error:', err);
        sendError(ws, err?.message || 'Sunucu hatası');
      }
    });

    ws.on('close', () => {
      clientSessions.delete(ws);
    });

    ws.on('error', () => {
      clientSessions.delete(ws);
    });
  });

  logger.info(`High-rank chat WebSocket registered at ${WS_PATH}`);
  return { path: WS_PATH, handleUpgrade };
}
