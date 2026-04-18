/**
 * One-time tokens for WebSocket auth (cookie is HttpOnly, so client gets token via REST).
 */
import crypto from 'crypto';

const store = new Map<string, { userId: string; username: string; expires: number }>();
const TTL_MS = 60 * 1000;

/** Site activity WS: validate without consuming, longer TTL. */
const activityStore = new Map<string, { userId: string; username: string; expires: number }>();
const ACTIVITY_TTL_MS = 5 * 60 * 1000;

function randomToken(): string {
  return crypto.randomBytes(24).toString('hex');
}

export function createWsToken(userId: string, username: string): string {
  const token = randomToken();
  store.set(token, {
    userId,
    username,
    expires: Date.now() + TTL_MS,
  });
  return token;
}

export function consumeWsToken(token: string): { userId: string; username: string } | null {
  const entry = store.get(token);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    store.delete(token);
    return null;
  }
  store.delete(token);
  return { userId: entry.userId, username: entry.username };
}

export function createActivityToken(userId: string, username: string): string {
  const token = randomToken();
  activityStore.set(token, {
    userId,
    username,
    expires: Date.now() + ACTIVITY_TTL_MS,
  });
  return token;
}

/** Validate activity token without consuming (so client can reconnect). */
export function validateActivityToken(token: string): { userId: string; username: string } | null {
  const entry = activityStore.get(token);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    activityStore.delete(token);
    return null;
  }
  return { userId: entry.userId, username: entry.username };
}
