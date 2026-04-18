//@ts-nocheck
import { FastifyInstance, FastifyRequest } from 'fastify';
import { apiLogger as logger, LogLevel } from '../../../logger';
import { getTrainingRecord, createTrainingRecord, updateTrainingRecord, getUserRow } from '../../../db_utilities/postgres';
import { getBanInfo } from '../../../db_utilities/ban';
import { bitflagsManager } from '../../../utils/bitflagsManager';
import { globalStore } from '../../../utils/globalStore';
import { config } from '../../../config';
import base64url from 'base64url';
import { Crypter } from '../../utils/crypter';
import crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { authenticateRequest } from '../../utils/authMiddleware';

logger.setLogLevel(LogLevel.DEBUG);

// Badge cache'ini yükle
function loadBadgeCache() {
    try {
        const badgePath = path.join(__dirname, '../../../cache/badges.json');
        const badgeData = fs.readFileSync(badgePath, 'utf-8');
        return JSON.parse(badgeData);
    } catch (error) {
        logger.error('Failed to load badge cache:', error);
        return {};
    }
}

const BADGES = loadBadgeCache();

// Güvenlik Ekibi badge indexini bul (1-based)
function getSecurityBadgeIndex(): number {
    const badgeNames = Object.keys(BADGES);
    const securityIndex = badgeNames.indexOf('Güvenlik Ekibi');
    return securityIndex !== -1 ? securityIndex + 1 : 0; // 1-based sistem
}

export default async function trainingRoute(fastify: FastifyInstance) {
    const SECURITY_BADGE_INDEX = getSecurityBadgeIndex();
    /**
     * Eğitim kaydını kontrol et
     */
    fastify.post('/training/check', async (request, reply) => {
        try {
            const authResult = await authenticateRequest(request as any);
            if (!authResult?.user) {
                return reply.status(401).send({
                    success: 0,
                    error: 'Unauthorized'
                });
            }

            const { trainee_username } = request.body as { trainee_username?: string };
            if (!trainee_username) {
                return reply.status(400).send({
                    success: 0,
                    error: 'Trainee username required'
                });
            }

            // Eğitim kaydını kontrol et
            const trainingRecord = await getTrainingRecord(trainee_username);

            if (trainingRecord) {
                // Eğitim kaydı var
                return reply.send({
                    success: 1,
                    found: true,
                    data: {
                        trainee_username: trainingRecord.trainee_username,
                        trainer_username: trainingRecord.trainer_username,
                        training_date: trainingRecord.training_date.toLocaleDateString('tr-TR'),
                        training_time: trainingRecord.training_time,
                        discord_verified: trainingRecord.discord_verified
                    }
                });
            } else {
                // Eğitim kaydı yok - form göster
                return reply.send({
                    success: 1,
                    found: false,
                    data: {
                        trainee_username: trainee_username
                    }
                });
            }
        } catch (error) {
            logger.error('Training check error:', error);
            return reply.status(500).send({
                success: 0,
                error: 'Internal server error'
            });
        }
    });

    /**
     * Yeni eğitim kaydı oluştur
     */
    fastify.post('/training/create', async (request, reply) => {
        try {
            const authResult = await authenticateRequest(request as any);
            if (!authResult?.user) {
                return reply.status(401).send({
                    success: 0,
                    error: 'Unauthorized'
                });
            }

            const user = authResult.user;

            // Ban kontrolü
            const clientIp =
                (request.headers['x-forwarded-for'] as string)?.split(',')[0] ||
                request.ip ||
                'unknown';
            const banInfo = await getBanInfo(user.id, clientIp);
            if (banInfo) {
                return reply.status(403).send({
                    success: 0,
                    banned: true,
                    ban_info: banInfo,
                    error: 'Bu hesap yasaklanmış'
                });
            }

            // Rozet kontrolü - En az Güvenlik Ekibi rozetine sahip olmalı
            if (user.badge < SECURITY_BADGE_INDEX) {
                return reply.status(403).send({
                    success: 0,
                    error: `Bu işlemi gerçekleştirmek için en az Güvenlik Ekibi rozetine sahip olmanız gerekiyor`
                });
            }

            const { trainee_username, discord_verified } = request.body as { trainee_username?: string; discord_verified?: number };
            if (!trainee_username) {
                return reply.status(400).send({
                    success: 0,
                    error: 'Trainee username required'
                });
            }

            // Zaten eğitim kaydı var mı kontrol et
            const existingRecord = await getTrainingRecord(trainee_username);
            if (existingRecord) {
                return reply.status(400).send({
                    success: 0,
                    error: 'Bu kişinin zaten eğitim kaydı var'
                });
            }

            // Yeni eğitim kaydı oluştur
            const trainingRecord = await createTrainingRecord({
                trainee_username: trainee_username,
                trainer_username: user.username,
                discord_verified: discord_verified ? 1 : 0
            });

            if (trainingRecord) {
                logger.info(`Training record created for ${trainee_username} by ${user.username}`);

                try {
                    const { logTraining } = await import('../../../utils/discordLog');
                    await logTraining({
                        traineeUsername: trainingRecord.trainee_username,
                        trainerUsername: trainingRecord.trainer_username,
                        discordVerified: !!trainingRecord.discord_verified
                    });
                } catch (error: any) {
                    logger.error('Error sending Discord training log:', {
                        message: error?.message,
                        stack: error?.stack,
                        name: error?.name,
                        error
                    });
                }

                return reply.send({
                    success: 1,
                    message: 'Eğitim kaydı başarıyla oluşturuldu',
                    data: {
                        trainee_username: trainingRecord.trainee_username,
                        trainer_username: trainingRecord.trainer_username,
                        training_date: trainingRecord.training_date.toLocaleDateString('tr-TR'),
                        training_time: trainingRecord.training_time,
                        discord_verified: trainingRecord.discord_verified
                    }
                });
            } else {
                return reply.status(500).send({
                    success: 0,
                    error: 'Eğitim kaydı oluşturulamadı'
                });
            }
        } catch (error) {
            logger.error('Training create error:', error);
            return reply.status(500).send({
                success: 0,
                error: 'Internal server error'
            });
        }
    });

    /**
     * Eğitim kaydını güncelle (discord_verified)
     */
    fastify.put('/training/update', async (request, reply) => {
        try {
            const authResult = await authenticateRequest(request as any);
            if (!authResult?.user) {
                return reply.status(401).send({
                    success: 0,
                    error: 'Unauthorized'
                });
            }

            const user = authResult.user;

            // Rozet kontrolü - En az Güvenlik Ekibi rozetine sahip olmalı
            if (user.badge < SECURITY_BADGE_INDEX) {
                return reply.status(403).send({
                    success: 0,
                    error: `Bu işlemi gerçekleştirmek için en az Güvenlik Ekibi rozetine sahip olmanız gerekiyor`
                });
            }

            const { trainee_username, discord_verified } = request.body as { trainee_username?: string; discord_verified?: number };
            if (!trainee_username) {
                return reply.status(400).send({
                    success: 0,
                    error: 'Trainee username required'
                });
            }

            // Eğitim kaydını güncelle
            const trainingRecord = await updateTrainingRecord(trainee_username, {
                discord_verified: discord_verified ? 1 : 0
            });

            if (trainingRecord) {
                logger.info(`Training record updated for ${trainee_username} by ${user.username}`);
                return reply.send({
                    success: 1,
                    message: 'Eğitim kaydı başarıyla güncellendi',
                    data: {
                        trainee_username: trainingRecord.trainee_username,
                        trainer_username: trainingRecord.trainer_username,
                        training_date: trainingRecord.training_date.toLocaleDateString('tr-TR'),
                        training_time: trainingRecord.training_time,
                        discord_verified: trainingRecord.discord_verified
                    }
                });
            } else {
                return reply.status(404).send({
                    success: 0,
                    error: 'Eğitim kaydı bulunamadı'
                });
            }
        } catch (error) {
            logger.error('Training update error:', error);
            return reply.status(500).send({
                success: 0,
                error: 'Internal server error'
            });
        }
    });
}
