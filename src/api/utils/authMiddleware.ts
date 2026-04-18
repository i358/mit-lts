import { FastifyReply, FastifyRequest } from 'fastify';
import base64url from 'base64url';
import crypto from 'crypto';
import { config } from '../../config';
import { apiLogger } from '../../logger';
import { getUserRow } from '../../db_utilities/postgres';
import { Crypter } from '../utils/crypter';

export type AuthInfo = {
    token: string;
    userId: string;
    timestamp: string;
    signature: string;
};

export type AuthResult = {
    user: any;
    auth: AuthInfo;
};

type RequireAuthOptions = {
    allowBanned?: boolean;
    requireUserFlagsNonZero?: boolean;
};

declare module 'fastify' {
    interface FastifyRequest {
        user?: any;
        auth?: AuthInfo;
    }
}

function parseCookieHeader(cookieHeader: string | undefined): Record<string, string> {
    if (!cookieHeader) return {};
    const out: Record<string, string> = {};
    for (const part of cookieHeader.split(';')) {
        const [rawKey, ...rest] = part.trim().split('=');
        if (!rawKey) continue;
        const key = rawKey;
        const value = rest.join('=');
        if (!value) continue;
        out[key] = decodeURIComponent(value);
    }
    return out;
}

function getTokenFromRequest(request: FastifyRequest): string | null {
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.split(' ')[1];
    }

    const cookies = parseCookieHeader(request.headers.cookie);
    const cookieToken = cookies['user_token'];
    if (cookieToken) return cookieToken;

    return null;
}

function makeAuthError(statusCode: number, message: string, extra?: Record<string, any>): Error {
    const err: any = new Error(message);
    err.statusCode = statusCode;
    if (extra) Object.assign(err, extra);
    return err;
}

/**
 * Validate token string (e.g. for WebSocket auth). Same checks as authenticateRequest including ban.
 */
export async function authenticateWithToken(
    token: string,
    options: RequireAuthOptions & { ip?: string } = {}
): Promise<AuthResult> {
    if (!token) throw makeAuthError(401, 'No token provided');

    const [id, timestamp, signature] = token.split('.');
    if (!id || !timestamp || !signature) {
        throw makeAuthError(401, 'Invalid token format');
    }

    const userId = base64url.decode(id);

    const jwtSecret = config().api.SECURITY?.JWT_SECRET;
    if (!jwtSecret) {
        throw new Error('JWT_SECRET not configured');
    }

    const user = await getUserRow({ in: 'id', value: userId, out: 'all' });
    if (!user) {
        throw makeAuthError(404, 'Kullanıcı bulunamadı');
    }

    if (!options.allowBanned) {
        const { getBanInfo } = await import('../../db_utilities/ban');
        const banInfo = await getBanInfo(userId, options.ip || '');
        if (banInfo) {
            throw makeAuthError(403, 'Bu hesap yasaklanmış', { banned: true, ban_info: banInfo });
        }
    }

    const aes = new Crypter.AES256CBC();
    const keyHash = crypto.createHash('sha256').update(jwtSecret).digest();

    const ivHex = user.secret.substring(0, 32);
    const encryptedData = user.secret.substring(32);
    const iv = Buffer.from(ivHex, 'hex');
    if (iv.length !== 16) {
        throw makeAuthError(401, 'Token verification failed');
    }

    const decryptedHmac = await aes.decrypt(encryptedData, { key: keyHash, iv });
    
    // Use timing-safe comparison to prevent timing attacks
    try {
        crypto.timingSafeEqual(
            Buffer.from(signature),
            Buffer.from(decryptedHmac as string)
        );
    } catch {
        throw makeAuthError(401, 'Invalid token signature');
    }

    if (user.ttl && timestamp !== user.ttl) {
        throw makeAuthError(401, 'Token revoked');
    }

    if (options.requireUserFlagsNonZero) {
        const userFlagsBigInt = BigInt(user.user_flags || 0);
        if (userFlagsBigInt === 0n) {
            throw makeAuthError(403, 'Insufficient permissions');
        }
    }

    return {
        user,
        auth: { token, userId, timestamp, signature }
    };
}

export async function authenticateRequest(
    request: FastifyRequest,
    options: RequireAuthOptions = {},
    mode: 'required' | 'optional' = 'required'
): Promise<AuthResult | null> {
    const token = getTokenFromRequest(request);
    if (!token) {
        if (mode === 'optional') return null;
        throw makeAuthError(401, 'No token provided');
    }
    return authenticateWithToken(token, { ...options, ip: request.ip }) as Promise<AuthResult | null>;
}

async function verifyAndAttachUser(
    request: FastifyRequest,
    reply: FastifyReply,
    options: RequireAuthOptions,
    isOptional: boolean
): Promise<void> {
    try {
        const result = await authenticateRequest(request, options, isOptional ? 'optional' : 'required');
        if (!result) return;

        request.user = result.user;
        request.auth = result.auth;
    } catch (error) {
        apiLogger.error('Auth middleware error:', error);
        const err: any = error;
        const status = typeof err?.statusCode === 'number' ? err.statusCode : 401;

        if (isOptional) {
            reply.status(status).send({ success: 0, error: err?.message || 'Token verification failed' });
            return;
        }

        if (err?.banned) {
            reply.status(status).send({ success: 0, banned: true, ban_info: err.ban_info, error: err?.message || 'Bu hesap yasaklanmış' });
            return;
        }

        reply.status(status).send({ success: 0, error: err?.message || 'Token verification failed' });
    }
}

export function requireAuth(options: RequireAuthOptions = {}) {
    return async (request: FastifyRequest, reply: FastifyReply) => {
        await verifyAndAttachUser(request, reply, options, false);
    };
}

export function optionalAuth(options: RequireAuthOptions = {}) {
    return async (request: FastifyRequest, reply: FastifyReply) => {
        await verifyAndAttachUser(request, reply, options, true);
    };
}
 