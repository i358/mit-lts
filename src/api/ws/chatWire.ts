/**
 * Binary wire format for high-rank chat WebSocket.
 * Packet: [type: 1 byte][payloadLength: 2 bytes LE][payload: UTF-8 JSON]
 */

export const WIRE = {
  // Client -> Server
  AUTH: 1,
  SEND: 2,
  EDIT: 3,
  DELETE: 4,
  PING: 9,
  // Server -> Client
  AUTH_OK: 129,
  MESSAGE: 130,
  EDIT_BROADCAST: 131,
  DELETE_BROADCAST: 132,
  ERROR: 133,
  PONG: 134,
  HISTORY: 135,
} as const;

const MAX_PAYLOAD = 65535;

export function encodeWire(type: number, payload: object | string): Buffer {
  const str = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const buf = Buffer.from(str, 'utf8');
  if (buf.length > MAX_PAYLOAD) throw new Error('Payload too long');
  const out = Buffer.allocUnsafe(3 + buf.length);
  out[0] = type;
  out.writeUInt16LE(buf.length, 1);
  buf.copy(out, 3);
  return out;
}

export function decodeWire(data: Buffer): { type: number; payload: any } {
  if (data.length < 3) throw new Error('Packet too short');
  const type = data[0];
  const len = data.readUInt16LE(1);
  if (data.length < 3 + len) throw new Error('Incomplete packet');
  const payloadBuf = data.subarray(3, 3 + len);
  const payloadStr = payloadBuf.toString('utf8');
  let payload: any = payloadStr;
  try {
    payload = JSON.parse(payloadStr);
  } catch {
    // leave as string
  }
  return { type, payload };
}
