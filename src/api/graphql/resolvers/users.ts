//@ts-nocheck

import { getUser, getAllUsers, getUserTime, getDailyUserTime, getUserBadgeInfo, getUserRow, getAllUserTimes } from '../../../db_utilities/postgres';
import { getUserWorkTime } from '../../../db_utilities/work_time';
import { globalStore } from '../../../utils';
import { apiLogger } from '../../../logger';
import { QueryResolvers, GraphQLContext } from '../types/users';
import * as fs from 'fs';
import * as path from 'path';

// Badge bilgilerini oku
const getBadgesData = () => {
    const badgesPath = path.join(process.cwd(), 'cache', 'badges.json');
    if (!fs.existsSync(badgesPath)) {
        apiLogger.error('badges.json not found');
        return {};
    }
    return JSON.parse(fs.readFileSync(badgesPath, 'utf-8'));
};

const resolvers = {
    Query: {
        user: async (_, { id, username, index }) => {
            try {
                let userData;
                
                if (id) {
                    // ID'nin formatına göre arama yap (Discord ID ya da normal ID)
                    if (id.toString().length >= 17) {
                        // Discord ID formatı - habbo_id olarak ara
                        apiLogger.debug('Searching by habbo_id:', id);
                        userData = await getUserRow({ in: 'habbo_id', value: BigInt(id), out: 'all' });
                    } else {
                        // Normal ID - önce users sonra stack'te ara
                        apiLogger.debug('Searching by normal id:', id);
                        userData = await getUserRow({ in: 'id', value: id, out: 'all' });
                        if (!userData) {
                            userData = await getUser({ in: 'id', value: id, out: 'all' });
                        }
                    }
                } else if (username) {
                    apiLogger.debug('Searching by username:', username);
                    userData = await getUser({ in: 'username', value: username, out: 'all' });
                } else if (index !== undefined) {
                    apiLogger.debug('Searching by index:', index);
                    userData = await getUser({ in: 'index', value: index, out: 'all' });
                }

                // Eğer stack tablosunda bulunamadıysa, time tablosundan ara
                if (!userData && (id || username)) {
                    const { getPostgresInstance } = await import('../../../db_utilities/postgres');
                    const pool = getPostgresInstance();
                    
                    let timeResult;
                    if (id) {
                        timeResult = await pool.query('SELECT user_id, username FROM time WHERE user_id = $1', [id]);
                    } else if (username) {
                        timeResult = await pool.query('SELECT user_id, username FROM time WHERE username = $1', [username]);
                    }
                    
                    if (timeResult && timeResult.rows.length > 0) {
                        const timeRecord = timeResult.rows[0];
                        userData = {
                            id: timeRecord.user_id,
                            username: timeRecord.username,
                            figure: null,
                            motto: null,
                            look: null,
                            index: null,
                            last_seen: null
                        };
                    }
                }

                if (!userData) return null;

                // Zaman bilgilerini ve user verilerini al
                const timeData = await getUserTime(userData.id);
                const workTime = await getUserWorkTime(userData.id);
                // Badge ve extras bilgisini almak için habbo_id'yi kullan
                const badgeInfoId = id || userData.id;
                const userRow = await getUserRow({ in: 'habbo_id', value: badgeInfoId, out: 'all' });
                const badgeInfo = await getUserBadgeInfo(badgeInfoId);

                // Rozet için gereken süreyi al
                const badgesData = getBadgesData();
                // Badge 0 ise gerekli süre de 0 olmalı
                const badgeKey = badgeInfo.badge > 0 ? Object.keys(badgesData)[badgeInfo.badge - 1] : null;
                const requiredTime = badgeKey && badgeInfo.badge > 0 ? badgesData[badgeKey].duration : 0;

                // Avatar URL'ini username'e göre oluştur
                const avatarUrl = userData.username ? 
                    `https://www.habbo.com.tr/habbo-imaging/avatarimage?user=${encodeURIComponent(userData.username)}&direction=2&head_direction=2&gesture=nrm&size=l` : null;

                return {
                    ...userData,
                    time: {
                        ...timeData,
                        workTime: Math.floor(workTime / (1000 * 60)), // ms to minutes
                        requiredWorkTime: requiredTime
                    },
                    avatar: avatarUrl,
                    dailyTime: Math.floor(timeData.storedTotal / (1000 * 60)), // ms to minutes
                    badgeInfo: {
                        badge: badgeInfo.badge,
                        rank: badgeInfo.rank,
                        badgeName: badgeInfo.badgeName,
                        rankName: badgeInfo.rankName,
                        requiredTime
                    },
                    extras: userRow?.extras || []
                };
            } catch (error) {
                apiLogger.error('Error in user resolver:', error);
                throw new Error('Failed to fetch user data');
            }
        },

        users: async (_, { limit = 50, offset = 0 }) => {
            try {
                const safeLimit = Math.max(0, Math.min(100, Number(limit) || 50));
                const safeOffset = Math.max(0, Number(offset) || 0);

                // Hem stack tablosundaki (aktif) hem de time tablosundaki (tüm) kullanıcıları al
                const [stackUsers, allTimeUsers] = await Promise.all([
                    getAllUsers(),
                    getAllUserTimes()
                ]);

                const badgesData = getBadgesData();
                
                // Stack kullanıcılarını Map'e çevir (hızlı arama için)
                const stackUsersMap = new Map();
                stackUsers.forEach(user => {
                    stackUsersMap.set(user.id, user);
                });
                
                const pageUsers = allTimeUsers.slice(safeOffset, safeOffset + safeLimit);

                // Tüm time kullanıcıları için veri oluştur
                const enrichedUsers = await Promise.all(pageUsers.map(async (timeUser) => {
                    const stackUser = stackUsersMap.get(timeUser.user_id);
                    
                    // Eğer stack'te varsa stack verilerini kullan, yoksa time verilerini kullan
                    const userData = stackUser || {
                        id: timeUser.user_id,
                        username: timeUser.username,
                        figure: null,
                        motto: null,
                        look: null,
                        index: null,
                        last_seen: null
                    };
                    
                    const timeData = await getUserTime(timeUser.user_id);
                    const workTime = await getUserWorkTime(timeUser.user_id);
                    // Badge ve extras bilgisini almak için stack'te varsa habbo_id'yi kullan, yoksa user_id'yi kullan
                    const badgeInfoId = stackUser?.habbo_id || timeUser.user_id;
                    const userRow = await getUserRow({ in: 'habbo_id', value: badgeInfoId, out: 'all' });
                    const badgeInfo = await getUserBadgeInfo(badgeInfoId) || {
                        badge: 0,
                        rank: 0,
                        badgeName: null,
                        rankName: null
                    };

                    const badgeKey = Object.keys(badgesData)[badgeInfo.badge - 1];
                    const requiredTime = badgeKey ? badgesData[badgeKey].duration : 0;
                    
                    // Avatar URL'ini username'e göre oluştur
                    const avatarUrl = userData.username ? 
                        `https://www.habbo.com.tr/habbo-imaging/avatarimage?user=${encodeURIComponent(userData.username)}&direction=2&head_direction=2&gesture=nrm&size=l` : null;
                    
                    return {
                        ...userData,
                        time: {
                            ...timeData,
                            workTime: Math.floor(workTime / (1000 * 60)), // ms to minutes
                            requiredWorkTime: requiredTime
                        },
                        avatar: avatarUrl,
                        dailyTime: Math.floor(timeData.storedTotal / (1000 * 60)), // ms to minutes
                        badgeInfo: {
                            badge: badgeInfo.badge,
                            rank: badgeInfo.rank,
                            badgeName: badgeInfo.badgeName,
                            rankName: badgeInfo.rankName,
                            requiredTime
                        },
                        extras: userRow?.extras || []
                    };
                }));

                return enrichedUsers;
            } catch (error) {
                apiLogger.error('Error in users resolver:', error);
                throw new Error('Failed to fetch users data');
            }
        },

        activeUsers: async (_, { limit = 50, offset = 0 }) => {
            try {
                const activeTimeCollection = globalStore.collection('activeTimeData');
                const safeLimit = Math.max(0, Math.min(100, Number(limit) || 50));
                const safeOffset = Math.max(0, Number(offset) || 0);
                const activeUserIds = Array.from(activeTimeCollection.keys()).slice(safeOffset, safeOffset + safeLimit);
                const badgesData = getBadgesData();
                
                // Her aktif kullanıcı için detaylı bilgi al
                const activeUsers = await Promise.all(activeUserIds.map(async (userId) => {
                    const userData = await getUser({ in: 'id', value: userId, out: 'all' });
                    if (!userData) return null;

                    const timeData = await getUserTime(userData.id);
                    const workTime = await getUserWorkTime(userData.id);
                    const userRow = await getUserRow({ in: 'id', value: userData.id, out: 'all' });
                    const badgeInfo = await getUserBadgeInfo(userData.id) || {
                        badge: 0,
                        rank: 0,
                        badgeName: null,
                        rankName: null
                    };

                    const badgeKey = Object.keys(badgesData)[badgeInfo.badge - 1];
                    const requiredTime = badgeKey ? badgesData[badgeKey].duration : 0;

                    const avatarUrl = userData.username ? 
                        `https://www.habbo.com.tr/habbo-imaging/avatarimage?user=${encodeURIComponent(userData.username)}&direction=2&head_direction=2&gesture=nrm&size=l` : null;

                    return { 
                        ...userData,
                        time: {
                            ...timeData,
                            workTime: Math.floor(workTime / (1000 * 60)), // ms to minutes
                            requiredWorkTime: requiredTime
                        },
                        avatar: avatarUrl,
                        dailyTime: Math.floor(timeData.storedTotal / (1000 * 60)), // ms to minutes
                        badgeInfo: {
                            badge: badgeInfo.badge,
                            rank: badgeInfo.rank,
                            badgeName: badgeInfo.badgeName,
                            rankName: badgeInfo.rankName,
                            requiredTime
                        },
                        extras: userRow?.extras || []
                    };
                }));

                return activeUsers.filter(user => user !== null);
            } catch (error) {
                apiLogger.error('Error in activeUsers resolver:', error);
                throw new Error('Failed to fetch active users data');
            }
        },

        topUsers: async (_, { limit = 10, offset = 0 }) => {
            try {
                const safeLimit = Math.max(0, Math.min(100, Number(limit) || 10));
                const safeOffset = Math.max(0, Number(offset) || 0);

                // Hem stack tablosundaki (aktif) hem de time tablosundaki (tüm) kullanıcıları al
                const [stackUsers, allTimeUsers] = await Promise.all([
                    getAllUsers(),
                    getAllUserTimes()
                ]);

                const badgesData = getBadgesData();
                
                // Stack kullanıcılarını Map'e çevir (hızlı arama için)
                const stackUsersMap = new Map();
                stackUsers.forEach(user => {
                    stackUsersMap.set(user.id, user);
                });
                
                // Tüm time kullanıcıları için veri oluştur ve sırala
                const enrichedUsers = await Promise.all(allTimeUsers.map(async (timeUser) => {
                    const stackUser = stackUsersMap.get(timeUser.user_id);
                    
                    // Eğer stack'te varsa stack verilerini kullan, yoksa time verilerini kullan
                    const userData = stackUser || {
                        id: timeUser.user_id,
                        username: timeUser.username,
                        figure: null,
                        motto: null,
                        look: null,
                        index: null,
                        last_seen: null
                    };
                    
                    const timeData = await getUserTime(timeUser.user_id);
                    const workTime = await getUserWorkTime(timeUser.user_id);
                    // Badge ve extras bilgisini almak için stack'te varsa habbo_id'yi kullan, yoksa user_id'yi kullan
                    const badgeInfoId = stackUser?.habbo_id || timeUser.user_id;
                    const userRow = await getUserRow({ in: 'habbo_id', value: badgeInfoId, out: 'all' });
                    const badgeInfo = await getUserBadgeInfo(badgeInfoId) || {
                        badge: 0,
                        rank: 0,
                        badgeName: null,
                        rankName: null
                    };
                    
                    const badgeKey = Object.keys(badgesData)[badgeInfo.badge - 1];
                    const requiredTime = badgeKey ? badgesData[badgeKey].duration : 0;

                    return {
                        ...userData,
                        time: {
                            ...timeData,
                            workTime: Math.floor(workTime / (1000 * 60)), // ms to minutes
                            requiredWorkTime: requiredTime
                        },
                        avatar: userData.username ? `https://www.habbo.com.tr/habbo-imaging/avatarimage?user=${encodeURIComponent(userData.username)}&direction=2&head_direction=2&gesture=nrm&size=l` : null,
                        dailyTime: Math.floor(timeData.storedTotal / (1000 * 60)), // ms to minutes
                        badgeInfo: {
                            badge: badgeInfo.badge,
                            rank: badgeInfo.rank,
                            badgeName: badgeInfo.badgeName,
                            rankName: badgeInfo.rankName,
                            requiredTime
                        },
                        extras: userRow?.extras || []
                    };
                }));

                // Toplam süreye göre sırala ve limit uygula
                return enrichedUsers
                    .sort((a, b) => b.time.realTimeTotal - a.time.realTimeTotal)
                    .slice(safeOffset, safeOffset + safeLimit);
            } catch (error) {
                apiLogger.error('Error in topUsers resolver:', error);
                throw new Error('Failed to fetch top users data');
            }
        }
    }
};

export default resolvers;