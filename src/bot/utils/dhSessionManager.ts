export type DHParticipant = {
  userId: string;
  username: string;
  privateKey: bigint;
  publicKey: bigint;
};

export type DHSession = {
  id: string;
  p: bigint;
  g: bigint;
  ownerId: string;
  submissions: DHParticipant[];
  step: number;
  createdAt: number;
};

function modPow(base: bigint, exp: bigint, mod: bigint) {
  let result = 1n;
  base = base % mod;
  while (exp > 0n) {
    if (exp & 1n) result = (result * base) % mod;
    exp >>= 1n;
    base = (base * base) % mod;
  }
  return result;
}

export class DHSessionManager {
  private sessions: Map<string, DHSession> = new Map();
  private ttl = 1000 * 60 * 15; // 15 minutes

  constructor() {
    // Periodic cleanup
    setInterval(() => this.cleanup(), 1000 * 60);
  }

  createSession(ownerId: string, p: bigint, g: bigint): DHSession {
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const session: DHSession = {
      id,
      p,
      g,
      ownerId,
      submissions: [],
      step: 0,
      createdAt: Date.now()
    };
    this.sessions.set(id, session);
    return session;
  }

  getSession(id: string): DHSession | undefined {
    return this.sessions.get(id);
  }

  submitPrivate(sessionId: string, userId: string, username: string, privateKey: bigint): { ok: boolean; publicKey?: bigint; error?: string } {
    const session = this.sessions.get(sessionId);
    if (!session) return { ok: false, error: 'session not found' };
    if (session.submissions.length >= 2 && !session.submissions.find(s => s.userId === userId)) {
      return { ok: false, error: 'session already has two participants' };
    }

    if (privateKey <= 0n) return { ok: false, error: 'invalid private' };

    const pub = modPow(session.g, privateKey, session.p);
    const participant: DHParticipant = { userId, username, privateKey, publicKey: pub };

    const existing = session.submissions.findIndex(s => s.userId === userId);
    if (existing >= 0) session.submissions[existing] = participant;
    else session.submissions.push(participant);

    return { ok: true, publicKey: pub };
  }

  stepSession(sessionId: string): { ok: boolean; step?: number; payload?: any; error?: string } {
    const session = this.sessions.get(sessionId);
    if (!session) return { ok: false, error: 'session not found' };
    if (session.submissions.length < 2) return { ok: false, error: 'need two participants' };

    session.step++;
    const [a, b] = session.submissions.slice(0, 2);

    if (session.step === 1) {
      return {
        ok: true,
        step: 1,
        payload: {
          a: { username: a.username, publicKey: a.publicKey },
          b: { username: b.username, publicKey: b.publicKey },
          p: session.p
        }
      };
    }

    if (session.step === 2) {
      const sharedA = modPow(b.publicKey, a.privateKey, session.p);
      const sharedB = modPow(a.publicKey, b.privateKey, session.p);
      return {
        ok: true,
        step: 2,
        payload: {
          sharedA,
          sharedB,
          equal: sharedA === sharedB,
          p: session.p,
          a: { username: a.username, privateKey: a.privateKey, publicKey: a.publicKey },
          b: { username: b.username, privateKey: b.privateKey, publicKey: b.publicKey }
        }
      };
    }

    return { ok: false, error: 'no further steps' };
  }

  cancelSession(sessionId: string) {
    this.sessions.delete(sessionId);
  }

  private cleanup() {
    const now = Date.now();
    for (const [id, s] of this.sessions.entries()) {
      if (now - s.createdAt > this.ttl) this.sessions.delete(id);
    }
  }
}

export const dhSessionManager = new DHSessionManager();
