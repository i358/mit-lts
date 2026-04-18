//@ts-nocheck
import { FastifyInstance } from 'fastify';
import { getUser, getUserRow, updateUserRow, createUserRow } from '../../../db_utilities/postgres';
import { deleteUserRow } from '../../../db_utilities/user_management';
import { apiLogger } from '../../../logger';
import base64url from 'base64url';
import { Crypter } from '../../utils/crypter';
import crypto from 'crypto';
import { config } from '../../../config';
import { hasPermissionMask } from '../../../types/permissions';
import { logManagementAction } from '../../../utils/discordLog';
import axios from 'axios';
import { Snowflake } from '../../utils/snowflake';
import { Timestamp } from '../../utils/timestamp';
import { requireAuth } from '../../utils/authMiddleware';

async function verifyToken(authHeader: string | undefined) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new Error('No token provided');
    }

    const token = authHeader.split(' ')[1];
    const [id, timestamp, signature] = token.split('.');

    if (!id || !timestamp || !signature) {
        throw new Error('Invalid token format');
    }

    // User ID'yi decode et
    const userId = base64url.decode(id);

    // Ban kontrolü
    const { getBanInfo } = await import('../../../db_utilities/ban');
    const banInfo = await getBanInfo(userId);
    if (banInfo) {
        const error = new Error('Bu hesap yasaklanmış');
        Object.assign(error, { banned: true, ban_info: banInfo });
        throw error;
    }

    // JWT Secret kontrol
    const jwtSecret = config().api.SECURITY?.JWT_SECRET;
    if (!jwtSecret) {
        throw new Error('JWT_SECRET not configured');
    }

    // Kullanıcıyı bul
    const user = await getUserRow({
        in: 'id',
        value: userId,
        out: 'all'
    });

    if (!user) {
        throw new Error('User not found');
    }

    // HMAC doğrulama
    const aes = new Crypter.AES256CBC();
    const keyHash = crypto.createHash('sha256').update(jwtSecret).digest();

    try {
        const ivHex = user.secret.substring(0, 32);
        const encryptedData = user.secret.substring(32);
        const iv = Buffer.from(ivHex, 'hex');
        
        if (iv.length !== 16) {
            throw new Error(`Invalid IV length: ${iv.length} bytes`);
        }

        const decryptedHmac = await aes.decrypt(encryptedData, {
            key: keyHash,
            iv: iv
        });

        if (signature !== decryptedHmac) {
            throw new Error('Invalid token signature');
        }

        // User flags kontrolü
        const userFlagsBigInt = BigInt(user.user_flags || 0);
        if (userFlagsBigInt === 0n) {
            throw new Error('Insufficient permissions');
        }

        return user;
    } catch (error) {
        apiLogger.error('Token verification error:', error);
        throw new Error('Token verification failed');
    }
}

// Import gerekli modüller
import { getUser, getAllUserTimes, getWeeklyTimeData } from '../../../db_utilities';
import { getUserTime } from '../../../db_utilities';
import { getUserWorkTime, resetUserWorkTime, setUserWorkTime } from '../../../db_utilities/work_time';
import { timerWorker } from '../../../workers/timer';
import { getPostgresInstance } from '../../../db_utilities/postgres';

export default async function managementRoute(fastify: FastifyInstance) {
    const managementAuth = requireAuth({ requireUserFlagsNonZero: true });
    fastify.addHook('preHandler', async (request, reply) => {
        const url = request.url || '';
        if (url.startsWith('/management') || url.startsWith('/v1/management')) {
            await managementAuth(request as any, reply as any);
        }
    });

    interface QueryParams {
        page?: string;
        limit?: string;
    }

    interface SearchQueryParams extends QueryParams {
        q?: string;
    }

    // POST /management/users (require: "users.CREATE")   Body: { username: string; password?: string; badge: number; rank: number; extras?: string[];}
    fastify.post<{
        Body: { username: string; password?: string; badge: number; rank: number; extras?: string[];};
    }>('/management/users', async (request, reply) => {
        try {
            const authenticatedUser = (request as any).user;
            const { username, badge, rank } = request.body;
            let password = request.body.password || '&random';
            let user_flags = '0';
            let userFlags = BigInt(authenticatedUser.user_flags || 0);

            if (!hasPermissionMask(userFlags, "USERS", "CREATE")) {
                return reply.status(403).send({
                    success: 0,
                    error: 'Bu işlem için yetkiniz yok'
                });
            }
           // get habbo.com.tr user api and validate if user exists
           let habboUser;
           try {
               const response = await axios.get(`https://www.habbo.com.tr/api/public/users?name=${username}`);
               habboUser = response.data;
               if (!habboUser || !habboUser.uniqueId) {
                   return reply.status(404).send({
                       success: 0,
                       error: 'Habbo kullanıcısı bulunamadı'
                   });
               }
           } catch (error) {
               return reply.status(404).send({
                   success: 0,
                   error: 'Habbo kullanıcısı bulunamadı'
               });
           }
           let stackUser = await getUser({
                in: "username",
                value: username,
                out: "all"
            })
            if(!stackUser){
                return reply.status(400).send({
                    success: 0,
                    error: 'Kullanıcı odada bulunamadı'
                });
            }
           
           // Stack'ten Habbo ID'yi al
           const habbo_id = stackUser.id;
            // Check if user already exists in our database
            const existingUser = await getUserRow({
                in: 'username',
                value: username,
                out: 'all'
            });
            if (existingUser) {
                return reply.status(400).send({
                    success: 0,
                    error: 'Bu kullanıcı zaten mevcut'
                });
            }
            // check if user exists in stack
            
            // Bitflags hesaplama
            const { DEFAULT_BITFLAGS, bitflagsManager } = await import('../../../utils/bitflagsManager');
            const calculatedBitflags = badge > 0 ? bitflagsManager.calculateBitflags(badge, DEFAULT_BITFLAGS) : DEFAULT_BITFLAGS;
            // create a hmac secret 
            const jwtSecret = config().api.SECURITY?.JWT_SECRET;
            if (!jwtSecret) {
                throw new Error('JWT_SECRET not configured');
            }
            if(password === '&random'){
                // generate a random 12 character password
                password = crypto.randomBytes(6).toString('hex');
            }
              const snowflake = new Snowflake();
                                const timestamp = new Timestamp();
                                const user_id = await snowflake.createUUID({ encoding: 'none' });
      
                    // JWT Secret'dan 32-byte key oluştur
                    const keyHash = crypto.createHash('sha256').update(jwtSecret).digest();
                    
                    apiLogger.debug('Registration key details:', {
                        keyHashLength: keyHash.length,
                        keyHashBytes: Array.from(keyHash)
                    });
                    apiLogger.debug('Key Generation:', {
                        keyLength: keyHash.length,
                        expectedLength: 32
                    });

                    // Metadata oluştur
                    const metadata = {
                        user_id: user_id.toString(),
                        password: password
                    };
                    
                    // Metadata stringification'ı logla
                    // HMAC oluştur
                    const hmacInstance = new Crypter.HMAC();
                    const md5Instance = new Crypter.MD5();
                    const hmacKey = await md5Instance.create(jwtSecret, { encoding: 'none' });
                    const hmac = await hmacInstance.create(JSON.stringify(metadata), hmacKey, { encoding: 'base64url' });
                    
                    // Timestamp oluştur
                    const timestampValue = await timestamp.Convert({ encoding: 'base64url' }, 'none');

                    // IV ve HMAC şifreleme
                    const iv = crypto.randomBytes(16);

                    const encryptedHmac = await new Crypter.AES256CBC().encrypt(hmac, {
                        key: keyHash, // 32-byte hash kullan
                        iv: iv
                    });

                    // IV'nin 16 byte olduğundan emin ol
                    if (iv.length !== 16) {
                        throw new Error(`Invalid IV length during registration: ${iv.length} bytes`);
                    };

                    // IV ve encrypted data'yı birleştir
                    const combinedSecret = iv.toString('hex') + (encryptedHmac as any).hash;



                    // Avatar URL'ini oluştur
                    const avatarUrl = `https://www.habbo.com.tr/habbo-imaging/avatarimage?user=${encodeURIComponent(username)}&direction=2&head_direction=2&gesture=nrm&size=l`;

                    // Veritabanına kaydetmeden önce veriyi logla
                    apiLogger.debug('Attempting to create user with data:', {
                        id: user_id.toString(),
                        username: username.toLowerCase(),
                        habbo_id,
                        secret: `${combinedSecret.substring(0, 32)}...`, // IV kısmını göster
                        avatar: avatarUrl,
                        extras: request.body.extras || []
                    });

                    // Kalıcı kullanıcı kaydını users tablosuna yap
                    const createdUser = await createUserRow({
                        id: user_id.toString(), // Keep as string to preserve precision
                        username: username.toLowerCase(),
                        habbo_id, // Stack'teki key değeri (Habbo ID)
                        secret: combinedSecret, // IV + encrypted data birleşik format
                        avatar: avatarUrl,
                        badge,
                        rank,
                        salary: BigInt(0),
                        bitflags: calculatedBitflags,
                        extras: request.body.extras || [],
                        ip_addr: '0.0.0.0' 
                    });

                    // Discord'a logla
                    await logManagementAction({
                        action: 'Kullanıcı Oluşturma',
                        adminUsername: authenticatedUser.username,
                        targetUsername: username.toLowerCase(),
                        details: `Rozet: ${badge}, Rütbe: ${rank}, Extras: ${(request.body.extras || []).join(', ')}`,
                        success: true
                    });

                    return reply.send({
                        success: 1,
                        message: 'Kullanıcı başarıyla oluşturuldu'
                    });

        } catch (error: any) {
            apiLogger.error('Error in user creation:', error);
            // Hata durumunu Discord'a logla
            const authenticatedUser = (request as any).user;
            if (authenticatedUser?.username) {
                await logManagementAction({
                    action: 'Kullanıcı Oluşturma Hatası',   
                    adminUsername: authenticatedUser.username,
                    targetUsername: request.body?.username?.toLowerCase(),
                    details: error.message || 'Internal server error',
                    success: false
                });
            }

            if (error.message === 'Insufficient permissions') { 
                return reply.status(403).send({
                    success: 0,
                    error: 'Bu işlem için yetkiniz yok'
                });
            }
            
            if (error.message === 'Bu hesap yasaklanmış') {
                return reply.status(403).send({
                    success: 0,
                    banned: true,
                    ban_info: error.ban_info,
                    error: error.message
                });
            }
            
            return reply.status(error.message.includes('token') ? 401 : 500).send({
                success: 0,
                error: error.message || 'Internal server error'
            });
        }
    });
    // PUT /management/users/:id {badge: number, rank: number, extras?: string[]} (require: "users.UPDATE")

    fastify.put<{
        Params: { id: string };
        Body: { badge: number; rank: number; extras?: string[] };
    }>('/management/users/:id', async (request, reply) => {
        try {
            const user = (request as any).user;
            const userIdToUpdate = request.params.id;
            const { badge, rank } = request.body;

            let userFlags = BigInt(user.user_flags || 0);
            if (!hasPermissionMask(userFlags, "USERS", "UPDATE")) {
                return reply.status(403).send({
                    success: 0,
                    error: 'Bu işlem için yetkiniz yok'
                });
            }

            // Kullanıcının ban durumunu kontrol et
            const { checkUserBanned } = await import('../../../db_utilities/ban');
            const isBanned = await checkUserBanned(userIdToUpdate);
            if (isBanned) {
                return reply.status(403).send({
                    success: 0,
                    error: 'Yasaklı kullanıcılar düzenlenemez'
                });
            }

            // Bitflags hesaplama
            const { DEFAULT_BITFLAGS, bitflagsManager } = await import('../../../utils/bitflagsManager');
            const newBitflags = badge > 0 
                ? bitflagsManager.calculateBitflags(badge, DEFAULT_BITFLAGS)
                : DEFAULT_BITFLAGS;

          
            // Hedef kullanıcıyı al
            const targetUser = await getUserRow({
                in: 'id',
                value: userIdToUpdate,
                out: 'all'
            });

            // Hem badge/rank hem de bitflags güncelle
            const updatedUser = await updateUserRow(userIdToUpdate, { 
                badge, 
                rank,
                bitflags: newBitflags,
                extras: request.body.extras || targetUser.extras || []
            });

            // Discord'a logla
            await logManagementAction({
                action: 'Kullanıcı Güncelleme',
                adminUsername: user.username,
                targetUsername: targetUser?.username,
                details: `Rozet: ${badge}, Rütbe: ${rank}, Extras: ${(request.body.extras || targetUser.extras || []).join(', ')}`,
                success: true
            });

            return reply.send({
                success: 1,
                message: 'Kullanıcı bilgileri güncellendi'
            });
        } catch (error: any) {
            apiLogger.error('Error in user update:', error);

            // Hata durumunu Discord'a logla
            if (user?.username) {
                await logManagementAction({
                    action: 'Kullanıcı Güncelleme Hatası',
                    adminUsername: user.username,
                    targetUsername: userIdToUpdate,
                    details: error.message || 'Internal server error',
                    success: false
                });
            }

            if (error.message === 'Insufficient permissions') {
                return reply.status(403).send({
                    success: 0,
                    error: 'Bu işlem için yetkiniz yok'
                });
            }
            return reply.status(error.message.includes('token') ? 401 : 500).send({
                success: 0,
                error: error.message || 'Internal server error'
            });
        }
    });


    // PUT /management/users/:id/permissions {permissions:BigInt string}
    fastify.put<{
        Params: { id: string };
        Body: { permissions: string };
    }>('/management/users/:id/permissions', async (request, reply) => {
        try {
            const user = (request as any).user;
            const userIdToUpdate = request.params.id;
            const newPermissionsStr = request.body.permissions;
            let userFlags = BigInt(user.user_flags || 0);
            
            // Temel yetki kontrolü
            if(!hasPermissionMask(userFlags, "USERS", "MANAGE")){
                return reply.status(403).send({
                    success: 0,
                    error: 'Bu işlem için yetkiniz yok'
                });
            }

            // Hedef kullanıcıyı kontrol et
            const targetUser = await getUserRow({
                in: 'id',
                value: userIdToUpdate,
                out: 'all'
            });

            if (!targetUser) {
                return reply.status(404).send({
                    success: 0,
                    error: 'Kullanıcı bulunamadı'
                });
            }

            const targetFlags = BigInt(targetUser.user_flags || 0);
            const newPermissions = BigInt(newPermissionsStr);

            // Admin yetkisi kontrolü (1n << 29n, ADMIN yetkisinin bit pozisyonu)
            const isAdmin = (userFlags & (1n << 29n)) === (1n << 29n);

            if (!isAdmin) {
                // Admin değilse kendi yetkilerini kontrol et
                if ((targetFlags & userFlags) !== targetFlags) {
                    return reply.status(403).send({
                        success: 0,
                        error: 'Hedef kullanıcı sizden daha yüksek yetkiye sahip'
                    });
                }

                // Admin değilse sadece kendi yetkilerini verebilir
                if ((newPermissions & userFlags) !== newPermissions) {
                    return reply.status(403).send({
                        success: 0,
                        error: 'Sadece kendinizde olan yetkileri verebilirsiniz'
                    });
                }
            }

            // Admin yetkisi olan kullanıcı başka birine admin yetkisi vermeye çalışıyorsa ek kontrol
            if (isAdmin && (newPermissions & (1n << 29n)) === (1n << 29n)) {
                // Admin yetkisi verilmeye çalışılıyor, log tutalım
                apiLogger.warn('Admin permission assignment attempt:', {
                    adminUser: user.username,
                    targetUser: targetUser.username,
                    newPermissions: newPermissions.toString()
                });
            }

            const { updateUserPermissions } = await import('../../../db_utilities/user_management');
            await updateUserPermissions(userIdToUpdate, newPermissions);
            
            // Discord'a logla
            await logManagementAction({
                action: 'Yetki Güncelleme',
                adminUsername: user.username,
                targetUsername: targetUser.username,
                details: `Yeni yetkiler: ${newPermissionsStr}`,
                success: true
            });

            return reply.send({
                success: 1,
                message: 'Kullanıcı izinleri güncellendi'
            });
            
            

        }catch(error: any){
            apiLogger.error('Error in permission update:', error);

            // Hata durumunu Discord'a logla
            if (user?.username) {
                await logManagementAction({
                    action: 'Yetki Güncelleme Hatası',
                    adminUsername: user.username,
                    targetUsername: userIdToUpdate,
                    details: error.message || 'Internal server error',
                    success: false
                });
            }

            if (error.message === 'Insufficient permissions') {
                return reply.status(403).send({
                    success: 0,
                    error: 'Bu işlem için yetkiniz yok'
                });
            }
            return reply.status(error.message.includes('token') ? 401 : 500).send({
                success: 0,
                error: error.message || 'Internal server error'
            });
        }
    });

    // Kullanıcıları listele
    fastify.get<{
        Querystring: QueryParams
    }>('/management/users', async (request, reply) => {
        try {
            const user = (request as any).user;
            
            // Sayfalama parametreleri
            const page = Number(request.query.page) || 1;
            const limit = Number(request.query.limit) || 10;
            const offset = (page - 1) * limit;
            let userFlags = BigInt(user.user_flags || 0);
            if(!hasPermissionMask(userFlags, "USERS", "LIST")){
                return reply.status(403).send({
                    success: 0,
                    error: 'Bu işlem için yetkiniz yok'
                });
            }
                            // Kullanıcıları getir
            const { getUserCount, getUserList } = await import('../../../db_utilities/user_management');
            const users = await getUserList(limit, offset);
            const totalCount = await getUserCount();

            // Her kullanıcı için extra bilgileri dahil et
            const usersWithExtras = users.map(user => ({
                ...user,
                extras: user.extras || []
            }));

            // Toplam sayfa sayısı
            const totalPages = Math.ceil(totalCount / limit);

            return reply.send({
                success: 1,
                data: {
                    users: usersWithExtras,
                    pagination: {
                        page,
                        limit,
                        total: totalCount,
                        totalPages
                    }
                }
            });

        } catch (error: any) {
            apiLogger.error('Error in user listing:', error);
            
            if (error.message === 'Insufficient permissions') {
                return reply.status(403).send({
                    success: 0,
                    error: 'Bu işlem için yetkiniz yok'
                });
            }

            return reply.status(error.message.includes('token') ? 401 : 500).send({
                success: 0,
                error: error.message || 'Internal server error'
            });
        }
    });

    // Kullanıcı arama (username ile, pagination destekli)
    fastify.get<{
        Querystring: SearchQueryParams
    }>('/management/users/search', async (request, reply) => {
        try {
            const user = (request as any).user;

            const q = (request.query.q || '').toString().trim();
            const page = Number(request.query.page) || 1;
            const limit = Number(request.query.limit) || 10;
            const offset = (page - 1) * limit;

            let userFlags = BigInt(user.user_flags || 0);
            if (!hasPermissionMask(userFlags, 'USERS', 'LIST')) {
                return reply.status(403).send({
                    success: 0,
                    error: 'Bu işlem için yetkiniz yok'
                });
            }

            if (!q) {
                return reply.send({
                    success: 1,
                    data: {
                        users: [],
                        pagination: {
                            page,
                            limit,
                            total: 0,
                            totalPages: 0
                        }
                    }
                });
            }

            const { searchUserCount, searchUserList } = await import('../../../db_utilities/user_management');
            const users = await searchUserList(q, limit, offset);
            const totalCount = await searchUserCount(q);

            const usersWithExtras = users.map(user => ({
                ...user,
                extras: user.extras || []
            }));

            const totalPages = Math.ceil(totalCount / limit);

            return reply.send({
                success: 1,
                data: {
                    users: usersWithExtras,
                    pagination: {
                        page,
                        limit,
                        total: totalCount,
                        totalPages
                    }
                }
            });

        } catch (error: any) {
            apiLogger.error('Error in user search:', error);

            if (error.message === 'Insufficient permissions') {
                return reply.status(403).send({
                    success: 0,
                    error: 'Bu işlem için yetkiniz yok'
                });
            }

            return reply.status(error.message.includes('token') ? 401 : 500).send({
                success: 0,
                error: error.message || 'Internal server error'
            });
        }
    });

    // POST /management/users/:id/ban - Kullanıcı yasaklama
    fastify.post<{
        Params: { id: string };
        Body: {
            reason?: string;
            permanently: boolean;
            expires?: string;
        };
    }>('/management/users/:id/ban', async (request, reply) => {
        try {
            const { routeRateLimits } = await import('../../utils/actionRateLimiter');
            if (!(await routeRateLimits.ban.checkRateLimit(request, reply))) {
                return;
            }

            const authenticatedUser = (request as any).user;
            const userIdToBan = request.params.id;

            // Yetki kontrolü
            let userFlags = BigInt(authenticatedUser.user_flags || 0);
            if (!hasPermissionMask(userFlags, "USERS", "BAN")) {
                return reply.status(403).send({
                    success: 0,
                    error: 'Bu işlem için yetkiniz yok'
                });
            }

            // Hedef kullanıcıyı kontrol et
            const targetUser = await getUserRow({
                in: 'id',
                value: userIdToBan,
                out: 'all'
            });

            if (!targetUser) {
                return reply.status(404).send({
                    success: 0,
                    error: 'Kullanıcı bulunamadı'
                });
            }

            // Admin yetkisi kontrolü (1n << 29n, ADMIN yetkisinin bit pozisyonu)
            const isAdmin = (userFlags & (1n << 29n)) === (1n << 29n);
            const targetFlags = BigInt(targetUser.user_flags || 0);

            // Admin değilse ve hedef kullanıcı daha yüksek yetkiye sahipse işlemi reddet
            if (targetFlags > userFlags) {
                return reply.status(403).send({
                    success: 0,
                    error: 'Kendinizden daha yüksek yetkili kullanıcıları yasaklayamazsınız'
                });
            }

            // Ban durumunu kontrol et
            const { checkUserBanned } = await import('../../../db_utilities/ban');
            const isBanned = await checkUserBanned(userIdToBan);
            if (isBanned) {
                return reply.status(400).send({
                    success: 0,
                    error: 'Bu kullanıcı zaten yasaklı'
                });
            }

            const { reason, permanently, expires } = request.body;

            // Kullanıcıyı yasakla - bitflags'i 0 yap ve BAN flag'i ekle
            await updateUserRow(userIdToBan, { 
                bitflags: BigInt(0),
                user_flags: BigInt(0)
            });

            try {
                const ts = new Timestamp();
                const newTtl = await ts.Convert({ encoding: 'base64url' }, 'none');
                const { updateUserTTL } = await import('../../../db_utilities/postgres');
                await updateUserTTL(userIdToBan, newTtl as any);
            } catch (error) {
                apiLogger.error('Failed to update user ttl during ban:', error);
            }

            // Ban kaydı oluştur
            const { createBanRecord } = await import('../../../db_utilities/ban');
            await createBanRecord({
                username: targetUser.username,
                authoritative: authenticatedUser.username,
                user_id: targetUser.id,
                authoritative_id: authenticatedUser.id,
                permanently,
                expires: expires ? new Date(expires) : undefined,
                ip_addr: targetUser.ip_addr || '0.0.0.0',
                reason
            });

            // Discord'a logla
            const banType = permanently ? 'Kalıcı Ban' : `Geçici Ban (${new Date(expires || '').toLocaleString('tr-TR')})`;
            await logManagementAction({
                action: 'Kullanıcı Yasaklama',
                adminUsername: authenticatedUser.username,
                targetUsername: targetUser.username,
                details: `${banType}${reason ? ` - Sebep: ${reason}` : ''}`,
                success: true
            });

            return reply.send({
                success: 1,
                message: 'Kullanıcı başarıyla yasaklandı'
            });

        } catch (error: any) {
            apiLogger.error('Error in user ban:', error);

            // Hata durumunu Discord'a logla
            const authenticatedUser = (request as any).user;
            if (authenticatedUser?.username) {
                await logManagementAction({
                    action: 'Kullanıcı Yasaklama Hatası',
                    adminUsername: authenticatedUser.username,
                    targetUsername: request.params.id,
                    details: error.message || 'Internal server error',
                    success: false
                });
            }

            if (error.message === 'Insufficient permissions') {
                return reply.status(403).send({
                    success: 0,
                    error: 'Bu işlem için yetkiniz yok'
                });
            }

            return reply.status(error.message.includes('token') ? 401 : 500).send({
                success: 0,
                error: error.message || 'Internal server error'
            });
        }
    });

    // GET /management/times - Tüm kullanıcıların süre bilgileri
    fastify.get('/management/times', async (request, reply) => {
        try {
            const user = (request as any).user;
            let userFlags = BigInt(user.user_flags || 0);
            
            const canListUsers = hasPermissionMask(userFlags, "USERS", "LIST");
            const canTimeUpdate = hasPermissionMask(userFlags, "TIME", "UPDATE");
            const canTimeReset = hasPermissionMask(userFlags, "TIME", "RESET");

            if (!(canListUsers || canTimeUpdate || canTimeReset)) {
                return reply.status(403).send({
                    success: 0,
                    error: 'Bu işlem için yetkiniz yok'
                });
            }

            const { getAllUserTimeData } = await import('../../../db_utilities/time_management');
            const timeData = await getAllUserTimeData();

            return reply.send({
                success: 1,
                data: timeData
            });

        } catch (error: any) {
            apiLogger.error('Error fetching time data:', error);

            if (error.message === 'Insufficient permissions') {
                return reply.status(403).send({
                    success: 0,
                    error: 'Bu işlem için yetkiniz yok'
                });
            }

            return reply.status(error.message.includes('token') ? 401 : 500).send({
                success: 0,
                error: error.message || 'Internal server error'
            });
        }
    });

    // GET /management/times/weekly - Haftalık süre verileri (weekly_time tablosu)
    fastify.get<{ Querystring: { week?: string } }>('/management/times/weekly', async (request, reply) => {
        try {
            const user = (request as any).user;
            const userFlags = BigInt(user.user_flags || 0);

            const canListUsers = hasPermissionMask(userFlags, "USERS", "LIST");
            const canTimeUpdate = hasPermissionMask(userFlags, "TIME", "UPDATE");
            const canTimeReset = hasPermissionMask(userFlags, "TIME", "RESET");

            if (!(canListUsers || canTimeUpdate || canTimeReset)) {
                return reply.status(403).send({ success: 0, error: 'Bu işlem için yetkiniz yok' });
            }

            const { week } = request.query || {};
            const data = await getWeeklyTimeData(week);
            return reply.send({ success: 1, data });
        } catch (error: any) {
            apiLogger.error('Error fetching weekly time data:', error);
            return reply.status(error.message?.includes('token') ? 401 : 500).send({
                success: 0,
                error: error.message || 'Internal server error'
            });
        }
    });

    // DELETE /management/users/:id - Kullanıcı silme
    fastify.delete<{
        Params: { id: string };
    }>('/management/users/:id', async (request, reply) => {
        try {
            const { routeRateLimits } = await import('../../utils/actionRateLimiter');
            if (!(await routeRateLimits.delete.checkRateLimit(request, reply))) {
                return;
            }

            const authenticatedUser = (request as any).user;
            const userIdToDelete = request.params.id;

            // Yetki kontrolü
            let userFlags = BigInt(authenticatedUser.user_flags || 0);
            if (!hasPermissionMask(userFlags, "USERS", "DELETE")) {
                return reply.status(403).send({
                    success: 0,
                    error: 'Bu işlem için yetkiniz yok'
                });
            }

            // Hedef kullanıcıyı kontrol et
            const targetUser = await getUserRow({
                in: 'id',
                value: userIdToDelete,
                out: 'all'
            });

            if (!targetUser) {
                return reply.status(404).send({
                    success: 0,
                    error: 'Kullanıcı bulunamadı'
                });
            }

            // Admin yetkisi kontrolü (1n << 29n, ADMIN yetkisinin bit pozisyonu)
            const isAdmin = (userFlags & (1n << 29n)) === (1n << 29n);
            const targetFlags = BigInt(targetUser.user_flags || 0);

            // Kendini silmeye çalışıyor mu kontrol et
            if (userIdToDelete === authenticatedUser.id) {
                return reply.status(400).send({
                    success: 0,
                    error: 'Kendi hesabınızı silemezsiniz'
                });
            }

            // Ban durumunu kontrol et
            const { checkUserBanned } = await import('../../../db_utilities/ban');
            const isBanned = await checkUserBanned(userIdToDelete);
            if (isBanned) {
                return reply.status(400).send({
                    success: 0,
                    error: 'Yasaklı kullanıcıyı silmeden önce yasağını kaldırın'
                });
            }

            // Yetki seviyesi kontrolü
            // Admin tüm kullanıcıları silebilir
            if (!isAdmin) {
                // Admin olmayan kullanıcılar kendilerinden yüksek yetkili kullanıcıları silemez
                if (targetFlags > userFlags) {
                    return reply.status(403).send({
                        success: 0,
                        error: 'Kendinizden daha yüksek yetkili kullanıcıları silemezsiniz'
                    });
                }
                
                // Admin olmayan kullanıcılar admin yetkisine sahip kullanıcıları silemez
                if ((targetFlags & (1n << 29n)) === (1n << 29n)) {
                    return reply.status(403).send({
                        success: 0,
                        error: 'Admin yetkisine sahip kullanıcıları silemezsiniz'
                    });
                }
            }

            // Kullanıcıyı sil
            await deleteUserRow(userIdToDelete);

            // Discord'a logla
            await logManagementAction({
                action: 'Kullanıcı Silme',
                adminUsername: authenticatedUser.username,
                targetUsername: targetUser.username,
                details: 'Kullanıcı hesabı kalıcı olarak silindi',
                success: true
            });

            return reply.send({
                success: 1,
                message: 'Kullanıcı başarıyla silindi'
            });

        } catch (error: any) {
            apiLogger.error('Error in user deletion:', error);

            // Hata durumunu Discord'a logla
            const authenticatedUser = (request as any).user;
            if (authenticatedUser?.username) {
                await logManagementAction({
                    action: 'Kullanıcı Silme Hatası',
                    adminUsername: authenticatedUser.username,
                    targetUsername: request.params.id,
                    details: error.message || 'Internal server error',
                    success: false
                });
            }

            if (error.message === 'Insufficient permissions') {
                return reply.status(403).send({
                    success: 0,
                    error: 'Bu işlem için yetkiniz yok'
                });
            }

            return reply.status(error.message.includes('token') ? 401 : 500).send({
                success: 0,
                error: error.message || 'Internal server error'
            });
        }
    });

    // POST /management/users/:id/unban - Kullanıcı yasağını kaldırma
    fastify.post<{
        Params: { id: string };
    }>('/management/users/:id/unban', async (request, reply) => {
        try {
            const authenticatedUser = (request as any).user;
            const userIdToUnban = request.params.id;

            // Yetki kontrolü
            let userFlags = BigInt(authenticatedUser.user_flags || 0);
            if (!hasPermissionMask(userFlags, "USERS", "BAN")) {
                return reply.status(403).send({
                    success: 0,
                    error: 'Bu işlem için yetkiniz yok'
                });
            }

            // Hedef kullanıcıyı kontrol et
            const targetUser = await getUserRow({
                in: 'id',
                value: userIdToUnban,
                out: 'all'
            });

            if (!targetUser) {
                return reply.status(404).send({
                    success: 0,
                    error: 'Kullanıcı bulunamadı'
                });
            }

            // Admin yetkisi kontrolü (1n << 29n, ADMIN yetkisinin bit pozisyonu)
            const isAdmin = (userFlags & (1n << 29n)) === (1n << 29n);
            const targetOriginalFlags = BigInt(targetUser.user_flags || 0);

            // Admin değilse ve hedef kullanıcı daha yüksek yetkiye sahipse işlemi reddet
            if (!isAdmin && targetOriginalFlags > userFlags) {
                return reply.status(403).send({
                    success: 0,
                    error: 'Kendinizden daha yüksek yetkili kullanıcıların yasağını kaldıramazsınız'
                });
            }

            // Ban durumunu kontrol et
            const { checkUserBanned, removeBan } = await import('../../../db_utilities/ban');
            const isBanned = await checkUserBanned(userIdToUnban);
            if (!isBanned) {
                return reply.status(400).send({
                    success: 0,
                    error: 'Bu kullanıcı yasaklı değil'
                });
            }

            // Ban kaydını güncelle
            await removeBan(userIdToUnban);

            // Bitflags'i geri yükle ve diğer bilgileri güncelle
            const { DEFAULT_BITFLAGS, bitflagsManager } = await import('../../../utils/bitflagsManager');
            const restoredBitflags = targetUser.badge > 0 
                ? bitflagsManager.calculateBitflags(targetUser.badge, DEFAULT_BITFLAGS)
                : DEFAULT_BITFLAGS;

            // Kullanıcıyı güncelle
            await updateUserRow(userIdToUnban, {
                bitflags: restoredBitflags,
                user_flags: targetOriginalFlags // Önceki yetkilerini geri yükle
            });

            // Discord'a logla
            await logManagementAction({
                action: 'Kullanıcı Yasağı Kaldırma',
                adminUsername: authenticatedUser.username,
                targetUsername: targetUser.username,
                details: 'Yasak başarıyla kaldırıldı',
                success: true
            });

            return reply.send({
                success: 1,
                message: 'Kullanıcı yasağı başarıyla kaldırıldı'
            });

        } catch (error: any) {
            apiLogger.error('Error in user unban:', error);

            // Hata durumunu Discord'a logla
            const authenticatedUser = (request as any).user;
            if (authenticatedUser?.username) {
                await logManagementAction({
                    action: 'Kullanıcı Yasağı Kaldırma Hatası',
                    adminUsername: authenticatedUser.username,
                    targetUsername: request.params.id,
                    details: error.message || 'Internal server error',
                    success: false
                });
            }

            if (error.message === 'Insufficient permissions') {
                return reply.status(403).send({
                    success: 0,
                    error: 'Bu işlem için yetkiniz yok'
                });
            }

            return reply.status(error.message.includes('token') ? 401 : 500).send({
                success: 0,
                error: error.message || 'Internal server error'
            });
        }
    });

    // PUT /management/times/:username - Süre güncelleme
    fastify.put('/management/times/:username', async (request, reply) => {
        try {
            const user = (request as any).user;
            const userFlags = BigInt(user.user_flags || 0);

            if (!hasPermissionMask(userFlags, "TIME", "UPDATE")) {
                return reply.status(403).send({
                    success: 0,
                    error: 'Bu işlem için yetkiniz yok'
                });
            }

            const { username } = request.params;
            const { type = 'total', seconds } = request.body as { type: 'total' | 'work', seconds: number };

            if (typeof seconds !== 'number' || seconds < 0) {
                return reply.status(400).send({
                    success: 0,
                    error: 'Geçerli bir süre giriniz'
                });
            }

            // Kullanıcıyı bul - time tablosundan ara
            const allUsers = await getAllUserTimes();
            const timeUser = allUsers.find(u => u.username.toLowerCase() === username.toLowerCase());
            
            if (!timeUser) {
                return reply.status(404).send({
                    success: 0,
                    error: 'Kullanıcı bulunamadı'
                });
            }

            // Süreyi güncelle
            if (type === 'total') {
                // Toplam süreyi güncelle (saniye cinsinden)
                await timerWorker.updateUserTimeManually(timeUser.user_id, seconds * 1000, timeUser.username);
                apiLogger.info(`Updated total time for user ${username}: ${seconds}s`);
                
                // Discord'a log gönder
                await logManagementAction({
                    action: 'Toplam Süre Güncelleme',
                    adminUsername: user.username,
                    targetUsername: timeUser.username,
                    details: `${seconds} saniye (${Math.floor(seconds / 3600)} saat ${Math.floor((seconds % 3600) / 60)} dakika)`,
                    success: true
                });
            } else if (type === 'work') {
                // Çalışma süresini güncelle (saniye cinsinden)
                const workTimeMs = seconds * 1000; // saniyeyi millisaniyeye çevir
                await setUserWorkTime(timeUser.user_id, workTimeMs);
                apiLogger.info(`Updated work time for user ${username}: ${seconds}s`);
                
                // Discord'a log gönder
                await logManagementAction({
                    action: 'Terfi Süresi Güncelleme',
                    adminUsername: user.username,
                    targetUsername: timeUser.username,
                    details: `${seconds} saniye (${Math.floor(seconds / 3600)} saat ${Math.floor((seconds % 3600) / 60)} dakika)`,
                    success: true
                });
            }

            return reply.send({
                success: 1,
                message: 'Süre başarıyla güncellendi'
            });

        } catch (error: any) {
            apiLogger.error('Error updating time:', error);
            return reply.status(500).send({
                success: 0,
                error: error.message || 'Internal server error'
            });
        }
    });

    // GET /management/times/search - Kullanıcı arama
    fastify.get('/management/times/search', async (request, reply) => {
        try {
            const user = (request as any).user;
            const userFlags = BigInt(user.user_flags || 0);

            // time.VIEW yetkisi kontrolü
            if (!hasPermissionMask(userFlags, "TIME", "VIEW")) {
                return reply.status(403).send({
                    success: 0,
                    error: 'Bu işlem için yetkiniz yok'
                });
            }

            const { username } = request.query as { username: string };
            if (!username) {
                return reply.status(400).send({
                    success: 0,
                    error: 'Kullanıcı adı gerekli'
                });
            }

            // Kullanıcıları bul ve sürelerini al
            const users = await getAllUserTimes();
            const workTimes = await Promise.all(
                users
                    .filter(user => user.username.toLowerCase().includes(username.toLowerCase()))
                    .slice(0, 5)
                    .map(async user => ({
                        username: user.username,
                        id: user.user_id,
                        totalTime: Math.floor((parseInt(user.total) || 0) / 1000), // millisaniyeyi saniyeye çevir
                        workTime: Math.floor((await getUserWorkTime(user.user_id)) / 1000) // millisaniyeyi saniyeye çevir
                    }))
            );

            return reply.send({
                success: 1,
                users: workTimes
            });

        } catch (error: any) {
            apiLogger.error('Error in time search:', error);
            return reply.status(500).send({
                success: 0,
                error: error.message || 'Internal server error'
            });
        }
    });

    // GET /management/times/info/:userId - Kullanıcı süre bilgileri
    fastify.get('/management/times/info/:userId', async (request, reply) => {
        try {
            const user = (request as any).user;
            const userFlags = BigInt(user.user_flags || 0);

            // time.VIEW yetkisi kontrolü
            if (!hasPermissionMask(userFlags, "TIME", "VIEW")) {
                return reply.status(403).send({
                    success: 0,
                    error: 'Bu işlem için yetkiniz yok'
                });
            }

            const { userId } = request.params as { userId: string };
            const targetUserId = parseInt(userId);

            if (isNaN(targetUserId)) {
                return reply.status(400).send({
                    success: 0,
                    error: 'Geçersiz kullanıcı ID'
                });
            }

            // Kullanıcı bilgilerini al
            const userData = await getUser({
                in: 'id',
                value: targetUserId,
                out: 'all'
            });

            // Süre bilgilerini al
            const [timeData, workTime] = await Promise.all([
                getUserTime(targetUserId),
                getUserWorkTime(targetUserId)
            ]);

            return reply.send({
                success: 1,
                data: {
                    user: userData,
                    time: timeData,
                    workTime
                }
            });

        } catch (error: any) {
            apiLogger.error('Error getting time info:', error);
            return reply.status(500).send({
                success: 0,
                error: error.message || 'Internal server error'
            });
        }
    });

    // POST /management/times/:username/reset - Süre sıfırlama
    fastify.post('/management/times/:username/reset', async (request, reply) => {
        try {
            const user = (request as any).user;
            const userFlags = BigInt(user.user_flags || 0);

            // time.RESET yetkisi kontrolü
            if (!hasPermissionMask(userFlags, "TIME", "RESET")) {
                return reply.status(403).send({
                    success: 0,
                    error: 'Bu işlem için yetkiniz yok'
                });
            }

            const { username } = request.params as { username: string };
            const { type = 'both' } = request.body as { type?: 'total' | 'work' | 'both' };

            // Kullanıcıyı bul - time tablosundan ara
            const allUsers = await getAllUserTimes();
            const timeUser = allUsers.find(u => u.username.toLowerCase() === username.toLowerCase());
            
            if (!timeUser) {
                return reply.status(404).send({
                    success: 0,
                    error: 'Kullanıcı bulunamadı'
                });
            }

            // Seçilen türe göre süreleri sıfırla
            switch(type) {
                case 'total':
                    await timerWorker.updateUserTimeManually(timeUser.user_id, 0, timeUser.username);
                    await logManagementAction({
                        action: 'Toplam Süre Sıfırlama',
                        adminUsername: user.username,
                        targetUsername: timeUser.username,
                        success: true
                    });
                    break;
                case 'work':
                    await resetUserWorkTime(timeUser.user_id);
                    await logManagementAction({
                        action: 'Terfi Süresi Sıfırlama',
                        adminUsername: user.username,
                        targetUsername: timeUser.username,
                        success: true
                    });
                    break;
                case 'both':
                default:
                    await Promise.all([
                        timerWorker.updateUserTimeManually(timeUser.user_id, 0, timeUser.username),
                        resetUserWorkTime(timeUser.user_id)
                    ]);
                    await logManagementAction({
                        action: 'Tüm Süreler Sıfırlama',
                        adminUsername: user.username,
                        targetUsername: timeUser.username,
                        details: 'Toplam süre ve çalışma süresi sıfırlandı',
                        success: true
                    });
                    break;
            }

            return reply.send({
                success: 1,
                data: {
                    message: `${timeUser.username} kullanıcısının ${
                        type === 'total' ? 'toplam' : 
                        type === 'work' ? 'çalışma' : 
                        'tüm'
                    } süresi sıfırlandı.`
                }
            });

        } catch (error: any) {
            apiLogger.error('Error resetting time:', error);
            return reply.status(500).send({
                success: 0,
                error: error.message || 'Internal server error'
            });
        }
    });
}