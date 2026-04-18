//@ts-nocheck
import { FastifyInstance } from 'fastify';
import { apiLogger as logger } from '../../../logger';
import { getCodename, createCodename, deleteCodename, getUserRow } from '../../../db_utilities/postgres';
import base64url from 'base64url';
import { Crypter } from '../../utils/crypter';
import crypto from 'crypto';
import { config } from '../../../config';
import { authenticateRequest } from '../../utils/authMiddleware';

export default async function userRoute(fastify: FastifyInstance) {
    // Kullanıcı kodunu al
    fastify.get('/user/code', async (request, reply) => {
        try {
            const result = await authenticateRequest(request as any);
            if (!result?.user) {
                return reply.status(401).send({
                    success: 0,
                    error: 'No token provided'
                });
            }

            const userId = result.user.id;

            // Kodunu al
            const userCode = await getCodename({
                in: 'id',
                value: userId,
                out: 'all'
            });

            if (!userCode) {
                return reply.send({
                    success: 1,
                    data: null
                });
            }

            return reply.send({
                success: 1,
                data: {
                    codename: userCode.codename
                }
            });

        } catch (error: any) {
            logger.error('Error fetching user code:', error);
            const statusCode = typeof error?.statusCode === 'number' ? error.statusCode : 500;
            return reply.status(statusCode).send({
                success: 0,
                error: error?.message || 'Internal server error'
            });
        }
    });

    // Kullanıcı kodu ayarla
    fastify.post('/user/code', async (request, reply) => {
        try {
            const result = await authenticateRequest(request as any);
            if (!result?.user) {
                return reply.status(401).send({
                    success: 0,
                    error: 'No token provided'
                });
            }

            const userId = result.user.id;
            const user = result.user;

            // Request body'den kodu al
            const { code } = request.body as { code?: string };

            if (!code || typeof code !== 'string') {
                return reply.status(400).send({
                    success: 0,
                    error: 'Kod belirtilmedi'
                });
            }

            // Kod formatını kontrol et (sadece harf ve rakam, en az 1 karakter)
            if (!/^[a-zA-Z0-9]{1,}$/.test(code)) {
                return reply.status(400).send({
                    success: 0,
                    error: 'Kod sadece harf ve rakam içerebilir'
                });
            }

            // Kod uzunluğunu kontrol et (maksimum 6 karakter)
            if (code.length > 6) {
                return reply.status(400).send({
                    success: 0,
                    error: 'Kod maksimum 6 karakter uzunluğunda olmalıdır'
                });
            }

            // Kodun başka biri tarafından kullanılıp kullanılmadığını kontrol et
            const existingCode = await getCodename({
                in: 'codename',
                value: code,
                out: 'all'
            });

            if (existingCode && existingCode.id !== userId) {
                return reply.status(409).send({
                    success: 0,
                    error: 'Bu kod başka bir kullanıcı tarafından kullanılıyor'
                });
            }

            // Kullanıcının mevcut bir kodu var mı kontrol et
            const currentCode = await getCodename({
                in: 'id',
                value: userId,
                out: 'all'
            });

            // Eğer zaten bir kodu varsa güncelle, yoksa oluştur
            if (currentCode) {
                // Güncelleme işlemi - eski kodu silinip yeni kodu oluştur
                await deleteCodename(currentCode.id);
                
                await createCodename({
                    id: userId,
                    username: user.username,
                    codename: code
                });

                logger.info('Code updated successfully:', {
                    userId: userId,
                    username: user.username,
                    oldCode: currentCode.codename,
                    newCode: code
                });

                return reply.send({
                    success: 1,
                    message: 'Kodunuz başarıyla güncellendi',
                    data: {
                        codename: code
                    }
                });
            } else {
                // Yeni kod oluştur
                await createCodename({
                    id: userId,
                    username: user.username,
                    codename: code
                });

                logger.info('Code set successfully:', {
                    userId: userId,
                    username: user.username,
                    code: code
                });

                return reply.send({
                    success: 1,
                    message: 'Kodunuz başarıyla ayarlandı',
                    data: {
                        codename: code
                    }
                });
            }

        } catch (error) {
            logger.error('Error setting user code:', error);
            return reply.status(500).send({
                success: 0,
                error: 'Internal server error'
            });
        }
    });
}

