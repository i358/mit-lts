//@ts-nocheck
import { FastifyInstance } from 'fastify';
import { apiLogger as logger } from '../../../logger';
import { getUserRow, updateUserSecret, updateUserTTL } from '../../../db_utilities/postgres';
import { getRedisInstance } from '../../../db_utilities/redis';
import { Crypter } from '../../utils/crypter';
import { Timestamp } from '../../utils/timestamp';
import { Snowflake } from '../../utils/snowflake';
import { config } from '../../../config';
import base64url from 'base64url';
import * as crypto from 'crypto';
import axios from 'axios';
import { getBanInfo } from '../../../db_utilities/ban';
import { authenticateRequest } from '../../utils/authMiddleware';

const STATE_TTL = 15 * 60; // 15 minutes - CRITICAL: Increased from 50 seconds to prevent state reuse attacks

interface ResetPasswordPayload {
    state_id: number;
    password: string;
}

interface VerifyMottoPayload {
    username: string;
    type: 'reset' | 'forgot'; // reset: logged in users, forgot: login page
}

interface MottoVerificationPayload {
    state_id: number;
}

export default async function authRoute(fastify: FastifyInstance) {
    /**
     * POST /auth/verify-motto
     * Şifre sıfırlama veya kayıt işlemleri için motto doğrulama başlat
     * Params: username, type ('reset' for logged in, 'forgot' for login page)
     */
    fastify.post('/auth/verify-motto', async (request, reply) => {
        const { username, type } = request.body as Partial<VerifyMottoPayload>;

        if (!username || !type) {
            return reply.status(400).send({
                success: 0,
                error: 'Kullanıcı adı ve tür gerekli'
            });
        }

        if (type !== 'reset' && type !== 'forgot') {
            return reply.status(400).send({
                success: 0,
                error: 'Geçersiz tür'
            });
        }

        try {
            // Habbo API'den kullanıcıyı kontrol et
            const habboResponse = await axios.get(`https://www.habbo.com.tr/api/public/users?name=${encodeURIComponent(username)}`);
            
            if (!habboResponse.data || !habboResponse.data.uniqueId) {
                return reply.status(404).send({
                    success: 0,
                    error: 'Habboda böyle bir kullanıcı bulunamadı'
                });
            }

            // Sistem kullanıcısını kontrol et
            const siteUser = await getUserRow({
                in: 'username',
                value: username.toLowerCase(),
                out: 'all'
            });

            if (!siteUser) {
                return reply.status(404).send({
                    success: 0,
                    error: 'Bu kullanıcı sistemde kayıtlı değil'
                });
            }

            // Ban kontrolü
            const banInfo = await getBanInfo(siteUser.id);
            if (banInfo) {
                return reply.status(403).send({
                    success: 0,
                    banned: true,
                    ban_info: banInfo,
                    error: 'Bu hesap yasaklanmış'
                });
            }

            // Doğrulama kodu oluştur ([MIT]XXXXXXXX formatında)
            // SECURITY FIX: Use crypto.randomBytes instead of Math.random for security
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            const randomBytes = crypto.randomBytes(8);
            const verificationCode = '[MIT]' + Array.from(randomBytes, byte => 
                chars[byte % chars.length]
            ).join('');

            // State ID oluştur - use secure random bytes
            const stateBytes = crypto.randomBytes(4);
            const state_id = stateBytes.readUInt32BE(0);

            // Redis'e kaydet
            const redis = await getRedisInstance();
            const value = `${base64url(username)}:${base64url(verificationCode)}:false`;
            await redis.set(`auth_state:${state_id}`, value, 'EX', STATE_TTL);

            return reply.send({
                success: 1,
                state_id,
                verification_code: verificationCode,
                message: 'Doğrulama kodu oluşturuldu. Lütfen Habbo motto\'nuzu bu koda ayarlayın.'
            });

        } catch (error: any) {
            logger.error('Error in verify-motto:', error);
            return reply.status(500).send({
                success: 0,
                error: 'İç sunucu hatası'
            });
        }
    });

    /**
     * POST /auth/verify-motto-check
     * Motto doğrulama kontrolü yap
     * Params: state_id
     */
    fastify.post('/auth/verify-motto-check', async (request, reply) => {
        const { state_id } = request.body as Partial<MottoVerificationPayload>;

        if (!state_id) {
            return reply.status(400).send({
                success: 0,
                error: 'State ID gerekli'
            });
        }

        try {
            const redis = await getRedisInstance();
            const stateData = await redis.get(`auth_state:${state_id}`);

            if (!stateData) {
                return reply.status(404).send({
                    success: 0,
                    error: 'State bulunamadı veya süresi doldu'
                });
            }

            // State verisini parçala
            const [encodedUsername, encodedVerificationCode, isVerified] = stateData.split(':');
            const username = base64url.decode(encodedUsername);
            const verificationCode = base64url.decode(encodedVerificationCode);

            if (isVerified === 'true') {
                return reply.status(400).send({
                    success: 0,
                    error: 'State zaten doğrulandı'
                });
            }

            // Habbo API'den motto kontrolü
            const habboResponse = await axios.get(`https://www.habbo.com.tr/api/public/users?name=${encodeURIComponent(username)}`);
            
            if (!habboResponse.data || !habboResponse.data.motto) {
                return reply.status(404).send({
                    success: 0,
                    error: 'Kullanıcı mottosu doğrulanamadı'
                });
            }

            // Motto ile doğrulama kodu eşleşiyor mu?
            if (habboResponse.data.motto !== verificationCode) {
                return reply.status(400).send({
                    success: 0,
                    error: 'Doğrulama kodu mottosuyla eşleşmiyor'
                });
            }

            // State'i güncelle
            await redis.set(
                `auth_state:${state_id}`,
                `${encodedUsername}:${encodedVerificationCode}:true`,
                'EX',
                STATE_TTL
            );

            return reply.send({
                success: 1,
                message: 'Motto doğrulandı'
            });

        } catch (error: any) {
            logger.error('Error in verify-motto-check:', error);
            return reply.status(500).send({
                success: 0,
                error: 'İç sunucu hatası'
            });
        }
    });

    /**
     * POST /auth/reset-password
     * Oturum açmış kullanıcılar için şifre sıfırlama
     * Token gerekli, payload: state_id, password
     */
    fastify.post('/auth/reset-password', async (request, reply) => {
        const { state_id, password } = request.body as Partial<ResetPasswordPayload>;
        const clientIp = request.ip || '';

        if (!state_id || !password) {
            return reply.status(400).send({
                success: 0,
                error: 'State ID ve şifre gerekli'
            });
        }

        try {
            const result = await authenticateRequest(request as any);
            if (!result?.user) {
                return reply.status(401).send({
                    success: 0,
                    error: 'Token gerekli'
                });
            }

            const user = result.user;
            const md5Instance = new Crypter.MD5();

            // State kontrolü
            const redis = await getRedisInstance();
            const stateData = await redis.get(`auth_state:${state_id}`);

            if (!stateData) {
                return reply.status(404).send({
                    success: 0,
                    error: 'State bulunamadı veya süresi doldu'
                });
            }

            // State verisini parçala
            const [encodedUsername, , isVerified] = stateData.split(':');
            const username = base64url.decode(encodedUsername);

            if (isVerified !== 'true') {
                return reply.status(400).send({
                    success: 0,
                    error: 'State henüz doğrulanmadı'
                });
            }

            if (username.toLowerCase() !== user.username) {
                return reply.status(400).send({
                    success: 0,
                    error: 'Kullanıcı adı eşleşmiyor'
                });
            }

            // Yeni secret oluştur
            const metadata = {
                user_id: user.id,
                password: password
            };

            const hmacInstance = new Crypter.HMAC();
            const hmacKey = await md5Instance.create(jwtSecret, { encoding: 'none' });
            const hmac = await hmacInstance.create(JSON.stringify(metadata), hmacKey, { encoding: 'base64url' });

            // IV ve HMAC şifreleme
            const iv = crypto.randomBytes(16);
            const encryptedHmac = await new Crypter.AES256CBC().encrypt(hmac, {
                key: keyHash,
                iv: iv
            });

            const combinedSecret = iv.toString('hex') + (encryptedHmac as any).hash;

            // Veritabanını güncelle
            await updateUserSecret(user.id, combinedSecret);

            try {
                const ts = new Timestamp();
                const newTtl = await ts.Convert({ encoding: 'base64url' }, 'none');
                await updateUserTTL(user.id.toString(), newTtl as any);
            } catch (error) {
                logger.error('Failed to update user ttl during reset-password:', error);
            }

            // Redis'ten state'i temizle
            await redis.del(`auth_state:${state_id}`);

            logger.info(`User ${user.username} reset password successfully`);

            return reply.send({
                success: 1,
                message: 'Şifre başarıyla sıfırlandı'
            });

        } catch (error: any) {
            logger.error('Error in reset-password:', error);
            return reply.status(500).send({
                success: 0,
                error: 'İç sunucu hatası'
            });
        }
    });

    /**
     * POST /auth/forgot-password
     * Giriş sayfasında şifremi unuttum işlemi
     * Token gerektirmez, payload: state_id, password
     */
    fastify.post('/auth/forgot-password', async (request, reply) => {
        const { state_id, password } = request.body as Partial<ResetPasswordPayload>;
        const clientIp = request.ip || '';

        if (!state_id || !password) {
            return reply.status(400).send({
                success: 0,
                error: 'State ID ve şifre gerekli'
            });
        }

        try {
            // State kontrolü
            const redis = await getRedisInstance();
            const stateData = await redis.get(`auth_state:${state_id}`);

            if (!stateData) {
                return reply.status(404).send({
                    success: 0,
                    error: 'State bulunamadı veya süresi doldu'
                });
            }

            // State verisini parçala
            const [encodedUsername, , isVerified] = stateData.split(':');
            const username = base64url.decode(encodedUsername);

            if (isVerified !== 'true') {
                return reply.status(400).send({
                    success: 0,
                    error: 'State henüz doğrulanmadı'
                });
            }

            // Kullanıcı kontrolü
            const user = await getUserRow({
                in: 'username',
                value: username.toLowerCase(),
                out: 'all'
            });

            if (!user) {
                return reply.status(404).send({
                    success: 0,
                    error: 'Kullanıcı bulunamadı'
                });
            }

            // Ban kontrolü
            const banInfo = await getBanInfo(user.id, clientIp);
            if (banInfo) {
                return reply.status(403).send({
                    success: 0,
                    banned: true,
                    ban_info: banInfo,
                    error: 'Bu hesap yasaklanmış'
                });
            }

            // Yeni secret oluştur
            const metadata = {
                user_id: user.id,
                password: password
            };

            const jwtSecret = config().api.SECURITY?.JWT_SECRET;
            if (!jwtSecret) {
                throw new Error('JWT_SECRET not configured');
            }

            const keyHash = crypto.createHash('sha256').update(jwtSecret).digest();
            const hmacInstance = new Crypter.HMAC();
            const md5Instance = new Crypter.MD5();
            const hmacKey = await md5Instance.create(jwtSecret, { encoding: 'none' });
            const hmac = await hmacInstance.create(JSON.stringify(metadata), hmacKey, { encoding: 'base64url' });

            // IV ve HMAC şifreleme
            const iv = crypto.randomBytes(16);
            const encryptedHmac = await new Crypter.AES256CBC().encrypt(hmac, {
                key: keyHash,
                iv: iv
            });

            const combinedSecret = iv.toString('hex') + (encryptedHmac as any).hash;

            // Veritabanını güncelle
            await updateUserSecret(user.id, combinedSecret);

            // Redis'ten state'i temizle
            await redis.del(`auth_state:${state_id}`);

            logger.info(`User ${user.username} reset password via forgot-password`);

            return reply.send({
                success: 1,
                message: 'Şifre başarıyla sıfırlandı'
            });

        } catch (error: any) {
            logger.error('Error in forgot-password:', error);
            return reply.status(500).send({
                success: 0,
                error: 'İç sunucu hatası'
            });
        }
    });

    fastify.post('/auth/logout', async (request, reply) => {
        try {
            const result = await authenticateRequest(request as any, {}, 'required');
            if (!result?.user) {
                return reply.status(401).send({ success: 0, error: 'No token provided' });
            }

            const ts = new Timestamp();
            const newTtl = await ts.Convert({ encoding: 'base64url' }, 'none');
            await updateUserTTL(result.user.id.toString(), newTtl as any);

            reply.header('Set-Cookie', 'user_token=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax');

            return reply.send({
                success: 1
            });
        } catch (error) {
            logger.error('Error in logout:', error);
            return reply.status(500).send({
                success: 0,
                error: 'İç sunucu hatası'
            });
        }
    });
}
