import Redis from 'ioredis';
import { createLogger, LogLevel } from '../logger';

const logger = createLogger({
    logLevel: LogLevel.INFO,
    writeToFile: true,
    logFilePath: '../logs/redis.log',
    module: "Redis"
});

// Redis instance
let redisClient: Redis | null = null;

/**
 * Redis bağlantısını başlatır
 */
export async function initializeRedis(): Promise<void> {
    try {
        redisClient = new Redis({
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
            password: process.env.REDIS_PASSWORD || undefined,
            db: parseInt(process.env.REDIS_DATABASE || '0'),
            maxRetriesPerRequest: 3,
            connectTimeout: 10000,
            commandTimeout: 5000,
            lazyConnect: true,
        });

        // Event listeners
        redisClient.on('connect', () => {
            logger.info('Redis connected successfully');
        });

        redisClient.on('error', (error: Error) => {
            logger.error('Redis connection error:', error);
        });

        redisClient.on('ready', () => {
            logger.info('Redis ready for commands');
        });

        redisClient.on('close', () => {
            logger.warn('Redis connection closed');
        });

        redisClient.on('reconnecting', () => {
            logger.info('Redis reconnecting...');
        });

        // Bağlantıyı test et
        try {
            await redisClient.ping();
            logger.info('Redis connection test successful');
        } catch (error) {
            logger.warn('Redis connection test failed, will retry on first command');
        }

        logger.info('Redis client initialized');
    } catch (error) {
        logger.error('Failed to initialize Redis client:', error);
        throw error;
    }
}

/**
 * Redis instance'ını döndürür
 */
export function getRedisInstance(): Redis {
    if (!redisClient) {
        throw new Error('Redis not initialized. Call initializeRedis() first.');
    }
    return redisClient;
}

/**
 * Redis bağlantısını kapatır
 */
export async function closeRedis(): Promise<void> {
    if (redisClient) {
        await redisClient.quit();
        redisClient = null;
        logger.info('Redis connection closed');
    }
}

/**
 * Kullanıcının index değerini getirir
 * @param id - Kullanıcı ID'si
 * @returns Index değeri
 */
export async function getUserIndex(id: string | number): Promise<string | null> {
    try {
        const client = getRedisInstance();
        
        // TODO: Redis GET implementasyonu
        logger.debug(`getUserIndex called with id: ${id}`);
        
        // Placeholder return
        return null;
        
    } catch (error) {
        logger.error('Error in getUserIndex:', error);
        throw error;
    }
}

/**
 * Kullanıcının index değerini ayarlar
 * @param id - Kullanıcı ID'si
 * @param index - Index değeri
 * @returns İşlem başarı durumu
 */
export async function setUserIndex(id: string | number, index: string | number): Promise<boolean> {
    try {
        const client = getRedisInstance();
        
        // TODO: Redis SET implementasyonu
        logger.debug(`setUserIndex called with id: ${id}, index: ${index}`);
        
        // Placeholder return
        return false;
        
    } catch (error) {
        logger.error('Error in setUserIndex:', error);
        throw error;
    }
}

/**
 * Tüm kullanıcı index'lerini listeler
 * @returns Index listesi
 */
export async function listAllIndexes(): Promise<{ [key: string]: string }> {
    try {
        const client = getRedisInstance();
        
        // TODO: Redis KEYS ve MGET implementasyonu
        logger.debug('listAllIndexes called');
        
        // Placeholder return
        return {};
        
    } catch (error) {
        logger.error('Error in listAllIndexes:', error);
        throw error;
    }
}

/**
 * Redis bağlantısını test eder
 */
export async function testRedisConnection(): Promise<boolean> {
    try {
        const client = getRedisInstance();
        const result = await client.ping();
        logger.info('Redis connection test successful:', result);
        return result === 'PONG';
    } catch (error) {
        logger.error('Redis connection test failed:', error);
        return false;
    }
}

/**
 * Redis'te belirli bir pattern'e uygun anahtarları getirir
 * @param pattern - Arama deseni (örn: "user:*")
 * @returns Anahtar listesi
 */
export async function getKeysByPattern(pattern: string): Promise<string[]> {
    try {
        const client = getRedisInstance();
        
        // TODO: Redis KEYS implementasyonu
        logger.debug(`getKeysByPattern called with pattern: ${pattern}`);
        
        // Placeholder return
        return [];
        
    } catch (error) {
        logger.error('Error in getKeysByPattern:', error);
        throw error;
    }
}
