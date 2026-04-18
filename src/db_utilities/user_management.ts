import { Pool } from 'pg';
import { getPostgresInstance } from './postgres';
import { createLogger, LogLevel } from '../logger';
import { getBadgeDetails } from './badge_util';

const logger = createLogger({
    logLevel: LogLevel.DEBUG,
    writeToFile: true,
    logFilePath: '../logs/user_management.log',
    module: "UserManagement"
});

/**
 * Kullanıcı sayısını getirir
 */
export async function getUserCount(): Promise<number> {
    const pool = getPostgresInstance();
    try {
        const query = 'SELECT COUNT(*) FROM users';
        const result = await pool.query(query);
        return parseInt(result.rows[0].count);
    } catch (error) {
        logger.error('Error getting user count:', error);
        throw error;
    }
}

/**
 * Kullanıcı araması (username üzerinden, ILIKE)
 */
export async function searchUserCount(search: string): Promise<number> {
    const pool = getPostgresInstance();
    try {
        const query = 'SELECT COUNT(*) FROM users WHERE username ILIKE $1';
        const result = await pool.query(query, [`%${search}%`]);
        return parseInt(result.rows[0].count);
    } catch (error) {
        logger.error('Error getting searched user count:', error);
        throw error;
    }
}

/**
 * Username üzerinden arama ile kullanıcı listesini getirir (ban info + rozet/rütbe isimleri dahil)
 */
export async function searchUserList(search: string, limit: number = 10, offset: number = 0): Promise<any[]> {
    const pool = getPostgresInstance();
    try {
        const query = `
            SELECT u.id, u.username, u.badge, u.rank, u.avatar, u.habbo_id, 
                   u.coins, u.bitflags, u.user_flags, u.created_at, u.extras,
                   b.id as ban_id, b.permanently as banned_permanently,
                   b.expires as ban_expires, b.reason as ban_reason
            FROM users u
            LEFT JOIN banned b ON u.id = b.user_id
            AND (b.permanently = true OR (b.expires IS NOT NULL AND b.expires > CURRENT_TIMESTAMP))
            WHERE u.username ILIKE $1
            ORDER BY u.created_at DESC
            LIMIT $2 OFFSET $3
        `;
        const result = await pool.query(query, [`%${search}%`, limit, offset]);

        return result.rows.map(user => {
            const { badgeName, rankName } = getBadgeDetails(user.badge, user.rank);
            const isBanned = !!user.ban_id && (user.banned_permanently || (user.ban_expires && new Date(user.ban_expires) > new Date()));
            return {
                ...user,
                badge_name: badgeName,
                rank_name: rankName,
                is_banned: isBanned,
                ban_info: isBanned ? {
                    permanent: user.banned_permanently,
                    expires: user.ban_expires,
                    reason: user.ban_reason
                } : null
            };
        });
    } catch (error) {
        logger.error('Error searching user list:', error);
        throw error;
    }
}

/**
 * Sayfalama ile kullanıcı listesini getirir
 */
export async function getUserList(limit: number = 10, offset: number = 0): Promise<any[]> {
    const pool = getPostgresInstance();
    try {
        // Query with ban information using LEFT JOIN
        const query = `
            SELECT u.id, u.username, u.badge, u.rank, u.avatar, u.habbo_id, 
                   u.coins, u.bitflags, u.user_flags, u.created_at, u.extras,
                   b.id as ban_id, b.permanently as banned_permanently,
                   b.expires as ban_expires, b.reason as ban_reason
            FROM users u
            LEFT JOIN banned b ON u.id = b.user_id
            AND (b.permanently = true OR (b.expires IS NOT NULL AND b.expires > CURRENT_TIMESTAMP))
            ORDER BY u.created_at DESC
            LIMIT $1 OFFSET $2
        `;
        const result = await pool.query(query, [limit, offset]);

        // Enhance user data with badge details
        return result.rows.map(user => {
            const { badgeName, rankName } = getBadgeDetails(user.badge, user.rank);
            const isBanned = !!user.ban_id && (user.banned_permanently || (user.ban_expires && new Date(user.ban_expires) > new Date()));
            return {
                ...user,
                badge_name: badgeName,
                rank_name: rankName,
                is_banned: isBanned,
                ban_info: isBanned ? {
                    permanent: user.banned_permanently,
                    expires: user.ban_expires,
                    reason: user.ban_reason
                } : null
            };
        });
    } catch (error) {
        logger.error('Error getting user list:', error);
        throw error;
    }
}

/**
 * Kullanıcı silme işlemi
 */
export async function deleteUser(id: number): Promise<boolean> {
    const pool = getPostgresInstance();
    try {
        const query = 'DELETE FROM users WHERE id = $1';
        const result = await pool.query(query, [id]);
        return (result.rowCount || 0) > 0;
    } catch (error) {
        logger.error('Error deleting user:', error);
        throw error;
    }
}

/**
 * Kullanıcıyı siler
 */
export async function deleteUserRow(userId: string): Promise<boolean> {
    const pool = getPostgresInstance();
    try {
        // Start a transaction
        await pool.query('BEGIN');

        try {
            // First get the username for logging
            const userQuery = 'SELECT username FROM users WHERE id = $1';
            const userResult = await pool.query(userQuery, [userId]);
            const username = userResult.rows[0]?.username;

            if (!username) {
                throw new Error('User not found');
            }

            // İlk olarak kullanıcının oauth bağlantısını sil
            await pool.query('DELETE FROM oauth_links WHERE user_id = $1', [userId]);

            // Sonra ban kaydını sil
            await pool.query('DELETE FROM banned WHERE id = $1', [userId]);

            // Codenames tablosundaki ilgili tüm kayıtları sil
            await pool.query('DELETE FROM codenames WHERE id = $1', [userId]);
            
            // En son kullanıcıyı sil
            const query = 'DELETE FROM users WHERE id = $1';
            const result = await pool.query(query, [userId]);
            
            // Commit the transaction
            await pool.query('COMMIT');

            logger.info(`Successfully deleted user ${username} (ID: ${userId}) and all related records`);
            
            return (result.rowCount || 0) > 0;
        } catch (error) {
            // If there's an error, rollback the transaction
            await pool.query('ROLLBACK');
            throw error;
        }
    } catch (error) {
        logger.error('Error deleting user:', error);
        throw error;
    }
}

/**
 * Kullanıcı yetkilerini günceller
 */
export async function updateUserPermissions(userId: number, permissions: string): Promise<boolean> {
    const pool = getPostgresInstance();
    try {
        // Parse the permissions string back to BigInt for storage
        const permissionsBigInt = BigInt(permissions);
        
        const query = 'UPDATE users SET user_flags = $1 WHERE id = $2';
        const result = await pool.query(query, [permissionsBigInt.toString(), userId]);
        
        return (result.rowCount || 0) > 0;
    } catch (error) {
        logger.error('Error updating user permissions:', error);
        throw error;
    }
}