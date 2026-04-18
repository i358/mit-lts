//@ts-nocheck
import { FastifyInstance } from 'fastify';
import { apiLogger as logger } from '../../../logger';
import { authenticateRequest } from '../../utils/authMiddleware';
import { hasPermission } from '../../../types/permissions';
import {
    publishAnnouncement,
    getActiveAnnouncements,
    getAnnouncementsByType,
    getAnnouncementDetails,
    editAnnouncement,
    removeAnnouncement,
    deactivateAnnouncement,
    getLatestAnnouncements,
    ANNOUNCEMENT_TYPES,
    getTypeName,
    getSubTypeName,
    truncateDescription
} from '../../../db_utilities/announcements';
import { PERMISSIONS, ROLES } from '../../../types/permissions';

function coerceToBigInt(value: any): bigint {
    if (typeof value === 'bigint') return value;
    if (typeof value === 'number') return BigInt(value);
    if (typeof value === 'string') {
        try {
            return BigInt(value);
        } catch {
            return 0n;
        }
    }
    return BigInt(value || 0);
}

function serializeError(error: any) {
    const err: any = error;
    return {
        name: err?.name,
        message: err?.message,
        stack: err?.stack,
    };
}

export default async function announcementsRoute(fastify: FastifyInstance) {
    /**
     * POST /announcements/publish
     * Yeni duyuru yayınla (ADMIN/MODERATOR'a gerekli)
     */
    fastify.post('/announcements/publish', async (request, reply) => {
        let authResult: any = null;
        try {
            // Authenticate
            authResult = await authenticateRequest(request, {
                requireUserFlagsNonZero: false
            });

            if (!authResult.user) {
                return reply.status(401).send({
                    success: 0,
                    error: 'Yetkilendirmesi başarısız'
                });
            }

            // Check permissions (ADMIN or MODERATOR)
            const userFlags = coerceToBigInt(authResult.user.user_flags);
            const isAdmin = (userFlags & ROLES.ADMIN) === ROLES.ADMIN;
            const isModerator = (userFlags & ROLES.MODERATOR) === ROLES.MODERATOR;

            if (!isAdmin && !isModerator) {
                return reply.status(403).send({
                    success: 0,
                    error: 'Bu işlemi yapmak için yeterli izne sahip değilsiniz'
                });
            }

            // Validate payload
            const { type, sub_type, title, description } = request.body;

            if (!type || !sub_type || !title || !description) {
                return reply.status(400).send({
                    success: 0,
                    error: 'Gerekli alanları doldurunuz: type, sub_type, title, description'
                });
            }

            // Validate type and sub_type
            if (!ANNOUNCEMENT_TYPES[type]) {
                return reply.status(400).send({
                    success: 0,
                    error: `Geçersiz duyuru türü: ${type}`
                });
            }

            const subtypeConfig = ANNOUNCEMENT_TYPES[type];
            if (!subtypeConfig.subtypes[sub_type]) {
                return reply.status(400).send({
                    success: 0,
                    error: `${type} için geçersiz alt-tür: ${sub_type}`
                });
            }

            // Publish announcement
            const announcement = await publishAnnouncement({
                type,
                sub_type,
                title,
                description,
                published_by: authResult.user.username
            });

            if (!announcement) {
                return reply.status(500).send({
                    success: 0,
                    error: 'Duyuru yayınlanırken bir hata oluştu'
                });
            }

            logger.info(`Announcement published by ${authResult.user.username}:`, {
                id: announcement.id,
                type: announcement.type,
                sub_type: announcement.sub_type,
                title: announcement.title
            });

            return reply.status(201).send({
                success: 1,
                message: 'Duyuru başarıyla yayınlandı',
                data: {
                    id: announcement.id,
                    type: announcement.type,
                    sub_type: announcement.sub_type,
                    title: announcement.title,
                    published_by: announcement.published_by,
                    published_at: announcement.published_at
                }
            });
        } catch (error) {
            logger.error('Error in POST /announcements/publish:', {
                error: serializeError(error),
                user: {
                    id: authResult?.user?.id,
                    username: authResult?.user?.username,
                },
                body: (request as any)?.body
            });
            return reply.status(500).send({
                success: 0,
                error: 'Sunucu hatası'
            });
        }
    });

    /**
     * GET /announcements
     * Tüm aktif duyuruları getir (public - token doğrulaması gerekli)
     * Query params: ?type=UPDATE_NOTES&sub_type=SECURITY&limit=10&offset=0
     */
    fastify.get('/announcements', async (request, reply) => {
        try {
            // Authenticate (only token verification required)
            const authResult = await authenticateRequest(request, {
                requireUserFlagsNonZero: false
            });

            if (!authResult.user) {
                return reply.status(401).send({
                    success: 0,
                    error: 'Yetkilendirmesi başarısız'
                });
            }

            // Get query params
            const { type, sub_type, limit = 10, offset = 0 } = request.query as any;

            // Get announcements with optional filters
            let announcements;

            if (type) {
                announcements = await getAnnouncementsByType(
                    type,
                    Math.min(parseInt(limit) || 10, 100),
                    parseInt(offset) || 0
                );
            } else {
                announcements = await getActiveAnnouncements({
                    limit: Math.min(parseInt(limit) || 10, 100),
                    offset: parseInt(offset) || 0
                });
            }

            // Format response
            const formattedAnnouncements = announcements.map(ann => ({
                id: ann.id,
                type: ann.type,
                sub_type: ann.sub_type,
                title: ann.title,
                description: truncateDescription(ann.description, 150),
                published_by: ann.published_by,
                published_at: ann.published_at,
                type_name: getTypeName(ann.type),
                sub_type_name: getSubTypeName(ann.type, ann.sub_type)
            }));

            return reply.send({
                success: 1,
                data: formattedAnnouncements,
                pagination: {
                    limit: Math.min(parseInt(limit) || 10, 100),
                    offset: parseInt(offset) || 0,
                    count: formattedAnnouncements.length
                }
            });
        } catch (error) {
            logger.error('Error in GET /announcements:', error);
            return reply.status(500).send({
                success: 0,
                error: 'Sunucu hatası'
            });
        }
    });

    /**
     * GET /announcements/:id
     * Belirli bir duyurunun detaylarını getir (public - token doğrulaması gerekli)
     */
    fastify.get('/announcements/:id', async (request, reply) => {
        try {
            // Authenticate (only token verification required)
            const authResult = await authenticateRequest(request, {
                requireUserFlagsNonZero: false
            });

            if (!authResult.user) {
                return reply.status(401).send({
                    success: 0,
                    error: 'Yetkilendirmesi başarısız'
                });
            }

            const { id } = request.params as any;

            const announcement = await getAnnouncementDetails(parseInt(id));

            if (!announcement) {
                return reply.status(404).send({
                    success: 0,
                    error: 'Duyuru bulunamadı'
                });
            }

            if (!announcement.is_active) {
                return reply.status(403).send({
                    success: 0,
                    error: 'Bu duyuru aktif değil'
                });
            }

            return reply.send({
                success: 1,
                data: {
                    id: announcement.id,
                    type: announcement.type,
                    sub_type: announcement.sub_type,
                    title: announcement.title,
                    description: announcement.description,
                    published_by: announcement.published_by,
                    published_at: announcement.published_at,
                    type_name: getTypeName(announcement.type),
                    sub_type_name: getSubTypeName(announcement.type, announcement.sub_type)
                }
            });
        } catch (error) {
            logger.error('Error in GET /announcements/:id:', error);
            return reply.status(500).send({
                success: 0,
                error: 'Sunucu hatası'
            });
        }
    });

    /**
     * GET /announcements/latest/:count
     * En son duyuruları getir (public - token doğrulaması gerekli)
     */
    fastify.get('/announcements/latest/:count', async (request, reply) => {
        try {
            // Authenticate (only token verification required)
            const authResult = await authenticateRequest(request, {
                requireUserFlagsNonZero: false
            });

            if (!authResult.user) {
                return reply.status(401).send({
                    success: 0,
                    error: 'Yetkilendirmesi başarısız'
                });
            }

            const { count = 5 } = request.params as any;
            const limit = Math.min(parseInt(count) || 5, 50);

            const announcements = await getLatestAnnouncements(limit);

            const formattedAnnouncements = announcements.map(ann => ({
                id: ann.id,
                type: ann.type,
                sub_type: ann.sub_type,
                title: ann.title,
                description: truncateDescription(ann.description, 150),
                published_by: ann.published_by,
                published_at: ann.published_at,
                type_name: getTypeName(ann.type),
                sub_type_name: getSubTypeName(ann.type, ann.sub_type)
            }));

            return reply.send({
                success: 1,
                data: formattedAnnouncements
            });
        } catch (error) {
            logger.error('Error in GET /announcements/latest/:count:', error);
            return reply.status(500).send({
                success: 0,
                error: 'Sunucu hatası'
            });
        }
    });

    /**
     * PUT /announcements/:id
     * Duyuruyu güncelle (ADMIN/MODERATOR'a gerekli)
     */
    fastify.put('/announcements/:id', async (request, reply) => {
        let authResult: any = null;
        try {
            // Authenticate
            authResult = await authenticateRequest(request, {
                requireUserFlagsNonZero: false
            });

            if (!authResult.user) {
                return reply.status(401).send({
                    success: 0,
                    error: 'Yetkilendirmesi başarısız'
                });
            }

            // Check permissions (ADMIN or MODERATOR)
            const userFlags = coerceToBigInt(authResult.user.user_flags);
            const isAdmin = (userFlags & ROLES.ADMIN) === ROLES.ADMIN;
            const isModerator = (userFlags & ROLES.MODERATOR) === ROLES.MODERATOR;

            if (!isAdmin && !isModerator) {
                return reply.status(403).send({
                    success: 0,
                    error: 'Bu işlemi yapmak için yeterli izne sahip değilsiniz'
                });
            }

            const { id } = request.params as any;
            const { title, description, is_active } = request.body as any;

            if (!title && !description && is_active === undefined) {
                return reply.status(400).send({
                    success: 0,
                    error: 'Güncellenecek bir alan belirtiniz'
                });
            }

            const updateData: any = {};
            if (title) updateData.title = title;
            if (description) updateData.description = description;
            if (is_active !== undefined) updateData.is_active = is_active;
            updateData.updated_at = new Date();

            const announcement = await editAnnouncement(parseInt(id), updateData);

            if (!announcement) {
                return reply.status(404).send({
                    success: 0,
                    error: 'Duyuru bulunamadı'
                });
            }

            logger.info(`Announcement updated by ${authResult.user.username}:`, {
                id: announcement.id,
                title: announcement.title
            });

            return reply.send({
                success: 1,
                message: 'Duyuru başarıyla güncellendi',
                data: {
                    id: announcement.id,
                    title: announcement.title,
                    description: announcement.description,
                    is_active: announcement.is_active
                }
            });
        } catch (error) {
            logger.error('Error in PUT /announcements/:id:', {
                error: serializeError(error),
                params: (request as any)?.params,
                body: (request as any)?.body,
                user: {
                    id: authResult?.user?.id,
                    username: authResult?.user?.username,
                }
            });
            return reply.status(500).send({
                success: 0,
                error: 'Sunucu hatası'
            });
        }
    });

    /**
     * DELETE /announcements/:id
     * Duyuruyu sil (ADMIN'a gerekli - hard delete)
     */
    fastify.delete('/announcements/:id', async (request, reply) => {
        let authResult: any = null;
        try {
            // Authenticate
            authResult = await authenticateRequest(request, {
                requireUserFlagsNonZero: false
            });

            if (!authResult.user) {
                return reply.status(401).send({
                    success: 0,
                    error: 'Yetkilendirmesi başarısız'
                });
            }

            // Check permissions (ADMIN only)
            const userFlags = coerceToBigInt(authResult.user.user_flags);
            const isAdmin = (userFlags & ROLES.ADMIN) === ROLES.ADMIN;

            if (!isAdmin) {
                return reply.status(403).send({
                    success: 0,
                    error: 'Duyuru silmek için admin izni gereklidir'
                });
            }

            const { id } = request.params as any;

            const result = await removeAnnouncement(parseInt(id));

            if (!result) {
                return reply.status(404).send({
                    success: 0,
                    error: 'Duyuru bulunamadı'
                });
            }

            logger.info(`Announcement deleted by ${authResult.user.username}: ${id}`);

            return reply.send({
                success: 1,
                message: 'Duyuru başarıyla silindi'
            });
        } catch (error) {
            logger.error('Error in DELETE /announcements/:id:', {
                error: serializeError(error),
                params: (request as any)?.params,
                user: {
                    id: authResult?.user?.id,
                    username: authResult?.user?.username,
                }
            });
            return reply.status(500).send({
                success: 0,
                error: 'Sunucu hatası'
            });
        }
    });

    /**
     * GET /announcements/types
     * Tüm duyuru türlerini ve alt-türlerini getir (public)
     */
    fastify.get('/announcements/types', async (request, reply) => {
        try {
            const types = Object.entries(ANNOUNCEMENT_TYPES).map(([key, value]) => ({
                type: key,
                name: value.name,
                subtypes: Object.entries(value.subtypes).map(([subkey, subvalue]) => ({
                    id: subkey,
                    name: subvalue
                }))
            }));

            return reply.send({
                success: 1,
                data: types
            });
        } catch (error) {
            logger.error('Error in GET /announcements/types:', error);
            return reply.status(500).send({
                success: 0,
                error: 'Sunucu hatası'
            });
        }
    });
}
