import { FastifyInstance } from 'fastify';
import { getPendingVerification, deletePendingVerification, createOAuthLink, OAuthLink } from '../../../db_utilities/postgres';
import { apiLogger as logger } from '../../../logger';
import { globalStore } from '../../../utils/globalStore';
import { requireAuth } from '../../utils/authMiddleware';

export default async function verifyRoute(fastify: FastifyInstance) {
    fastify.post('/auth/unlink', { preHandler: [requireAuth()] }, async (request, reply) => {
        try {
            const user = (request as any).user;

            if (!user) {
                return reply.status(404).send({
                    success: 0,
                    error: 'Kullanıcı bulunamadı'
                });
            }

            // Ban kontrolü
            const { getBanInfo } = await import('../../../db_utilities/ban');
            const banInfo = await getBanInfo(user.id);
            if (banInfo) {
                return reply.status(403).send({
                    success: 0,
                    banned: true,
                    ban_info: banInfo,
                    error: 'Bu hesap yasaklanmış'
                });
            }

            // Kullanıcının OAuth bağlantısını bul
            const { getOAuthLinkByUserId, deleteOAuthLink } = await import('../../../db_utilities/postgres');
            const oauthLink = await getOAuthLinkByUserId(user.id);

            if (!oauthLink) {
                return reply.send({
                    success: 0,
                    error: 'Bu hesaba bağlı bir Discord hesabı yok'
                });
            }

            // OAuth bağlantısını sil
            const deleted = await deleteOAuthLink(oauthLink.discord_id);
            if (!deleted) {
                return reply.status(500).send({
                    success: 0,
                    error: 'Discord bağlantısı kaldırılırken hata oluştu'
                });
            }

            return reply.send({
                success: 1,
                message: 'Discord hesabı başarıyla bağlantısı kesildi'
            });

        } catch (error) {
            logger.error('Error in unlink endpoint:', error);
            return reply.status(500).send({
                success: 0,
                error: 'Internal server error'
            });
        }
    });

    fastify.post('/auth/check', { preHandler: [requireAuth()] }, async (request, reply) => {
        try {
            const user = (request as any).user;

            if (!user) {
                return reply.status(404).send({
                    success: 0,
                    error: 'Kullanıcı bulunamadı'
                });
            }

            // Ban kontrolü
            const { getBanInfo } = await import('../../../db_utilities/ban');
            const banInfo = await getBanInfo(user.id);
            if (banInfo) {
                return reply.status(403).send({
                    success: 0,
                    banned: true,
                    ban_info: banInfo,
                    error: 'Bu hesap yasaklanmış'
                });
            }

            // Kullanıcının bağlı Discord hesabını kontrol et
            const { getOAuthLinkByUserId } = await import('../../../db_utilities/postgres');
            const oauthLink = await getOAuthLinkByUserId(user.id);

            if (!oauthLink) {
                return reply.send({
                    success: 1,
                    isLinked: false
                });
            }

            // Discord kullanıcı bilgilerini al
            const systemStore = globalStore.collection<string, any>("system");
            const discordClient = systemStore.get("discordClient");

            if (!discordClient) {
                logger.error('Discord client not found in system store');
                return reply.status(500).send({
                    success: 0,
                    error: 'Internal server error'
                });
            }

            try {
                const discordUser = await discordClient.users.fetch(oauthLink.discord_id.toString());
                return reply.send({
                    success: 1,
                    isLinked: true,
                    discordUser: {
                        id: discordUser.id,
                        username: discordUser.username,
                        discriminator: discordUser.discriminator,
                        avatar: discordUser.avatarURL()
                    }
                });
            } catch (error) {
                logger.error('Error fetching Discord user:', error);
                return reply.status(500).send({
                    success: 0,
                    error: 'Discord kullanıcı bilgileri alınırken hata oluştu'
                });
            }

        } catch (error) {
            logger.error('Error in auth check endpoint:', error);
            return reply.status(500).send({
                success: 0,
                error: 'Internal server error'
            });
        }
    });

    fastify.post('/auth/verify', { preHandler: [requireAuth()] }, async (request, reply) => {
        try {
            const user = (request as any).user;

            if (!user) {
                return reply.status(404).send({
                    success: 0,
                    error: 'Site kullanıcısı bulunamadı'
                });
            }

            // Payload doğrulama
            const payload = request.body as { code?: string };
            if (!payload.code) {
                return reply.status(400).send({
                    success: 0,
                    error: 'Verification code is required'
                });
            }

            // Doğrulama kodunu kontrol et
            const verification = await getPendingVerification(payload.code);
            if (!verification) {
                return reply.status(404).send({
                    success: 0,
                    error: 'Geçersiz doğrulama kodu'
                });
            }

            // Kodun süresi geçmiş mi kontrol et
            if (new Date() > verification.expires_at) {
                await deletePendingVerification(payload.code); // Süresi geçmiş kodu sil
                return reply.status(400).send({
                    success: 0,
                    error: 'Doğrulama kodu süresi dolmuş'
                });
            }

            // Kullanıcının istediği Habbo hesabının adı doğru mu kontrol et
            if (user.username !== verification.requested_username) {
                return reply.status(400).send({
                    success: 0,
                    error: 'Kullanıcı adı uyuşmuyor. Doğrulama kodu farklı bir Habbo hesabı için istendi.'
                });
            }

            logger.debug('Verification check:', {
                userId: user.id,
                username: user.username,
                requestedUsername: verification.requested_username,
                discordId: verification.discord_id.toString()
            });

            // OAuth bağlantısını oluştur
            const oauthData: Omit<OAuthLink, 'id' | 'created_at'> = {
                user_id: user.id,
                discord_id: verification.discord_id
            };

            await createOAuthLink(oauthData);

            // Kullanılan doğrulama kodunu sil
            await deletePendingVerification(payload.code);

            return reply.send({
                success: 1,
                message: 'Discord hesabı başarıyla bağlandı'
            });

        } catch (error) {
            logger.error('Error in verify endpoint:', error);
            return reply.status(500).send({
                success: 0,
                error: 'Internal server error'
            });
        }
    });
}