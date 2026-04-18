import { Crypter } from '../../utils/crypter';
import base64url from 'base64url';
import { config } from '../../../config';
import { createArchiveRow, createUserRow, getCodename, getUser, getUserRow, updateUserRow } from '../../../db_utilities/postgres';
import { Client } from 'discord.js';
import { FastifyInstance } from 'fastify';
import * as crypto from 'crypto';
import { apiLogger } from '../../../logger';
import { bitflagsManager } from '../../../utils/bitflagsManager';
import { globalStore } from '../../../utils/globalStore';
import * as path from 'path';
import { authenticateRequest } from '../../utils/authMiddleware';
import badgesJson from "./../../../../cache/badges.json"
import axios from 'axios';
import { Snowflake } from "../../../api/utils/snowflake";

export default async function demotionRoute(fastify: FastifyInstance) {
    fastify.post('/badge/demote/check', async (request, reply) => {
        try {
            const body = request.body as any;
            const modeRaw = body?.mode;
            const mode = (modeRaw === 'check' || modeRaw === 'create') ? modeRaw : 'create';
            const hid = Number(body?.hid);
            const rank = body?.rank !== undefined ? Number(body?.rank) : undefined;

            if (!hid) {
                return reply.status(400).send({ success: 0, error: 'Habbo ID is required' });
            }
            if (!Number.isInteger(hid)) {
                return reply.status(400).send({ success: 0, error: 'Habbo ID must be an integer' });
            }
            if (mode === 'create') {
                if (rank === undefined) {
                    return reply.status(400).send({ success: 0, error: 'Rank is required' });
                }
                if (!Number.isInteger(rank)) {
                    return reply.status(400).send({ success: 0, error: 'Rank must be an integer' });
                }
            }

            const result = await authenticateRequest(request as any);
            if (!result?.user) {
                return reply.status(401).send({ success: 0, error: 'Unauthorized' });
            }

            const user = result.user;

            if (!bitflagsManager.hasPermission(user.bitflags, "DOWN_BADGES")) {
                return reply.status(403).send({ success: 0, error: 'Bu işlemi gerçekleştiren kullanıcı yeterli izinlere sahip değil' });
            }

          

            const targetUserData = await getUser({
                in: "id",
                value: hid,
                out: "all"
            })
            if (!targetUserData) {
                return reply.status(404).send({ success: 0, error: 'Hedef kullanıcı odada bulunamadı' });
            }

            const isRegistered = await getUserRow({
                in: "habbo_id",
                value: targetUserData.id,
                out: "all"
            })

            if (isRegistered) {
                if (user.badge <= isRegistered.badge) {
                    return reply.status(403).send({
                        success: 0,
                        error: 'Sadece kendinizden daha düşük rütbedeki kullanıcılara tenzil verebilirsiniz'
                    });
                }
                return reply.status(200).send({
                    success: 1,
                    registered: true,
                    user: {
                        username: isRegistered.username,
                        badge: isRegistered.badge,
                        rank: isRegistered.rank,
                        id: isRegistered.id
                    }
                });
            }

            const { data: userData } = await axios.get(`https://habbo.com.tr/api/public/users?name=${targetUserData.username}`)
            const uid = userData.uniqueId;
            try {
                const response = await axios.get(`https://habbo.com.tr/api/public/users/${uid}/groups`)
                const groupData = response.data;

                if (!Array.isArray(groupData) || groupData.length === 0) {
                    return reply.status(200).send({ success: 0, error: 'Hedef kullanıcı hiçbir gruba dahil değil' });
                }

                const normalizeName = (value: string) => {
                    return value
                        .toLocaleLowerCase('tr-TR')
                        .replace(/i̇/g, 'i')
                        .replace(/\[\s*m[iı]t\s*\]/gi, 'mit')
                        .replace(/ğ/g, 'g')
                        .replace(/ü/g, 'u')
                        .replace(/ş/g, 's')
                        .replace(/ı/g, 'i')
                        .replace(/ö/g, 'o')
                        .replace(/ç/g, 'c')
                        .replace(/[^a-z0-9]+/g, ' ')
                        .trim();
                };

                const diceCoefficient = (a: string, b: string) => {
                    if (!a || !b) return 0;
                    if (a === b) return 1;
                    if (a.length < 2 || b.length < 2) return 0;

                    const bigrams = new Map<string, number>();
                    for (let i = 0; i < a.length - 1; i++) {
                        const gram = a.substring(i, i + 2);
                        bigrams.set(gram, (bigrams.get(gram) || 0) + 1);
                    }

                    let matches = 0;
                    for (let i = 0; i < b.length - 1; i++) {
                        const gram = b.substring(i, i + 2);
                        const count = bigrams.get(gram) || 0;
                        if (count > 0) {
                            bigrams.set(gram, count - 1);
                            matches++;
                        }
                    }

                    return (2 * matches) / (a.length + b.length - 2);
                };

                const badgeKeys = Object.keys((badgesJson as any) || {});
                const normalizedBadgeKeys = badgeKeys.map((key) => ({
                    key,
                    normalized: normalizeName(key)
                }));

                const added = new Set<string>();
                const badgeOrder = new Map<string, number>();
                for (let i = 0; i < badgeKeys.length; i++) {
                    badgeOrder.set(badgeKeys[i], i);
                }
                let currentBadge: { name: string; badgeLevel: number } | null = null;

                for (const group of groupData) {
                    const originalName = group?.name;
                    if (!originalName || typeof originalName !== 'string') continue;

                    const normalizedGroupName = normalizeName(originalName);
                    if (!normalizedGroupName) continue;

                    let best: { key: string; score: number } | null = null;
                    for (const candidate of normalizedBadgeKeys) {
                        const score =
                            candidate.normalized.includes(normalizedGroupName) ||
                                normalizedGroupName.includes(candidate.normalized)
                                ? 1
                                : diceCoefficient(
                                    normalizedGroupName.replace(/\s+/g, ''),
                                    candidate.normalized.replace(/\s+/g, '')
                                );

                        if (!best || score > best.score) {
                            best = { key: candidate.key, score };
                        }
                    }

                    if (!best || best.score < 0.6) continue;
                    if (added.has(best.key)) continue;
                    added.add(best.key);

                    const orderIndex = badgeOrder.get(best.key);
                    if (typeof orderIndex === 'number') {
                        if (!currentBadge || orderIndex > (currentBadge.badgeLevel - 1)) {
                            currentBadge = { name: best.key, badgeLevel: orderIndex + 1 };
                        }
                    }
                }

                if (!currentBadge) {
                    return reply.status(200).send({
                        success: 0,
                        error: "Kullanıcının MIT'e ait hiçbir rozeti yok."
                    });
                }

                if (user.badge <= currentBadge.badgeLevel) {
                    return reply.status(403).send({
                        success: 0,
                        error: 'Sadece kendinizden daha düşük rütbedeki kullanıcılara tenzil verebilirsiniz'
                    });
                }

                if (mode === 'check') {
                    return reply.status(200).send({
                        success: 1,
                        registered: false,
                        user: {
                            username: targetUserData.username,
                            badge: currentBadge.badgeLevel
                        }
                    });
                }

                const sf = new Snowflake();
                const sid = await sf.createUUID({ encoding: "none" });
                const calculatedBitflags = bitflagsManager.calculateBitflags(currentBadge.badgeLevel, 0);
                try {
                    const newUser = await createUserRow({
                        id: sid.toString(),
                        username: targetUserData.username,
                        habbo_id: targetUserData.id,
                        secret: "0",
                        avatar: "https://www.habbo.com.tr/habbo-imaging/avatarimage?user=" + targetUserData.username + "&direction=2&head_direction=2&action=&gesture=agr&size=l",
                        badge: currentBadge.badgeLevel,
                        rank: Number(rank),
                        salary: BigInt(0),
                        coins: 0,
                        bitflags: calculatedBitflags,
                        user_flags: 0n,
                        ip_addr: "0.0.0.0",
                        created_at: new Date().toISOString()
                    })
                    if (newUser) {
                        return reply.status(200).send({
                            success: 1,
                            registered: true,
                            user: {
                                username: targetUserData.username,
                                badge: currentBadge.badgeLevel,
                                rank: Number(rank),
                                id: sid.toString()
                            }
                        })
                    }
                } catch (error) {
                    console.error(error)
                    return reply.status(500).send({ success: 0, registered: false, error: "Kullanıcı oluşturulurken bir hata oluştu." })
                }
            } catch {
                return reply.status(404).send({ success: 0, error: "Kullanıcının profili gizli olduğu için rozet verileri alınamadı." })
            }
        } catch (err) {
            const error = err as Error;
            apiLogger.error('Error in POST /badge/demote/check:', {
                message: error.message,
                stack: error.stack,
                name: error.name,
                error: err
            });
            return reply.status(500).send({
                success: 0,
                error: 'Internal Server Error'
            });
        }
    });

    fastify.post('/badge/demote', async (request, reply) => {
        try {
            const { username } = request.body as { username?: string };
            if (!username) {
                return reply.status(400).send({ success: 0, error: 'Username is required' });
            }

            // Token ve auth kontrolleri
            const result = await authenticateRequest(request as any);
            if (!result?.user) {
                return reply.status(401).send({ success: 0, error: 'Unauthorized' });
            }

            const user = result.user;

            // Tenzil yetkisi kontrolü
            let demoter = {
                username: user.username,
                badge: user.badge,
                rank: user.rank,
                bitflags: user.bitflags
            };

            // Tenzil sadece eş sahip ve üzeri kullanıcılar tarafından verilebilir
            if (user.badge < 19) { // 19 = Eş Sahip rozeti
                return reply.status(403).send({ 
                    success: 0, 
                    error: 'Tenzil sadece eş sahip ve üzeri rütbedeki kullanıcılar tarafından verilebilir' 
                });
            }

            // Tenzil veren kişinin kodunu kontrol et
            const demoterCode = await getCodename({
                in: "id",
                value: user.id,
                out: "all"
            });

            if (!demoterCode) {
                return reply.status(400).send({ 
                    success: 0, 
                    error: 'Tenzil verebilmek için önce bir kod ayarlamanız gerekiyor. Discord sunucusunda /kod ayarla komutunu kullanın.'
                });
            }

            // Hedef kullanıcıyı bul
            const targetUser = await getUserRow({
                in: 'username',
                value: username,
                out: 'all'
            });

            if (!targetUser) {
                return reply.status(404).send({ success: 0, error: 'Böyle bir kullanıcı bulunamadı' });
            }

            // Rütbe kontrolleri
            if (demoter.badge <= targetUser.badge) {
                return reply.status(403).send({ 
                    success: 0, 
                    error: 'Sadece kendinizden daha düşük rütbedeki kullanıcılara tenzil verebilirsiniz' 
                });
            }

            // badges.json dosyasını kontrol et
            const badgesPath = path.join(__dirname, "../../../../cache/badges.json");
            if (!require('fs').existsSync(badgesPath)) {
                apiLogger.error('badges.json not found at path:', badgesPath);
                return reply.status(500).send({ success: 0, error: 'Badge configuration not found' });
            }

            const badgesData = require(badgesPath);
            const currentBadgeKey = Object.keys(badgesData)[targetUser.badge - 1];

            // Mevcut ve önceki rozet/rütbe bilgilerini belirle
            let prevBadgeLevel = targetUser.badge;
            let prevRank = targetUser.rank;
            
            // Rütbede bir kademe düşür, eğer rütbe 1 ise bir alt rozete geç
            let newBadgeLevel, newRank;
            if (targetUser.rank > 1) {
                newBadgeLevel = targetUser.badge;
                newRank = targetUser.rank - 1;
            } else {
                if (targetUser.badge > 1) {
                    newBadgeLevel = targetUser.badge - 1;
                    // Bir alt rozetin son rütbesine düşür
                    const prevBadgeKey = Object.keys(badgesData)[newBadgeLevel - 1];
                    newRank = badgesData[prevBadgeKey].ranks.length;
                } else {
                    return reply.status(400).send({ 
                        success: 0, 
                        error: 'Kullanıcı zaten en düşük rütbede' 
                    });
                }
            }

            const now = new Date();
            let payload = {
                id: targetUser.habbo_id,
                type: 'badge_down',
                username: targetUser.username,
                promoter: user.id,
                old_badge: prevBadgeLevel,
                old_rank: prevRank,
                new_badge: newBadgeLevel,
                new_rank: newRank,
                action_timestamp: Math.floor(now.getTime() / 1000),
                action_date: now,
                action_time: now.toTimeString().split(' ')[0],
                codename: `${result.user.username} (${demoterCode.codename})`
            };

            try {
                // Veritabanına kaydet
                await createArchiveRow(payload);
                const newBitFlags = bitflagsManager.calculateBitflags(newBadgeLevel, targetUser.bitflags);
                // Kullanıcının badge ve rank bilgilerini güncelle
                const updateResult = await updateUserRow(targetUser.id, {
                    badge: newBadgeLevel,
                    rank: newRank,
                    bitflags: newBitFlags
                });

                if (!updateResult) {
                    apiLogger.error('Failed to update user badge and rank:', {
                        userId: targetUser.id,
                        newBadge: newBadgeLevel,
                        newRank: newRank
                    });
                    return reply.status(500).send({
                        success: 0,
                        error: 'Tenzil kaydı oluşturuldu fakat kullanıcı bilgileri güncellenemedi'
                    });
                }

                // Discord'a log gönder
                const system = globalStore.collection('system');
                const client = system.get('discordClient') as Client;
                const badgeLogChannelId = config().app.DISCORD_BOT?.CHANNELS?.BADGE_LOG;

                if (client && badgeLogChannelId) {
                    const badgeLogChannel = client.channels.cache.get(badgeLogChannelId.toString());
                    if (badgeLogChannel && badgeLogChannel.isTextBased() && 'send' in badgeLogChannel) {
                        const oldBadgeName = Object.keys(badgesData)[prevBadgeLevel - 1];
                        const newBadgeName = Object.keys(badgesData)[newBadgeLevel - 1];
                        const oldRankName = badgesData[oldBadgeName]?.ranks[prevRank - 1] || 'Bilinmeyen Rank';
                        const newRankName = badgesData[newBadgeName]?.ranks[newRank - 1] || 'Bilinmeyen Rank';

                        // Discord'a log gönder
                        const { logDemotion } = await import('../../../utils/discordLog');
                        await logDemotion({
                            username: username,
                            oldBadge: oldBadgeName,
                            oldRank: oldRankName,
                            newBadge: newBadgeName,
                            newRank: newRankName,
                            codename: `${result.user.username} (${demoterCode.codename})`
                        });
                    }
                }

                // Rozet ve rank isimlerini al
                const oldBadgeName = Object.keys(badgesData)[prevBadgeLevel - 1];
                const newBadgeName = Object.keys(badgesData)[newBadgeLevel - 1];
                const oldRankName = badgesData[oldBadgeName]?.ranks[prevRank - 1] || 'Bilinmeyen Rank';
                const newRankName = badgesData[newBadgeName]?.ranks[newRank - 1] || 'Bilinmeyen Rank';

                return reply.status(200).send({
                    success: 1,
                    message: 'Tenzil başarıyla verildi',
                    old_badge: prevBadgeLevel,
                    old_rank: prevRank,
                    old_badge_name: oldBadgeName,
                    old_rank_name: oldRankName,
                    new_badge: newBadgeLevel,
                    new_rank: newRank,
                    new_badge_name: newBadgeName,
                    new_rank_name: newRankName,
                    newBitFlags,
                    codename: `${result.user.username} (${demoterCode.codename})`
                });

            } catch (error: any) {
                apiLogger.error('Error processing demotion:', {
                    message: error.message,
                    stack: error.stack,
                    name: error.name,
                    error
                });
                return reply.status(500).send({
                    success: 0,
                    error: 'Error processing demotion',
                    message: error.message
                });
            }

        } catch (err) {
            const error = err as Error;
            apiLogger.error('Error in POST /badge/demote:', {
                message: error.message,
                stack: error.stack,
                name: error.name,
                error: err
            });
            return reply.status(500).send({
                success: 0,
                error: 'Internal Server Error',
            });
        }
    });

    // Tenzil öncesi bilgi alma endpoint'i
    fastify.get('/badge/demote', async (request, reply) => {
        try {
            const { username } = request.query as { username?: string };
            if (!username) {
                return reply.status(400).send({ success: 0, error: 'Username is required' });
            }

            // Token ve auth kontrolleri
            const result = await authenticateRequest(request as any);
            if (!result?.user) {
                return reply.status(401).send({ success: 0, error: 'Unauthorized' });
            }

            const user = result.user;

            // Tenzil yetkisi kontrolü
            if (user.badge < 8) {
                return reply.status(403).send({ 
                    success: 0, 
                    error: 'Tenzil sadece eş sahip ve üzeri rütbedeki kullanıcılar tarafından verilebilir' 
                });
            }

            const targetUser = await getUserRow({
                in: 'username',
                value: username,
                out: 'all'
            });

            if (!targetUser) {
                return reply.status(404).send({ success: 0, error: 'Böyle bir kullanıcı bulunamadı' });
            }

            if (user.badge <= targetUser.badge) {
                return reply.status(403).send({ 
                    success: 0, 
                    error: 'Sadece kendinizden daha düşük rütbedeki kullanıcılara tenzil verebilirsiniz' 
                });
            }

            const badgesPath = path.join(__dirname, "../../../../cache/badges.json");
            if (!require('fs').existsSync(badgesPath)) {
                apiLogger.error('badges.json not found at path:', badgesPath);
                return reply.status(500).send({ success: 0, error: 'Badge configuration not found' });
            }

            const badgesData = require(badgesPath);
            const currentBadgeKey = Object.keys(badgesData)[targetUser.badge - 1];

            // Mevcut rozet/rütbe bilgilerini al
            const currentBadgeName = Object.keys(badgesData)[targetUser.badge - 1];
            const currentRankName = badgesData[currentBadgeKey]?.ranks[targetUser.rank - 1] || 'Bilinmeyen Rank';

            // Tenzil sonrası rozet/rütbe bilgilerini belirle
            let newBadgeLevel, newRank;
            if (targetUser.rank > 1) {
                newBadgeLevel = targetUser.badge;
                newRank = targetUser.rank - 1;
            } else {
                if (targetUser.badge > 1) {
                    newBadgeLevel = targetUser.badge - 1;
                    const prevBadgeKey = Object.keys(badgesData)[newBadgeLevel - 1];
                    newRank = badgesData[prevBadgeKey].ranks.length;
                } else {
                    return reply.status(400).send({ 
                        success: 0, 
                        error: 'Kullanıcı zaten en düşük rütbede' 
                    });
                }
            }

            const newBadgeName = Object.keys(badgesData)[newBadgeLevel - 1];
            const newBadgeKey = Object.keys(badgesData)[newBadgeLevel - 1];
            const newRankName = badgesData[newBadgeKey]?.ranks[newRank - 1] || 'Bilinmeyen Rank';

            return reply.status(200).send({
                success: 1,
                username: targetUser.username,
                current_badge: targetUser.badge,
                current_rank: targetUser.rank,
                current_badge_name: currentBadgeName,
                current_rank_name: currentRankName,
                new_badge: newBadgeLevel,
                new_rank: newRank,
                new_badge_name: newBadgeName,
                new_rank_name: newRankName
            });

        } catch (err) {
            const error = err as Error;
            apiLogger.error('Error in GET /badge/demote:', {
                message: error.message,
                stack: error.stack,
                name: error.name,
                error: err
            });
            return reply.status(500).send({
                success: 0,
                error: 'Internal Server Error',
            });
        }
    });
}