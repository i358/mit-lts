import { Pool } from 'pg';
import { createLogger, LogLevel } from '../logger';
import { getPostgresInstance } from './postgres';

const logger = createLogger({
    logLevel: LogLevel.DEBUG,
    writeToFile: true,
    logFilePath: '../logs/work_time.log',
    module: "WorkTime"
});

// Work Time tablosunu oluştur
export async function createWorkTimeTable(): Promise<void> {
    try {
        const pool = getPostgresInstance();
        
        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS work_time (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                habbo_id INTEGER NOT NULL,
                total_time BIGINT DEFAULT 0,
                last_reset TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT work_time_unique_habbo UNIQUE (habbo_id)
            );
            CREATE INDEX IF NOT EXISTS idx_work_time_habbo_id ON work_time (habbo_id);
        `;
        
        await pool.query(createTableQuery);
        logger.info('Work time table created/verified successfully');

    } catch (error) {
        logger.error('Error creating work time table:', error);
        throw error;
    }
}

// Kullanıcının çalışma süresini getir
export async function getUserWorkTime(userId: number): Promise<number> {
    try {
        const pool = getPostgresInstance();
        
        // Önce tablo varlığını kontrol et ve yoksa oluştur
        await createWorkTimeTable();
        
        const query = 'SELECT total_time FROM work_time WHERE habbo_id = $1';
        const result = await pool.query(query, [userId]);
        
        if (result.rows.length > 0) {
            return parseInt(result.rows[0].total_time);
        }
        
        // Kullanıcı kaydı yoksa oluştur
        await pool.query(
            'INSERT INTO work_time (user_id, habbo_id, total_time) VALUES ($1, $1, 0)',
            [userId]
        );
        
        return 0;
    } catch (error) {
        logger.error('Error getting user work time:', error);
        throw error;
    }
}

// Kullanıcının çalışma süresini güncelle
export async function updateUserWorkTime(userId: number, time: number): Promise<void> {
    try {
        const pool = getPostgresInstance();
        
        // Önce tablo varlığını kontrol et ve yoksa oluştur
        await createWorkTimeTable();
        
        // Önce kullanıcının kaydı var mı kontrol et
        const checkQuery = 'SELECT total_time FROM work_time WHERE habbo_id = $1';
        const checkResult = await pool.query(checkQuery, [userId]);
        
        if (checkResult.rows.length > 0) {
            // Kayıt varsa mevcut süreye ekle
            const currentTime = parseInt(checkResult.rows[0].total_time) || 0;
            const newTime = currentTime + time;
            
            const updateQuery = `
                UPDATE work_time 
                SET total_time = $2, 
                    last_reset = CURRENT_TIMESTAMP
                WHERE habbo_id = $1
            `;
            await pool.query(updateQuery, [userId, newTime]);
            logger.info(`Updated work time for user ${userId}: ${currentTime}ms -> ${newTime}ms (+${time}ms)`);
        } else {
            // Kayıt yoksa yeni ekle
            const insertQuery = `
                INSERT INTO work_time (user_id, habbo_id, total_time, last_reset)
                VALUES ($1, $1, $2, CURRENT_TIMESTAMP)
            `;
            await pool.query(insertQuery, [userId, time]);
            logger.info(`Created work time for user ${userId}: ${time}ms`);
        }
        
    } catch (error) {
        logger.error('Error updating user work time:', error);
        throw error;
    }
}

// Kullanıcının çalışma süresini sıfırla
export async function resetUserWorkTime(userId: number): Promise<void> {
    try {
        const pool = getPostgresInstance();
        
        // Önce tablo varlığını kontrol et ve yoksa oluştur
        await createWorkTimeTable();
        
        const query = `
            UPDATE work_time 
            SET total_time = 0, last_reset = CURRENT_TIMESTAMP
            WHERE habbo_id = $1
        `;
        
        await pool.query(query, [userId]);
        logger.info(`Reset work time for user ${userId}`);
        
    } catch (error) {
        logger.error('Error resetting user work time:', error);
        throw error;
    }
}

// Tüm kullanıcıların çalışma sürelerini sıfırla
export async function resetAllWorkTimes(): Promise<void> {
    try {
        const pool = getPostgresInstance();
        
        // Önce tablo varlığını kontrol et ve yoksa oluştur
        await createWorkTimeTable();
        
        const query = 'DELETE FROM work_time';
        
        await pool.query(query);
        logger.info('Cleared all work time records');
        
    } catch (error) {
        logger.error('Error resetting all work times:', error);
        throw error;
    }
}

// Kullanıcının çalışma süresini ayarla
export async function setUserWorkTime(userId: number, time: number): Promise<void> {
    try {
        const pool = getPostgresInstance();
        
        // Önce tablo varlığını kontrol et ve yoksa oluştur
        await createWorkTimeTable();
        
        const query = `
            INSERT INTO work_time (user_id, habbo_id, total_time, last_reset)
            VALUES ($1, $1, $2, CURRENT_TIMESTAMP)
            ON CONFLICT (habbo_id) DO UPDATE
            SET total_time = $2, last_reset = CURRENT_TIMESTAMP
        `;
        
        await pool.query(query, [userId, time]);
        logger.info(`Set work time for user ${userId} to ${time}ms`);
        
    } catch (error) {
        logger.error('Error setting user work time:', error);
        throw error;
    }
}