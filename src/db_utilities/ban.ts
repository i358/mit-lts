import { getPostgresInstance } from './postgres';
import { apiLogger } from '../logger';

export async function createBannedTable(): Promise<void> {
    const pool = getPostgresInstance();
    try {
        const query = `
            CREATE TABLE IF NOT EXISTS banned (
                id BIGSERIAL PRIMARY KEY,
                username TEXT NOT NULL,
                authoritative TEXT NOT NULL,
                user_id BIGINT NOT NULL,
                authoritative_id BIGINT NOT NULL,
                expires TIMESTAMP WITH TIME ZONE,
                permanently BOOLEAN DEFAULT false,
                ip_addr TEXT NULL,
                reason TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT fk_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_banned_user_id ON banned(user_id);
            CREATE INDEX IF NOT EXISTS idx_banned_username ON banned(username);
        `;
        await pool.query(query);
        apiLogger.info('Banned table created successfully');
    } catch (error) {
        apiLogger.error('Error creating banned table:', error);
        throw error;
    }
}

export interface BanData {
    username: string;
    authoritative: string;
    user_id: string;
    authoritative_id: string;
    expires?: Date;
    permanently: boolean;
    ip_addr?: string;
    reason?: string;
}

export async function createBanRecord(data: BanData): Promise<void> {
    const pool = getPostgresInstance();
    try {
        const query = `
            INSERT INTO banned (
                username, 
                authoritative, 
                user_id, 
                authoritative_id, 
                expires, 
                permanently, 
                ip_addr, 
                reason
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `;

        // IP adresi kontrolü
        const ip_addr = data.ip_addr === '0.0.0.0' || data.ip_addr === '::1' ? null : data.ip_addr;

        await pool.query(query, [
            data.username,
            data.authoritative,
            data.user_id,
            data.authoritative_id,
            data.expires || null,
            data.permanently,
            ip_addr,
            data.reason
        ]);

        apiLogger.info('Ban record created successfully', {
            username: data.username,
            authoritative: data.authoritative,
            permanently: data.permanently
        });
    } catch (error) {
        apiLogger.error('Error creating ban record:', error);
        throw error;
    }
}

export async function checkUserBanned(userId: string): Promise<boolean> {
    const pool = getPostgresInstance();
    try {
        const query = `
            SELECT * FROM banned 
            WHERE user_id = $1 
            AND (
                permanently = true 
                OR 
                (expires IS NOT NULL AND expires > CURRENT_TIMESTAMP)
            )
        `;
        
        const result = await pool.query(query, [userId]);
        return result.rows.length > 0;
    } catch (error) {
        apiLogger.error('Error checking user ban status:', error);
        throw error;
    }
}

export async function getBanHistory(userId: string): Promise<any[]> {
    const pool = getPostgresInstance();
    try {
        const query = `
            SELECT * FROM banned 
            WHERE user_id = $1 
            ORDER BY created_at DESC
        `;
        
        const result = await pool.query(query, [userId]);
        return result.rows;
    } catch (error) {
        apiLogger.error('Error getting ban history:', error);
        throw error;
    }
}

export async function removeBan(userId: string): Promise<void> {
    const pool = getPostgresInstance();
    try {
        const query = `
            DELETE FROM banned 
            WHERE user_id = $1 
            AND (
                permanently = true 
                OR 
                (expires IS NOT NULL AND expires > CURRENT_TIMESTAMP)
            )
        `;
        
        await pool.query(query, [userId]);
        apiLogger.info('Ban record deleted successfully for user:', userId);
    } catch (error) {
        apiLogger.error('Error deleting ban record:', error);
        throw error;
    }
}

export interface BanInfo {
    id: number;
    username: string;
    authoritative: string;
    user_id: string;
    authoritative_id: string;
    expires?: Date;
    permanently: boolean;
    ip_addr?: string;
    reason?: string;
    created_at: Date;
}

export async function checkIpBan(ip: string): Promise<BanInfo | null> {
    if (!ip || ip === '0.0.0.0' || ip === '::1') {
        return null;
    }

    const pool = getPostgresInstance();
    try {
        const query = `
            SELECT * FROM banned 
            WHERE ip_addr = $1 
            AND ip_addr != '0.0.0.0'
            AND ip_addr IS NOT NULL
            AND (
                permanently = true 
                OR 
                (expires IS NOT NULL AND expires > CURRENT_TIMESTAMP)
            )
            ORDER BY created_at DESC 
            LIMIT 1
        `;
        
        const result = await pool.query(query, [ip]);
        
        if (result.rows.length === 0) {
            return null;
        }

        const banRecord = result.rows[0];
        return {
            id: banRecord.id,
            username: banRecord.username,
            authoritative: banRecord.authoritative,
            user_id: banRecord.user_id,
            authoritative_id: banRecord.authoritative_id,
            expires: banRecord.expires,
            permanently: banRecord.permanently,
            ip_addr: banRecord.ip_addr,
            reason: banRecord.reason,
            created_at: banRecord.created_at
        };
    } catch (error) {
        apiLogger.error('Error checking IP ban:', error);
        throw error;
    }
}

export async function getBanInfo(userId: string, ip?: string): Promise<BanInfo | null> {
    const pool = getPostgresInstance();
    try {
        // Önce süresi dolmuş banları temizle
        const cleanupQuery = `
            DELETE FROM banned 
            WHERE user_id = $1 
            AND permanently = false 
            AND expires IS NOT NULL 
            AND expires <= CURRENT_TIMESTAMP
        `;
        await pool.query(cleanupQuery, [userId]);

        // Aktif ban kaydını kontrol et (hem kullanıcı hem IP için)
        const query = `
            SELECT * FROM banned 
            WHERE (user_id = $1 OR (ip_addr = $2 AND ip_addr != '0.0.0.0' AND ip_addr IS NOT NULL))
            AND (
                permanently = true 
                OR 
                (expires IS NOT NULL AND expires > CURRENT_TIMESTAMP)
            )
            ORDER BY created_at DESC 
            LIMIT 1
        `;
        
        const result = await pool.query(query, [userId, ip || null]);
        
        if (result.rows.length === 0) {
            return null;
        }

        // Ban kaydını döndür
        const banRecord = result.rows[0];
        return {
            id: banRecord.id,
            username: banRecord.username,
            authoritative: banRecord.authoritative,
            user_id: banRecord.user_id,
            authoritative_id: banRecord.authoritative_id,
            expires: banRecord.expires,
            permanently: banRecord.permanently,
            ip_addr: banRecord.ip_addr,
            reason: banRecord.reason,
            created_at: banRecord.created_at
        };
    } catch (error) {
        apiLogger.error('Error getting ban info:', error);
        throw error;
    }
}