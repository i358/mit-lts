import { Crypter } from '../../utils/crypter';
import base64url from 'base64url';
import { config } from '../../../config';
import { createArchiveRow, createUserRow, getAllUsers, getArchiveRow, getCodename, getDailyUserTime, getUser, getUserRow, getUserTime, updateUserRow, updateUserRowIfCurrent } from '../../../db_utilities/postgres';

import { getUserWorkTime, resetUserWorkTime, updateUserWorkTime } from '../../../db_utilities/work_time';
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

export default async function badgeRoute(fastify: FastifyInstance) {
    fastify.get("/badge/search/:username", async (req, res) => {
        const { username: targetUsername } = req.params as { username?: string };
        if (!targetUsername) {
            return res.status(400).send({ success: 0, error: 'Username is required' });
        }

        const result = await authenticateRequest(req as any);
        if (!result?.user) {
            return res.status(401).send({ success: 0, error: 'Unauthorized' });
        }

        const user = result.user;
        if (!bitflagsManager.hasPermission(user.bitflags, "GIVE_BADGES")) {
            return res.status(403).send({ success: 0, error: 'Bu işlemi gerçekleştiren kullanıcı yeterli izinlere sahip değil' });
        }

        const allUsers = await getAllUsers();
        const query = targetUsername.toLocaleLowerCase('tr-TR');

        const matches = (allUsers || [])
            .filter((u: any) => typeof u?.username === 'string')
            .filter((u: any) => u.username.toLocaleLowerCase('tr-TR').includes(query))
            .slice(0, 20);

        const matchesFormatted = []
        for (const match of matches) {
            const isRegistered = await getUserRow({
                in: "username",
                value: match.username,
                out: "username"
            })
            matchesFormatted.push({
                username: match.username,
                hid: match.id,
                registered: isRegistered ? true : false
            })
        }
        return res.status(200).send(matchesFormatted);
    })

    fastify.post("/badge/check", async (req, res) => {
        try {
            const body = req.body as any;
            const modeRaw = body?.mode;
            const mode = (modeRaw === 'check' || modeRaw === 'create') ? modeRaw : 'create';
            const hid = Number(body?.hid);
            const rank = body?.rank !== undefined ? Number(body?.rank) : undefined;

            if (!hid) {
                return res.status(400).send({ success: 0, error: 'Habbo ID is required' });
            }
            if (!Number.isInteger(hid)) {
                return res.status(400).send({ success: 0, error: 'Habbo ID must be an integer' });
            }
            if (mode === 'create') {
                if (rank === undefined) {
                    return res.status(400).send({ success: 0, error: 'Rank is required' });
                }
                if (!Number.isInteger(rank)) {
                    return res.status(400).send({ success: 0, error: 'Rank must be an integer' });
                }
                if (rank < 1) {
                    return res.status(400).send({ success: 0, error: 'Rank must be at least 1' });
                }
            }

            const result = await authenticateRequest(req as any);
            if (!result?.user) {
                return res.status(401).send({ success: 0, error: 'Unauthorized' });
            }

            const user = result.user;
            if (!bitflagsManager.hasPermission(user.bitflags, "GIVE_BADGES")) {
                return res.status(403).send({ success: 0, error: 'Bu işlemi gerçekleştiren kullanıcı yeterli izinlere sahip değil' });
            }

            let targetUserData = await getUser({
                in: "id",
                value: hid,
                out: "all"
            })

            if (!targetUserData) {
                return res.status(404).send({ success: 0, error: 'Hedef kullanıcı odada bulunamadı' });
            }

            let isRegistered = await getUserRow({
                in: "habbo_id",
                value: targetUserData.id,
                out: "all"
            })

            if (!isRegistered || isRegistered == null) {
                let { data: userData } = await axios.get(`https://habbo.com.tr/api/public/users?name=${targetUserData.username}`)
                let uid = userData.uniqueId;
                try {
                    let response = await axios.get(`https://habbo.com.tr/api/public/users/${uid}/groups`)
                    const groupData = response.data;
                    const groups = [];

                    if (groupData.length === 0) {
                        return res.status(200).send({ success: 0, error: "Hedef kullanıcı hiçbir gruba dahil değil" });
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
                    const istihbaratKey = badgeKeys.find((k) => normalizeName(k) === normalizeName('Eş Sahip'));
                    const istihbaratIndex = istihbaratKey ? badgeOrder.get(istihbaratKey) : undefined;
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

                        groups.push({
                            name: best.key
                        });
                    }

                    // İstihbarat rozetinden yüksek kullanıcılar filtrelenir
                    if (
                        typeof istihbaratIndex === 'number' &&
                        currentBadge &&
                        (currentBadge.badgeLevel - 1) > istihbaratIndex
                    ) {
                        return res.status(200).send({
                            success: 0,
                            hasHigherRank: true
                        });
                    }

                    if (!currentBadge) {
                        return res.status(200).send({
                            success: 0,
                            error: "Kullanıcının MIT'e ait hiçbir rozeti yok."
                        });
                    }

                    if (mode === 'create') {
                        const badgeKey = badgeKeys[currentBadge.badgeLevel - 1];
                        const maxRank = badgeKey ? (badgesJson as any)?.[badgeKey]?.ranks?.length : undefined;
                        if (!maxRank || typeof maxRank !== 'number' || maxRank <= 0) {
                            return res.status(500).send({ success: 0, error: 'Badge rank configuration not found' });
                        }
                        if (typeof rank === 'number' && rank > maxRank) {
                            return res.status(400).send({ success: 0, error: `Rank must be between 1 and ${maxRank}` });
                        }
                    }

                    if (mode === 'check') {
                        return res.status(200).send({
                            success: 1,
                            registered: false,
                            user: {
                                username: targetUserData.username,
                                badge: currentBadge.badgeLevel,
                                habbo_id: hid
                            }
                        });
                    }

                    const sf = new Snowflake();
                    const sid = await sf.createUUID({encoding: "none"});
                    let calculatedBitflags = bitflagsManager.calculateBitflags(currentBadge.badgeLevel, 0);
                  try{
                      let newUser = await createUserRow({
                        id: sid.toString(),
                        username: targetUserData.username,
                        habbo_id: targetUserData.id,
                        secret: "0",
                        avatar: "https://www.habbo.com.tr/habbo-imaging/avatarimage?user="+targetUserData.username+"&direction=2&head_direction=2&action=&gesture=agr&size=l",
                        badge: currentBadge.badgeLevel,
                        rank: Number(rank),

                        salary: BigInt(0),
                        coins: 0,
                        bitflags: calculatedBitflags,
                        user_flags: 0n,
                        ip_addr: "0.0.0.0",
                        created_at: new Date().toISOString()
                    })
                    if(newUser){
                        return res.status(200).send({
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
                  }catch(error){
                    console.error(error)
                    return res.status(500).send({ success: 0, registered:false, error: "Kullanıcı oluşturulurken bir hata oluştu." })
                  }

                } catch {
                    return res.status(404).send({ success: 0, error: "Kullanıcının profili gizli olduğu için rozet verileri alınamadı." })
                }

            } else {
                let registeredData = isRegistered;
                const { username, badge, rank, id, habbo_id } = registeredData
                const badgeKeys = Object.keys((badgesJson as any) || {});
                const normalizeName = (value: string) => {
                    return value
                        .toLocaleLowerCase('tr-TR')
                        .replace(/i̇/g, 'i')
                        .replace(/ğ/g, 'g')
                        .replace(/ü/g, 'u')
                        .replace(/ş/g, 's')
                        .replace(/ı/g, 'i')
                        .replace(/ö/g, 'o')
                        .replace(/ç/g, 'c')
                        .trim();
                };
                const istihbaratKey = badgeKeys.find((k) => normalizeName(k) === normalizeName('Eş Sahip'));
                const istihbaratIndex = istihbaratKey ? badgeKeys.indexOf(istihbaratKey) : -1;

                if (istihbaratIndex >= 0 && typeof badge === 'number' && badge > (istihbaratIndex + 1)) {
                    return res.status(200).send({
                        success: 0,
                        hasHigherRank: true
                    });
                }
                return res.status(200).send({
                    success: 1,
                    registered: true,
                    user: {
                        username,
                        badge,
                        rank,
                        id
                    }
                });
            }
        } catch (error) {
            return res.status(500).send({ success: 0, error: 'Internal server error' });
        }
    });

    fastify.post('/badge', async (request, reply) => {
        try {
            // İlk olarak work_time tablosunu oluşturalım
            const { createWorkTimeTable } = await import('../../../db_utilities/work_time');
            await createWorkTimeTable();
            const { username, mode } = request.body as { username?: string, mode?: string };
            if (!username) {
                return reply.status(400).send({ success: 0, error: 'Username is required' });
            }

            const result = await authenticateRequest(request as any);
            if (!result?.user) {
                return reply.status(401).send({ success: 0, error: 'Unauthorized' });
            }

            const user = result.user;
            const uid = user.id;

            let promoter = {
                username: user.username,
                badge: user.badge,
                rank: user.rank,
                bitflags: user.bitflags
            }
            if (!bitflagsManager.hasPermission(promoter.bitflags, "GIVE_BADGES")) {
                return reply.status(403).send({ success: 0, error: 'Bu işlemi gerçekleştiren kullanıcı yeterli izinlere sahip değil' });
            }

            // Terfi veren kişinin kodunu erken kontrol et
            const promoterCode = await getCodename({
                in: "id",
                value: user.id,
                out: "all"
            });

            if (!promoterCode) {
                return reply.status(400).send({
                    success: 0,
                    error: 'Terfi verebilmek için önce bir kod ayarlamanız gerekiyor. Discord sunucusunda /kod ayarla komutunu kullanın.'
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
            const targetUserData = {
                username: targetUser.username,
                badge: targetUser.badge,
                rank: targetUser.rank,
                time: await getDailyUserTime(targetUser.habbo_id)
            }
            if (promoter.badge <= targetUser.badge) {
                return reply.status(403).send({ success: 0, error: 'Sadece daha düşük rütbeye sahip kullanıcılara rozet verebilirsiniz' });
            }
            if (targetUserData.rank === 0) {
                return reply.status(403).send({ success: 0, error: 'Eş sahip üzeri olan veya kayıtsız olan kullanıcılara rozet verilemez' });
            }
            // Work time tablosundan kullanıcının çalışma süresini al
            const workTime = await getUserWorkTime(targetUser.habbo_id);
            const realTime = workTime / (1000 * 60); // Milisaniyeyi dakikaya çevir

            apiLogger.debug('Time calculation for promotion:', {
                userId: targetUser.habbo_id,
                username: targetUser.username,
                workTimeMs: workTime,
                realTimeMinutes: realTime
            });

            apiLogger.debug('Time calculation:', {
                userTime: targetUserData.time,
                realTime,
                username: targetUserData.username
            });
            const badgesPath = path.join(__dirname, "../../../../cache/badges.json");
            if (!require('fs').existsSync(badgesPath)) {
                apiLogger.error('badges.json not found at path:', badgesPath);
                return reply.status(500).send({ success: 0, error: 'Badge configuration not found' });
            }

            const badgesData = require(badgesPath);

            const badgeKeys = Object.keys(badgesData);
            const normalizeName = (value: string) => {
                return value
                    .toLocaleLowerCase('tr-TR')
                    .replace(/i̇/g, 'i')
                    .replace(/ğ/g, 'g')
                    .replace(/ü/g, 'u')
                    .replace(/ş/g, 's')
                    .replace(/ı/g, 'i')
                    .replace(/ö/g, 'o')
                    .replace(/ç/g, 'c')
                    .trim();
            };
            const istihbaratKey = badgeKeys.find((k: string) => normalizeName(k) === normalizeName('Eş Sahip'));
            const istihbaratIndex = istihbaratKey ? badgeKeys.indexOf(istihbaratKey) : -1;
            if (istihbaratIndex >= 0 && targetUser.badge > (istihbaratIndex + 1)) {
                return reply.status(403).send({
                    success: 0,
                    error: 'Eş Sahip üzeri kullanıcılara işlem yapılamaz'
                });
            }

            // Mevcut rozetin maksimum rankını kontrol et
            const currentBadgeKey = Object.keys(badgesData)[targetUser.badge - 1];
            const currentBadgeData = badgesData[currentBadgeKey];
            const isLastRank = targetUser.rank >= currentBadgeData.ranks.length;

            // Sonraki rozeti belirle
            let nextBadgeLevel = targetUser.badge;
            let nextRank = targetUser.rank;
            let promotionType = 'badge_up'; // badge_up veya badge_up

            if (isLastRank) {
                nextBadgeLevel = targetUser.badge + 1;
                nextRank = 1; // Yeni rozette rank 1'den başla
                promotionType = 'badge_up';
            } else {
                nextRank = targetUser.rank + 1; // Aynı rozette bir sonraki rank
                promotionType = 'badge_up';
            }

            // Sonraki rozetin kontrolü
            const nextBadgeKey = Object.keys(badgesData)[nextBadgeLevel - 1];
            apiLogger.debug('Badge level check:', {
                nextBadgeLevel,
                nextBadgeKey,
                nextBadgeIndex: nextBadgeLevel - 1,
                badgeDataLength: Object.keys(badgesData).length,
                allBadges: Object.keys(badgesData)
            });
            if (!nextBadgeKey || !badgesData[nextBadgeKey]) {
                apiLogger.error('Next badge level not found:', {
                    currentBadge: targetUser.badge,
                    nextBadge: nextBadgeLevel,
                    calculatedIndex: nextBadgeLevel - 1,
                    availableBadges: Object.keys(badgesData)
                });
                return reply.status(400).send({ success: 0, error: 'Invalid next badge level' });
            } const requiredTime = badgesData[Object.keys(badgesData)[targetUser.badge - 1]].duration;

            if (realTime >= requiredTime) {
                if (mode === "promote") {
                    const calculatedFlags = bitflagsManager.calculateBitflags(nextBadgeLevel, targetUser.bitflags);

                    const didUpdate = await updateUserRowIfCurrent(
                        targetUser.id,
                        { badge: targetUser.badge, rank: targetUser.rank },
                        {
                            badge: nextBadgeLevel,
                            rank: nextRank,
                            bitflags: calculatedFlags
                        }
                    );

                    if (!didUpdate) {
                        return reply.status(409).send({
                            success: 0,
                            error: 'Bu kullanıcı zaten terfi ettirilmiş olabilir. Lütfen sayfayı yenileyip tekrar deneyin.'
                        });
                    }

                    await resetUserWorkTime(targetUser.habbo_id);

                    const now = new Date();
                    let payload = {
                        id: targetUser.habbo_id,
                        type: promotionType,
                        username: targetUserData.username,
                        promoter: user.id,
                        old_badge: targetUser.badge,
                        old_rank: targetUser.rank,
                        new_badge: nextBadgeLevel,
                        new_rank: nextRank,
                        action_timestamp: Math.floor(now.getTime() / 1000),
                        action_date: now,
                        action_time: now.toTimeString().split(' ')[0],
                        codename: `${result.user.username} (${promoterCode.codename})`
                    }

                    const oldBadgeName = Object.keys(badgesData)[targetUser.badge - 1];
                    const newBadgeName = Object.keys(badgesData)[nextBadgeLevel - 1];
                    const oldRankName = badgesData[oldBadgeName]?.ranks[targetUser.rank - 1] || 'Bilinmeyen Rank';
                    const newRankName = badgesData[newBadgeName]?.ranks[nextRank - 1] || 'Bilinmeyen Rank';

                    try {
                        await createArchiveRow(payload);

                        try {
                            const { logPromotion } = await import('../../../utils/discordLog');
                            await logPromotion({
                                username: username,
                                oldBadge: oldBadgeName,
                                oldRank: oldRankName,
                                newBadge: newBadgeName,
                                newRank: newRankName,
                                codename: `${result.user.username} (${promoterCode.codename})`,
                                workTime: {
                                    hours: Math.floor(realTime / 60),
                                    minutes: Math.floor(realTime % 60)
                                }
                            });
                        } catch (error: any) {
                            apiLogger.error('Error sending Discord promotion log:', {
                                message: error.message,
                                stack: error.stack,
                                name: error.name,
                                error
                            });
                        }
                    } catch (error: any) {
                        apiLogger.error('Error creating archive row:', {
                            message: error.message,
                            stack: error.stack,
                            name: error.name,
                            error
                        });
                    }

                    return reply.status(200).send({
                        success: 1,
                        message: promotionType === 'badge_up' ? 'Badge upgrade successful' : 'Rank upgrade successful',
                        old_badge: targetUser.badge,
                        old_rank: targetUser.rank,
                        old_badge_name: oldBadgeName,
                        old_rank_name: oldRankName,
                        new_badge: nextBadgeLevel,
                        new_rank: nextRank,
                        new_badge_name: newBadgeName,
                        new_rank_name: newRankName,
                        calculatedFlags,
                        codename: `${result.user.username} (${promoterCode.codename})`,
                        promotion_type: promotionType,
                        time: Math.floor(realTime)
                    });
                } else {
                    const currentBadgeName = Object.keys(badgesData)[targetUser.badge - 1];
                    const nextBadgeName = Object.keys(badgesData)[nextBadgeLevel - 1];
                    const currentRankName = badgesData[currentBadgeKey]?.ranks[targetUser.rank - 1] || 'Bilinmeyen Rank';
                    const nextRankName = badgesData[nextBadgeKey]?.ranks[nextRank - 1] || 'Bilinmeyen Rank';

                    return reply.status(200).send({
                        success: 1,
                        message: isLastRank ? 'Kullanıcı terfi edilebilir' : 'Bu kullanıcı terfi edilebilir',
                        current_badge: targetUser.badge,
                        current_rank: targetUser.rank,
                        current_badge_name: currentBadgeName,
                        current_rank_name: currentRankName,
                        next_badge: nextBadgeLevel,
                        next_rank: nextRank,
                        next_badge_name: nextBadgeName,
                        next_rank_name: nextRankName,
                        promotion_type: promotionType,
                        current_time: Math.floor(realTime),
                        required_time: requiredTime,
                        remaining_time: 0
                    });
                }
            } else {
                return reply.status(200).send({
                    success: 0,
                    message: `Kullanıcının terfi süresi yetersiz. Gereken süre: ${requiredTime} dakika, Mevcut süre: ${Math.floor(realTime)} dakika, Kalan süre: ${Math.floor(requiredTime - realTime)} dakika`,
                    current_badge: targetUser.badge,
                    current_rank: targetUser.rank,
                    current_badge_name: Object.keys(badgesData)[targetUser.badge - 1],
                    current_rank_name: badgesData[currentBadgeKey]?.ranks[targetUser.rank - 1] || 'Bilinmeyen Rank',
                    next_badge: nextBadgeLevel,
                    next_rank: nextRank,
                    next_badge_name: Object.keys(badgesData)[nextBadgeLevel - 1],
                    next_rank_name: badgesData[nextBadgeKey]?.ranks[nextRank - 1] || 'Bilinmeyen Rank',
                    promotion_type: promotionType,
                    required_time: requiredTime,
                    current_time: Math.floor(realTime),
                    remaining_time: Math.floor(requiredTime - realTime)
                });
            }

        } catch (err) {
            const error = err as Error;
            apiLogger.error('Error in GET /badge:', {
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