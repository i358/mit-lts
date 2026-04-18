import { getPostgresInstance } from './postgres';
import { apiLogger } from '../logger';

/**
 * 1 haftadan eski arşiv kayıtlarını silen fonksiyon
 */
export async function cleanupOldArchiveRecords(): Promise<number> {
    const pool = getPostgresInstance();
    try {
        // 7 gün öncesinin Unix timestamp'ini hesapla (saniye cinsinden)
        const oneWeekAgoTimestamp = Math.floor((Date.now() - (7 * 24 * 60 * 60 * 1000)) / 1000);
        
        const query = `
            DELETE FROM archive 
            WHERE action_timestamp < $1
            RETURNING id
        `;
        
        const result = await pool.query(query, [oneWeekAgoTimestamp]);
        const deletedCount = result.rowCount || 0;
        
        if (deletedCount > 0) {
            apiLogger.info(`Cleaned up ${deletedCount} archive records older than 7 days`);
        }
        return deletedCount;
    } catch (error) {
        apiLogger.error('Error cleaning up old archive records:', error);
        throw error;
    }
}

/**
 * Arşiv kaydını getirirken otomatik temizlik yapan fonksiyon
 */
export async function getArchiveRecordsWithCleanup(type: string = 'all') {
    const pool = getPostgresInstance();
    try {
        // Önce 1 haftadan eski kayıtları sil
        const oneWeekAgoTimestamp = Math.floor((Date.now() - (7 * 24 * 60 * 60 * 1000)) / 1000); // Unix timestamp (seconds)
        
        const deleteQuery = `
            DELETE FROM archive 
            WHERE action_timestamp < $1
        `;
        const deleteResult = await pool.query(deleteQuery, [oneWeekAgoTimestamp]);
        const deletedCount = deleteResult.rowCount || 0;
        if (deletedCount > 0) {
            apiLogger.info(`Cleaned up ${deletedCount} archive records older than 7 days`);
        }

        // Geriye kalan kayıtları getir
        let query = `SELECT * FROM archive`;
        const values: any[] = [];

        if (type !== 'all') {
            query += ` WHERE type = $1`;
            values.push(type);
        }

        query += ` ORDER BY action_timestamp DESC`;

        const result = await pool.query(query, values);
        return result.rows;
    } catch (error) {
        apiLogger.error('Error in getArchiveRecordsWithCleanup:', error);
        throw error;
    }
}
