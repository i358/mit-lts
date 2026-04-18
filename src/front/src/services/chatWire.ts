/**
 * Binary wire format for high-rank chat WebSocket (matches backend).
 * Packet: [type: 1 byte][payloadLength: 2 bytes LE][payload: UTF-8 JSON]
 */

export const WIRE = {
  AUTH: 1,
  SEND: 2,
  EDIT: 3,
  DELETE: 4,
  PING: 9,
  AUTH_OK: 129,
  MESSAGE: 130,
  EDIT_BROADCAST: 131,
  DELETE_BROADCAST: 132,
  ERROR: 133,
  PONG: 134,
  HISTORY: 135,
} as const;

const MAX_PAYLOAD = 65535;

export function encodeWire(type: number, payload: object | string): ArrayBuffer {
  const str = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const encoder = new TextEncoder();
  const buf = encoder.encode(str);
  if (buf.length > MAX_PAYLOAD) throw new Error('Payload too long');
  const out = new ArrayBuffer(3 + buf.length);
  const view = new DataView(out);
  view.setUint8(0, type);
  view.setUint16(1, buf.length, true);
  new Uint8Array(out).set(buf, 3);
  return out;
}

export function decodeWire(data: ArrayBuffer): { type: number; payload: any } {
  if (data.byteLength < 3) throw new Error('Packet too short');
  const view = new DataView(data);
  const type = view.getUint8(0);
  const len = view.getUint16(1, true);
  if (data.byteLength < 3 + len) throw new Error('Incomplete packet');
  const payloadBuf = data.slice(3, 3 + len);
  const payloadStr = new TextDecoder().decode(payloadBuf);
  let payload: any = payloadStr;
  try {
    payload = JSON.parse(payloadStr);
  } catch {
    // leave as string
  }
  return { type, payload };
}
