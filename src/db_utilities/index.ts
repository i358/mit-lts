/**
 * Database Utilities - Global Instance Manager
 * PostgreSQL ve Redis bağlantılarını yönetir
 */

import { initializePostgres, closePostgres, testConnection as testPostgresConnection } from './postgres';
import { initializeRedis, closeRedis, testRedisConnection } from './redis';
import { createLogger, LogLevel } from '../logger';

const logger = createLogger({
    logLevel: LogLevel.INFO,
    writeToFile: true,
    logFilePath: '../logs/db_utilities.log',
    module: "DB_Utilities"
});

// Global initialization state
let isInitialized = false;

/**
 * Tüm veritabanı bağlantılarını başlatır
 */
export async function initializeDatabases(): Promise<void> {
    if (isInitialized) {
        logger.warn('Databases already initialized');
        return;
    }

    try {
        logger.info('Initializing database connections...');
        
        // PostgreSQL bağlantısını başlat
        await initializePostgres();
        logger.info('PostgreSQL initialized');
        
        // Redis bağlantısını başlat
        await initializeRedis();
        logger.info('Redis initialized');
        
        // Bağlantıları test et
        const postgresOk = await testPostgresConnection();
        const redisOk = await testRedisConnection();
        
        if (!postgresOk) {
            throw new Error('PostgreSQL connection test failed');
        }
        
        if (!redisOk) {
            throw new Error('Redis connection test failed');
        }
        
        isInitialized = true;
        logger.info('All database connections initialized successfully');
    } catch (error) {
        logger.error('Failed to initialize databases:', error);
        throw error;
    }
}

/**
 * Tüm veritabanı bağlantılarını kapatır
 */
export async function closeDatabases(): Promise<void> {
    if (!isInitialized) {
        logger.warn('Databases not initialized');
        return;
    }

    try {
        logger.info('Closing database connections...');
        
        // PostgreSQL bağlantısını kapat
        await closePostgres();
        logger.info('PostgreSQL connection closed');
        
        // Redis bağlantısını kapat
        await closeRedis();
        logger.info('Redis connection closed');
        
        isInitialized = false;
        logger.info('All database connections closed successfully');
        
    } catch (error) {
        logger.error('Error closing database connections:', error);
        throw error;
    }
}

/**
 * Veritabanı bağlantılarının durumunu kontrol eder
 */
export async function checkDatabaseHealth(): Promise<{
    postgres: boolean;
    redis: boolean;
    overall: boolean;
}> {
    try {
        const postgresOk = await testPostgresConnection();
        const redisOk = await testRedisConnection();
        
        const health = {
            postgres: postgresOk,
            redis: redisOk,
            overall: postgresOk && redisOk
        };
        
        logger.debug('Database health check:', health);
        return health;
        
    } catch (error) {
        logger.error('Error checking database health:', error);
        return {
            postgres: false,
            redis: false,
            overall: false
        };
    }
}

/**
 * Veritabanlarının başlatılıp başlatılmadığını kontrol eder
 */
export function isDatabasesInitialized(): boolean {
    return isInitialized;
}

// Re-export all database functions for convenience
export {
    // PostgreSQL functions
    getUser,
    updateUser,
    createUser,
    createOrGetUser,
    clearAllUsers,
    deleteUser,
    getAllUsers,
    getAllUserTimes,
    getPostgresInstance,
    createTimeTable,
    updateUserTime,
    getUserTime,
    resetAllUserTimes,
    updateDailyUserTime,
    getDailyUserTime,
    resetAllDailyUserTimes,
    incrementWeeklyTime,
    getWeeklyTimeData,
    // Announcements
    createAnnouncementsTable,
    createAnnouncement,
    getAnnouncement,
    getAllAnnouncements,
    updateAnnouncement,
    deleteAnnouncement,
    toggleAnnouncementActive
} from './postgres';

// Announcements utilities
export {
    publishAnnouncement,
    getActiveAnnouncements,
    deactivateAnnouncement,
    removeAnnouncement,
    editAnnouncement,
    truncateDescription,
    getTypeName,
    getSubTypeName,
    getSubtypesForType,
    getLatestAnnouncements,
    getAnnouncementsByType,
    getAnnouncementDetails,
    ANNOUNCEMENT_TYPES
} from './announcements';

// OAuth functions
export {
    getOAuthUsername
} from './oauth';

export {
    // Redis functions
    getUserIndex,
    setUserIndex,
    listAllIndexes,
    getRedisInstance,
    getKeysByPattern
} from './redis';
