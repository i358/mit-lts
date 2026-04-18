import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";
import { randomUUID } from "node:crypto";
import { Pool } from 'pg';
import { createLogger, LogLevel } from '../logger';
import { create } from "domain";

interface BadgeData {
    id: number;
    ranks: string[];
    duration: number;
}

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const logger = createLogger({
    logLevel: LogLevel.DEBUG,
    writeToFile: true,
    logFilePath: '../logs/postgres.log',
    module: "PostgreSQL"
});

// PostgreSQL bağlantı havuzu
let postgresPool: Pool | null = null;

/**
 * PostgreSQL bağlantısını başlatır
 */
export async function initializePostgres(): Promise<void> {
    try { 
        postgresPool = new Pool({
            host: process.env.POSTGRES_HOST,
            port: parseInt(process.env.POSTGRES_PORT || '5432'),
            database: process.env.POSTGRES_DATABASE,
            user: process.env.POSTGRES_USERNAME,
            password: process.env.POSTGRES_PASSWORD,
            max: 20, // Maksimum bağlantı sayısı
            idleTimeoutMillis: 30000,
            ssl: false,
            connectionTimeoutMillis: 2000,
        });

        logger.info('PostgreSQL connection pool initialized');
    } catch (error) {
        logger.error('Failed to initialize PostgreSQL connection:', error);
        throw error;
    }
}

/**
 * PostgreSQL instance'ını döndürür
 */
export function getPostgresInstance(): Pool {
    if (!postgresPool) {
        throw new Error('PostgreSQL not initialized. Call initializePostgres() first.');
    }
    return postgresPool;
}

/**
 * PostgreSQL bağlantısını kapatır
 */
export async function closePostgres(): Promise<void> {
    if (postgresPool) {
        await postgresPool.end();
        postgresPool = null;
        logger.info('PostgreSQL connection pool closed');
    }
}

// User Interface - Stack tablosu için
interface StackUser {
    id?: number;
    username?: string;
    figure?: string;
    motto?: string;
    look?: string;
    index?: number;
    last_seen?: Date;
    [key: string]: any; // Diğer alanlar için esnek yapı
}

// Fonksiyon parametreleri için tipler
interface GetUserParams {
    in: "id" | "username" | "habbo_id" | string;
    value: string | number;
    out: "all" | "username" | "id" | string; // Specific column names de kabul et
}

interface UpdateUserParams {
    where: { [key: string]: any }; // WHERE koşulları
    data: { [key: string]: any };  // Güncellenecek veriler
}

interface CreateUserParams {
    data: { [key: string]: any }; // Tamamen esnek veri yapısı
}

/**
 * Stack tablosundan kullanıcı bilgilerini getirir
 * @param params - Arama parametreleri ve çıktı formatı
 * @returns Kullanıcı bilgileri
 */

// USERS TABLOSU (kalıcı)
export async function createUsersTable(): Promise<void> {
    const pool = getPostgresInstance();
    try {
        // Create the table if it doesn't exist
        const createQuery = `
            CREATE TABLE IF NOT EXISTS users (
                id BIGINT PRIMARY KEY,
                username TEXT NOT NULL,
                habbo_id BIGINT,
                secret TEXT,
                ttl TEXT,
                avatar TEXT,
                badge INT,
                rank INT,
                salary BIGINT,
                coins INTEGER DEFAULT 100,
                bitflags BIGINT DEFAULT 0,
                user_flags BIGINT DEFAULT 0,
                ip_addr TEXT,
                extras TEXT[] DEFAULT ARRAY[]::TEXT[],
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users (username);
            CREATE INDEX IF NOT EXISTS idx_users_habbo_id ON users (habbo_id);
        `;
        await pool.query(createQuery);

        // Check if coins column exists
        const checkQuery = `
            SELECT EXISTS (
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='users' AND column_name='coins'
            );
        `;
        const result = await pool.query(checkQuery);
        
        if (!result.rows[0].exists) {
            logger.info('Adding coins column to users table');
            // Add coins column with default value
            const alterQuery = `
                ALTER TABLE users 
                ADD COLUMN coins INTEGER DEFAULT 100;
            `;
            await pool.query(alterQuery);
            logger.info('Coins column added successfully');
        }

        // Check if ttl column exists
        const ttlCheckQuery = `
            SELECT EXISTS (
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='users' AND column_name='ttl'
            );
        `;
        const ttlResult = await pool.query(ttlCheckQuery);

        if (!ttlResult.rows[0].exists) {
            logger.info('Adding ttl column to users table');
            const alterQuery = `
                ALTER TABLE users
                ADD COLUMN ttl TEXT;
            `;
            await pool.query(alterQuery);
            logger.info('ttl column added successfully');
        }
    } catch (error) {
        logger.error('Error creating/updating users table:', error);
        throw error;
    }
}

// USERS CRUD
export interface UsersGetParams {
    in: "id" | "username" | "habbo_id";
    value: string | number | bigint;
    out?: "all" | keyof UserRow;
}

// Ensure coins column exists
export async function ensureCoinsColumn(): Promise<void> {
    const pool = getPostgresInstance();
    try {
        // Check if coins column exists
        const checkQuery = `
            SELECT EXISTS (
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='users' AND column_name='coins'
            );
        `;
        const result = await pool.query(checkQuery);
        
        if (!result.rows[0].exists) {
            logger.info('Adding coins column to users table');
            // Add coins column with default value
            const alterQuery = `
                ALTER TABLE users 
                ADD COLUMN coins INTEGER DEFAULT 100;
            `;
            await pool.query(alterQuery);
            logger.info('Coins column added successfully');
        }
    } catch (error) {
        logger.error('Error ensuring coins column:', error);
        throw error;
    }
}

export interface UserRow {
    id: string;  // Changed from number to string to preserve precision
    username: string;
    motto: string;
    habbo_id: number;
    secret: string;
    ttl?: string;
    avatar: string;
    badge: number;
    rank: number;
    salary: bigint;
    coins: number;
    bitflags: number;
    user_flags: BigInt;
    ip_addr?: string;
    created_at: string;
}

export interface BadgeInfo {
    badge: number;
    rank: number;
    badgeName: string | null;
    rankName: string | null;
}

export async function createUserRow(data: Partial<UserRow>): Promise<number | null> {
    const pool = getPostgresInstance();
    try {
        // Önce users tablosunun varlığını kontrol et
        const tableCheck = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'users'
            );
        `);
        
        logger.debug('Table check result:', {
            exists: tableCheck.rows[0].exists,
            query: 'SELECT EXISTS FROM information_schema.tables'
        });

        if (!tableCheck.rows[0].exists) {
            logger.warn('Users table does not exist, creating it now');
            await createUsersTable();
            logger.info('Users table created successfully');
        }

        // Query oluştur ve logla
        const columns = Object.keys(data).join(", ");
        const placeholders = Object.keys(data).map((_, i) => `$${i + 1}`).join(", ");
        const values = Object.values(data);
        const query = `INSERT INTO users (${columns}) VALUES (${placeholders}) RETURNING id`;

        // Convert BigInt values to strings for logging
        const loggableData = Object.entries(data).reduce((acc, [key, value]) => {
            if (typeof value === 'bigint') {
                acc[key] = value.toString();
            } else if (key === 'secret' && typeof value === 'string') {
                acc[key] = `${value.substring(0, 32)}...`; // Sadece IV'yi göster
            } else {
                acc[key] = value;
            }
            return acc;
        }, {} as Record<string, any>);

        logger.debug('Creating user with query:', {
            query,
            columns,
            valuesLength: values.length,
            data: loggableData
        });

        // Query'i çalıştır
        const result = await pool.query(query, values);
        
        if (result.rows.length === 0) {
            logger.error('Insert succeeded but no ID returned');
            throw new Error('Insert succeeded but no ID returned');
        }

        logger.info('User created successfully:', {
            userId: typeof result.rows[0].id === 'bigint' ? result.rows[0].id.toString() : result.rows[0].id,
            username: data.username
        });

        return result.rows[0].id;
    } catch (error: any) {
        logger.error('Error in createUserRow:', {
            error: error.message,
            code: error.code,
            detail: error.detail,
            hint: error.hint,
            where: error.where,
            schema: error.schema,
            table: error.table,
            column: error.column,
            dataType: error.dataType,
            constraint: error.constraint,
            stack: error.stack
        });
        throw error;
    }
}

export async function getAdvanceCoins(userId: number): Promise<number> {
    try {
        const pool = getPostgresInstance();
        
        // Get current coins
        const query = 'SELECT coins FROM users WHERE id = $1';
        const result = await pool.query(query, [userId]);
        
        if (result.rows.length === 0) return 0; // User not found
        
        const currentCoins = result.rows[0].coins || 0;
        
        // If user has 0 or negative coins, give them 50 coins advance
        if (currentCoins <= 0) {
            return 50;
        }
        
        return currentCoins;
    } catch (error) {
        logger.error('Error getting advance coins:', error);
        throw error;
    }
}

export async function getUserRow(params: UsersGetParams): Promise<UserRow | any | null> {
    const pool = getPostgresInstance();
    const { in: field, value, out = "all" } = params;
    
    // SECURITY FIX: Whitelist allowed columns to prevent SQL injection
    const allowedColumns = [
        'id', 'username', 'habbo_id', 'secret', 'avatar', 'badge', 'rank', 
        'salary', 'coins', 'bitflags', 'user_flags', 'ip_addr', 'created_at',
        'username,habbo_id', 'username,badge,rank', 'id,username,badge,rank,user_flags',
        'id,username,badge,rank,bitflags,user_flags'
    ];
    
    const selectClause = out === "all" ? "*" : (allowedColumns.includes(out) ? out : "all");
    
    logger.info('getUserRow called with params:', { 
        field, 
        value,
        valueType: typeof value,
        valueLength: value.toString().length, 
        out,
        selectClause
    });

    try {
        // First check if the users table exists
        const tableCheck = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'users'
            );
        `);
        
        logger.debug('Table check result:', {
            exists: tableCheck.rows[0].exists,
            query: 'SELECT EXISTS FROM information_schema.tables'
        });

        if (!tableCheck.rows[0].exists) {
            logger.warn('Users table does not exist, creating it now');
            await createUsersTable();
            logger.info('Users table created successfully');
        }

        let query;
        if (field === "username") {
            query = `SELECT ${selectClause} FROM users WHERE username ILIKE $1 LIMIT 1`;
        } else if (field === "habbo_id") {
            query = `SELECT ${selectClause} FROM users WHERE habbo_id = $1::bigint LIMIT 1`;
        } else {
            query = `SELECT ${selectClause} FROM users WHERE id = $1::bigint LIMIT 1`;
        }

        logger.debug('Executing query:', { 
            query, 
            value,
            valueType: typeof value,
            field,
            fieldType: typeof field
        });
        
        const result = await pool.query(query, [value]);
        
        logger.debug('Query result:', { 
            rowCount: result.rowCount,
            hasRows: result.rows.length > 0,
            firstRow: result.rows[0],
            sql: result.command
        });

        if (result.rows.length === 0) {
            logger.info('No user found with given criteria');
            return null;
        }

        const returnValue = out === "all" ? result.rows[0] : result.rows[0][out];
        logger.debug('Returning value:', returnValue);
        
        return returnValue;

    } catch (error) {
        logger.error('Error in getUserRow:', {
            error,
            params,
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : 'No stack trace'
        });
        throw error;
    }
}

export async function updateUserRowIfCurrent(
    id: string | number | bigint,
    expected: { badge: number; rank: number },
    data: Partial<UserRow>
): Promise<boolean> {
    const pool = getPostgresInstance();

    const allowedUpdateColumns = new Set([
        'badge',
        'rank',
        'bitflags',
        'salary',
        'coins',
        'user_flags',
        'ttl',
        'avatar',
        'motto',
        'ip_addr',
        'extras',
        'secret',
        'habbo_id',
        'username'
    ]);

    const entries = Object.entries(data).filter(
        ([key, value]) => allowedUpdateColumns.has(key) && value !== undefined
    );

    if (entries.length === 0) {
        return false;
    }

    const setClause = entries
        .map(([key], i) => `${key} = $${i + 1}`)
        .join(', ');
    const values = entries.map(([, value]) => value);

    const query = `
        UPDATE users
        SET ${setClause}
        WHERE id = $${values.length + 1}::bigint
          AND badge = $${values.length + 2}
          AND rank = $${values.length + 3}
    `;

    const result = await pool.query(query, [...values, id, expected.badge, expected.rank]);
    return (result.rowCount ?? 0) === 1;
}

export async function updateUserRow(id: number, data: Partial<UserRow>): Promise<boolean> {
    const pool = getPostgresInstance();
    const setClause = Object.keys(data).map((key, i) => `${key} = $${i + 1}`).join(", ");
    const values = Object.values(data);
    const query = `UPDATE users SET ${setClause} WHERE id = $${values.length + 1}`;
    const result = await pool.query(query, [...values, id]);
    return (result.rowCount ?? 0) > 0;
}

export async function updateUserCoins(userId: number, amount: number): Promise<boolean> {
    try {
        const pool = getPostgresInstance();
        
        // First ensure the table and column exist
        await createUsersTable();
        
        // Get current coins
        const currentCoinsQuery = `SELECT coins FROM users WHERE id = $1`;
        const currentCoinsResult = await pool.query(currentCoinsQuery, [userId]);
        
        if (currentCoinsResult.rows.length === 0) {
            return false; // User not found
        }

        const currentCoins = currentCoinsResult.rows[0].coins || 0;
        let finalAmount = amount;

        // If user is in debt and going more negative, apply debt interest
        if (currentCoins < 0 && amount < 0) {
            const debtInterest = 0.1; // 10% interest on new debt
            finalAmount = Math.floor(amount * (1 + debtInterest));
            logger.info(`Applied debt interest: Original amount: ${amount}, With interest: ${finalAmount}`);
        }

        const newCoins = currentCoins + finalAmount;

        // Update coins
        const updateQuery = `UPDATE users SET coins = $1 WHERE id = $2`;
        const result = await pool.query(updateQuery, [newCoins, userId]);
        
        logger.debug('Updated user coins:', {
            userId,
            oldCoins: currentCoins,
            change: amount,
            newCoins
        });
        
        return result.rowCount === 1;
    } catch (error) {
        logger.error('Error updating user coins:', error);
        throw error; // Re-throw to see the full error in logs
    }
}

export async function updateUserSecret(userId: string, newSecret: string): Promise<boolean> {
    try {
        const pool = getPostgresInstance();
        const query = `UPDATE users SET secret = $1 WHERE id = $2`;
        const result = await pool.query(query, [newSecret, userId]);
        
        logger.debug('Updated user secret:', {
            userId,
            secretLength: newSecret.length
        });
        
        return result.rowCount === 1;
    } catch (error) {
        logger.error('Error updating user secret:', error);
        throw error;
    }
}

export async function updateUserTTL(userId: string, ttl: string | null): Promise<boolean> {
    try {
        const pool = getPostgresInstance();
        const query = `UPDATE users SET ttl = $1 WHERE id = $2`;
        const result = await pool.query(query, [ttl, userId]);

        logger.debug('Updated user ttl:', {
            userId,
            ttl
        });

        return result.rowCount === 1;
    } catch (error) {
        logger.error('Error updating user ttl:', error);
        throw error;
    }
}

export async function deleteUserRow(id: number): Promise<boolean> {
    const pool = getPostgresInstance();
    const query = `DELETE FROM users WHERE id = $1`;
    const result = await pool.query(query, [id]);
    return (result.rowCount ?? 0) > 0;
}

// Badge ve Rank CRUD işlemleri
export async function updateUserBadge(userId: number, badge: number, rank: number, bitflags: number = 0): Promise<boolean> {
    try {
        const pool = getPostgresInstance();
        const query = `
            UPDATE users 
            SET badge = $1, rank = $2, bitflags = $4
            WHERE id = $3
        `;
        
        logger.debug('Executing updateUserBadge query:', {
            userId,
            badge,
            rank,
            bitflags,
            query
        });

        const result = await pool.query(query, [badge, rank, userId, bitflags]);
        
        const success = result.rowCount === 1;
        if (!success) {
            logger.warn('User badge update failed:', {
                userId,
                badge,
                rank,
                bitflags,
                rowCount: result.rowCount
            });
        } else {
            logger.info('User badge updated successfully:', {
                userId,
                badge,
                rank,
                bitflags
            });
        }
        
        return success;
    } catch (error) {
        logger.error('Error updating user badge:', {
            error,
            userId,
            badge,
            rank,
            bitflags
        });
        return false;
    }
}

async function getBadgeDetails(badge: number, rank: number): Promise<BadgeInfo> {
    try {
        const badgesPath = path.join(__dirname, '..', '..', 'cache', 'badges.json');
        const badgesData = JSON.parse(fs.readFileSync(badgesPath, 'utf8'));
        
        logger.debug('Processing badge data:', {
            badgesDataLength: Object.keys(badgesData).length,
            availableBadges: Object.keys(badgesData)
        });

        // If badge is 0, return early with "No Badge" indication
        if (badge === 0) {
            logger.debug('Badge is 0, returning no badge status');
            return {
                badge: 0,
                rank: 0,
                badgeName: "No Badge",
                rankName: "No Rank"
            };
        }

        // Otherwise look up the badge (1-based index)
        const badgeEntries = Object.entries(badgesData);
        const badgeEntry = badgeEntries[badge - 1];
        logger.debug('Looking up badge:', { 
            badge,
            badgeIndex: badge - 1,
            totalBadges: badgeEntries.length,
            foundEntry: !!badgeEntry,
            badgeEntries: badgeEntries.slice(0, 5).map(entry => entry[0]),
            entryDetails: badgeEntry ? {
                name: badgeEntry[0],
                ranks: (badgeEntry[1] as BadgeData).ranks,
                rankToFind: rank - 1,
                rankName: (badgeEntry[1] as BadgeData).ranks[rank - 1]
            } : null
        });

        if (!badgeEntry) {
            logger.warn('Invalid badge index:', { 
                badge,
                maxBadgeIndex: badgeEntries.length 
            });
            return {
                badge,
                rank,
                badgeName: "Invalid Badge",
                rankName: null
            };
        }

        const [badgeName, badgeData] = badgeEntry as [string, BadgeData];
        logger.debug('Found badge entry:', { 
            badgeName, 
            ranks: badgeData.ranks,
            requestedRank: rank
        });

        const rankName = badgeData.ranks[rank - 1] || null;
        logger.debug('Final badge info:', {
            badgeName,
            rankName,
            originalRank: rank,
            rankIndex: rank - 1,
            availableRanks: badgeData.ranks
        });

        return {
            badge,
            rank,
            badgeName,
            rankName
        };
    } catch (error) {
        logger.error('Error getting badge details:', error);
        return {
            badge,
            rank,
            badgeName: null,
            rankName: null
        };
    }
}

export async function getUserBadgeInfo(userId: number | bigint): Promise<BadgeInfo> {
    try {
        const pool = getPostgresInstance();
        logger.debug('Getting badge info for user:', { 
            userId,
            idType: typeof userId,
            idLength: userId.toString().length
        });

        // İlk olarak habbo_id ile dene (en yüksek badge'i al)
        let query = `SELECT badge, rank FROM users WHERE habbo_id = $1::bigint ORDER BY badge DESC LIMIT 1`;
        logger.debug('Trying habbo_id query:', { query, userId });
        let result = await pool.query(query, [userId]);

        // Bulunamazsa normal id ile dene (en yüksek badge'i al)
        if (result.rows.length === 0) {
            query = `SELECT badge, rank FROM users WHERE id = $1::bigint ORDER BY badge DESC LIMIT 1`;
            logger.debug('Trying normal id query:', { query, userId });
            result = await pool.query(query, [userId]);
        }

        // Kullanıcı bulunamadıysa varsayılan badge bilgisini döndür
        if (result.rows.length === 0) {
            logger.debug('No user found, returning default badge info');
            return {
                badge: 0,
                rank: 0,
                badgeName: null,
                rankName: null,
            };
        }
        
        logger.debug('Query result:', { 
            rowCount: result.rowCount, 
            rows: result.rows,
            firstRow: result.rows[0] 
        });

        if (result.rows.length === 0) {
            logger.debug('No user found, returning default badge info');
            return {
                badge: 0,
                rank: 0,
                badgeName: null,
                rankName: null
            };
        }

        const { badge, rank } = result.rows[0];
        logger.debug('Retrieved badge and rank:', { badge, rank });
        
        const badgeDetails = await getBadgeDetails(badge, rank);
        return badgeDetails;
    } catch (error) {
        logger.error('Error getting user badge info:', error);
        return {
            badge: 0,
            rank: 0,
            badgeName: null,
            rankName: null
        };
    }
}

export async function getAllUserRows(): Promise<UserRow[]> {
    const pool = getPostgresInstance();
    const query = `SELECT * FROM users ORDER BY id DESC`;
    const result = await pool.query(query);
    return result.rows;
}
export async function getUser(params: GetUserParams): Promise<any> {
    const { in: searchField, value, out } = params;
    
    try {
        const pool = getPostgresInstance();
        
        // SQL sorgusu oluştur
        let query: string;
        let queryParams: any[] = [value];
        
        if (out === "all") {
            query = searchField === "username"
                ? `SELECT * FROM stack WHERE ${searchField} ILIKE $1 LIMIT 1`
                : `SELECT * FROM stack WHERE ${searchField} = $1 LIMIT 1`;
        } else if (out === "id" || out === "username") {
            query = searchField === "username"
                ? `SELECT ${out} FROM stack WHERE ${searchField} ILIKE $1 LIMIT 1`
                : `SELECT ${out} FROM stack WHERE ${searchField} = $1 LIMIT 1`;
        } else {
            // Özel column name
            query = searchField === "username"
                ? `SELECT ${out} FROM stack WHERE ${searchField} ILIKE $1 LIMIT 1`
                : `SELECT ${out} FROM stack WHERE ${searchField} = $1 LIMIT 1`;
        }
        
        logger.debug(`Executing query: ${query} with params:`, queryParams);
        
        const result = await pool.query(query, queryParams);
        
        if (result.rows.length === 0) {
            logger.debug(`No user found with ${searchField} = ${value}`);
            return null;
        }
        
        const userData = result.rows[0];
        logger.debug(`User found:`, userData);
        
        if (out === "all") {
            return userData;
        } else {
            return userData[out];
        }
        
    } catch (error) {
        logger.error('Error in getUser:', error);
        throw error;
    }
}

/**
 * Stack tablosunda kullanıcı bilgilerini günceller
 * @param params - Güncelleme parametreleri
 * @returns Güncelleme sonucu
 */
export async function updateUser(params: UpdateUserParams): Promise<boolean> {
    const { where, data } = params;
    
    try {
        const pool = getPostgresInstance();
        
        // SET clause oluştur
        const setClause = Object.keys(data).map((key, index) => `${key} = $${index + 1}`).join(', ');
        const setValues = Object.values(data);
        
        // WHERE clause oluştur
        const whereClause = Object.keys(where).map((key, index) => `${key} = $${index + setValues.length + 1}`).join(' AND ');
        const whereValues = Object.values(where);
        
        // Final query
        const query = `UPDATE stack SET ${setClause} WHERE ${whereClause}`;
        const queryParams = [...setValues, ...whereValues];
        
        logger.debug(`Executing update query: ${query} with params:`, queryParams);
        
        const result = await pool.query(query, queryParams);
        
        const success = result.rowCount !== null && result.rowCount > 0;
        logger.debug(`Update result: ${result.rowCount} rows affected`);
        
        return success;
        
    } catch (error) {
        logger.error('Error in updateUser:', error);
        throw error;
    }
}

/**
 * Stack tablosuna geçici kullanıcı oluşturur (odadaki kullanıcılar için)
 * @param params - Kullanıcı verileri
 * @returns Oluşturulan kullanıcının ID'si
 */
export async function createUser(params: CreateUserParams): Promise<number | null> {
    const { data } = params;
    
    try {
        const pool = getPostgresInstance();
        
        // Önce kullanıcının stack'te var olup olmadığını kontrol et
        let existingUser = null;
        
        if (data.username) {
            logger.debug(`Checking if user with username '${data.username}' exists in stack`);
            existingUser = await getUser({
                in: 'username',
                value: data.username,
                out: 'id'
            });
        } else if (data.id) {
            logger.debug(`Checking if user with id '${data.id}' exists in stack`);
            existingUser = await getUser({
                in: 'id',
                value: data.id,
                out: 'id'
            });
        }
        
        // Eğer kullanıcı zaten stack'te varsa, mevcut ID'yi döndür
        if (existingUser) {
            logger.info(`User already exists in stack, ID: ${existingUser}`);
            return existingUser;
        }
        
        // Stack'te yoksa yeni oluştur
        logger.debug('User does not exist in stack, creating temporary user');
        
        // INSERT query oluştur
        const columns = Object.keys(data).join(', ');
        const placeholders = Object.keys(data).map((_, index) => `$${index + 1}`).join(', ');
        const values = Object.values(data);
        
        const query = `INSERT INTO stack (${columns}) VALUES (${placeholders}) RETURNING id`;
        
        logger.debug(`Executing insert query for stack: ${query} with params:`, values);
        
        const result = await pool.query(query, values);
        
        if (result.rows.length > 0) {
            const insertedId = result.rows[0].id;
            logger.info(`New temporary user created in stack with ID: ${insertedId}`);
            return insertedId;
        } else {
            logger.warn('Insert query executed but no ID returned');
            return null;
        }
        
    } catch (error) {
        logger.error('Error in createUser (stack):', error);
        throw error;
    }
}

/**
 * Stack tablosundaki tüm kullanıcıları siler
 * @returns Silinen kayıt sayısı
 */
export async function clearAllUsers(): Promise<number> {
    try {
        const pool = getPostgresInstance();
        
        logger.debug('Clearing all users from stack table');
        const result = await pool.query('DELETE FROM stack');
        
        const deletedCount = result.rowCount || 0;
        logger.info(`Cleared ${deletedCount} users from stack table`);
        
        return deletedCount;
        
    } catch (error) {
        logger.error('Error in clearAllUsers:', error);
        throw error;
    }
}

/**
 * Stack tablosundan belirtilen kriterlere göre kullanıcı siler
 * @param params - Silme kriterleri
 * @returns Silinen kayıt sayısı
 */
export async function deleteUser(params: { 
    by: 'id' | 'username' | 'index';
    value: string | number;
}): Promise<number> {
    const { by, value } = params;
    
    try {
        const pool = getPostgresInstance();
        
        logger.debug(`Deleting user with ${by} = ${value}`);
        
        const query = `DELETE FROM stack WHERE ${by} = $1`;
        const result = await pool.query(query, [value]);
        
        const deletedCount = result.rowCount || 0;
        logger.info(`Deleted ${deletedCount} user(s) with ${by} = ${value}`);
        
        return deletedCount;
        
    } catch (error) {
        logger.error('Error in deleteUser:', error);
        throw error;
    }
}

/**
 * Stack tablosundaki tüm kullanıcıları getirir
 * @returns Kullanıcı listesi
 */
export async function getAllUsers(): Promise<any[]> {
    try {
        const pool = getPostgresInstance();
        
        logger.debug('Getting all users from stack table');
        const result = await pool.query('SELECT * FROM stack ORDER BY last_seen DESC');
        
        const users = result.rows || [];
        logger.info(`Retrieved ${users.length} users from database`);
        
        return users;
        
    } catch (error) {
        logger.error('Error in getAllUsers:', error);
        throw error;
    }
}

/**
 * Veritabanı bağlantısını test eder
 */
export async function testConnection(): Promise<boolean> {
    try {
        const pool = getPostgresInstance();
        const result = await pool.query('SELECT 1 as test');
        logger.info('PostgreSQL connection test successful');
        return true;
    } catch (error) {
        logger.error('PostgreSQL connection test failed:', error);
        return false;
    }
}

/**
 * Kullanıcıyı bulur, yoksa oluşturur (UPSERT benzeri)
 * @param params - Kullanıcı verileri ve arama kriterleri
 * @returns Kullanıcının ID'si ve oluşturulup oluşturulmadığı bilgisi
 */
export async function createOrGetUser(params: CreateUserParams & { 
    searchBy?: 'username' | 'id' 
}): Promise<{ id: number | null; created: boolean }> {
    const { data, searchBy = 'username' } = params;
    
    try {
        // Önce kullanıcının var olup olmadığını kontrol et
        let existingUserId = null;
        
        if (searchBy === 'username' && data.username) {
            existingUserId = await getUser({
                in: 'username',
                value: data.username,
                out: 'id'
            });
        } else if (searchBy === 'id' && data.id) {
            existingUserId = await getUser({
                in: 'id',
                value: data.id,
                out: 'id'
            });
        }
        
        // Kullanıcı varsa mevcut ID'yi döndür
        if (existingUserId) {
            logger.debug(`User found with ${searchBy}: ${data[searchBy]}, ID: ${existingUserId}`);
            return { id: existingUserId, created: false };
        }
        
        // Kullanıcı yoksa yeni oluştur (createUser artık kontrol yapmadan direkt oluşturuyor)
        const pool = getPostgresInstance();
        const columns = Object.keys(data).join(', ');
        const placeholders = Object.keys(data).map((_, index) => `$${index + 1}`).join(', ');
        const values = Object.values(data);
        
        const query = `INSERT INTO stack (${columns}) VALUES (${placeholders}) RETURNING id`;
        logger.debug(`Executing insert query: ${query} with params:`, values);
        
        const result = await pool.query(query, values);
        
        if (result.rows.length > 0) {
            const insertedId = result.rows[0].id;
            logger.info(`New user created with ID: ${insertedId}`);
            return { id: insertedId, created: true };
        } else {
            logger.warn('Insert query executed but no ID returned');
            return { id: null, created: false };
        }
        
    } catch (error) {
        logger.error('Error in createOrGetUser:', error);
        throw error;
    }
}

/**
 * Time tablosunu oluştur (eğer yoksa)
 */
export async function createTimeTable(): Promise<void> {
    try {
        const pool = getPostgresInstance();
        
        // Önce stack tablosunu oluştur
        const createStackTableQuery = `
            CREATE TABLE IF NOT EXISTS stack (
                id BIGSERIAL PRIMARY KEY,
                username TEXT NOT NULL,
                index BIGINT,
                look TEXT,
                motto TEXT,
                last_seen BIGINT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            CREATE UNIQUE INDEX IF NOT EXISTS idx_stack_username ON stack (username);
            CREATE INDEX IF NOT EXISTS idx_stack_last_seen ON stack (last_seen);
        `;
        
        await pool.query(createStackTableQuery);
        logger.info('Stack table created/verified successfully');
        
        // Sonra time tablosunu oluştur
        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS time (
                id BIGSERIAL PRIMARY KEY,
                user_id BIGINT NOT NULL UNIQUE,
                username TEXT,
                total BIGINT DEFAULT 0 NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE INDEX IF NOT EXISTS idx_time_user_id ON time (user_id);
            CREATE INDEX IF NOT EXISTS idx_time_username ON time (username);
        `;
        
        await pool.query(createTableQuery);
        logger.info('Time table created/verified successfully');
        
        // Daily time tablosunu oluştur (24 saatlik cycle'lar için)
        const createDailyTableQuery = `
            CREATE TABLE IF NOT EXISTS daily_time (
                id BIGSERIAL PRIMARY KEY,
                user_id BIGINT NOT NULL UNIQUE,
                username TEXT,
                daily_total BIGINT DEFAULT 0 NOT NULL,
                cycle_start TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE INDEX IF NOT EXISTS idx_daily_time_user_id ON daily_time (user_id);
            CREATE INDEX IF NOT EXISTS idx_daily_time_username ON daily_time (username);
        `;
        
        await pool.query(createDailyTableQuery);
        logger.info('Daily time table created/verified successfully');

        // Weekly time tablosunu oluştur (günlük resetten bağımsız haftalık birikim)
        const createWeeklyTimeTableQuery = `
            CREATE TABLE IF NOT EXISTS weekly_time (
                id BIGSERIAL PRIMARY KEY,
                user_id BIGINT NOT NULL,
                username TEXT,
                week_start DATE NOT NULL,
                total_time BIGINT DEFAULT 0 NOT NULL,
                work_time BIGINT DEFAULT 0 NOT NULL,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, week_start)
            );
            CREATE INDEX IF NOT EXISTS idx_weekly_time_user_id ON weekly_time (user_id);
            CREATE INDEX IF NOT EXISTS idx_weekly_time_week_start ON weekly_time (week_start DESC);
        `;
        await pool.query(createWeeklyTimeTableQuery);
        logger.info('Weekly time table created/verified successfully');

        // Archive tablosunu oluştur
        const createArchiveTableQuery = `
            CREATE TABLE IF NOT EXISTS archive (
                pk BIGSERIAL PRIMARY KEY,
                id BIGINT NOT NULL,
                username TEXT NOT NULL,
                promoter TEXT NOT NULL,
                action_timestamp INT NOT NULL,
                action_date DATE DEFAULT CURRENT_DATE,
                action_time TIME DEFAULT CURRENT_TIME,
                type TEXT NOT NULL,
                old_badge INT NOT NULL,
                old_rank INT NOT NULL,
                new_badge INT NOT NULL,
                new_rank INT NOT NULL,
                codename TEXT,
                promoted_users JSONB
            );

            CREATE INDEX IF NOT EXISTS idx_archive_username ON archive (username);
            CREATE INDEX IF NOT EXISTS idx_archive_date ON archive (action_date);
        `;

        await pool.query(createArchiveTableQuery);
        logger.info('Archive table created/verified successfully');

        // Toplu terfi arşivi tablosu
        const createBulkPromotionArchiveTableQuery = `
            CREATE TABLE IF NOT EXISTS bulk_promotion_archive (
                id BIGSERIAL PRIMARY KEY,
                promoter_id BIGINT NOT NULL,
                promoter_codename VARCHAR(255) NOT NULL,
                promoted_users JSONB NOT NULL,
                action_timestamp BIGINT NOT NULL,
                action_date TIMESTAMP NOT NULL,
                action_time VARCHAR(20) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_bulk_promotion_archive_action_timestamp 
            ON bulk_promotion_archive(action_timestamp DESC);

            CREATE INDEX IF NOT EXISTS idx_bulk_promotion_archive_promoter_id 
            ON bulk_promotion_archive(promoter_id);
        `;

        await pool.query(createBulkPromotionArchiveTableQuery);
        logger.info('Bulk promotion archive table created/verified successfully');

        // Eğitim arşivi tablosu
        const createTrainingArchiveTableQuery = `
            CREATE TABLE IF NOT EXISTS training_archive (
                id BIGSERIAL PRIMARY KEY,
                trainee_username VARCHAR(255) NOT NULL UNIQUE,
                trainer_username VARCHAR(255) NOT NULL,
                training_date DATE NOT NULL,
                training_time VARCHAR(20) NOT NULL,
                discord_verified INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_training_archive_trainee_username 
            ON training_archive(trainee_username);

            CREATE INDEX IF NOT EXISTS idx_training_archive_training_date 
            ON training_archive(training_date DESC);
        `;

        await pool.query(createTrainingArchiveTableQuery);
        logger.info('Training archive table created/verified successfully');

        // Doğrulama kodları için tablo
        const createVerificationTableQuery = `
            CREATE TABLE IF NOT EXISTS pending_verifications (
                verification_code TEXT PRIMARY KEY,
                discord_id BIGINT NOT NULL,
                requested_username TEXT NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `;
        await pool.query(createVerificationTableQuery);
        logger.info('Pending verifications table created/verified successfully');

        // OAuth bağlantıları için tablo
        const createOAuthTableQuery = `
            CREATE TABLE IF NOT EXISTS oauth_links (
                id SERIAL PRIMARY KEY,
                user_id BIGINT NOT NULL,
                discord_id BIGINT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT unique_user UNIQUE(user_id),
                CONSTRAINT unique_discord UNIQUE(discord_id),
                CONSTRAINT fk_oauth_user FOREIGN KEY (user_id) REFERENCES users(id)
            );
        `;
        await pool.query(createOAuthTableQuery);
        logger.info('OAuth links table created/verified successfully');

        // Banned tablosunu oluştur
        const createBannedTableQuery = `
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
        
        await pool.query(createBannedTableQuery);
        logger.info('Banned table created/verified successfully');
        
// Codenames tablosunu oluştur
        const createCodenamesTableQuery = `
            CREATE TABLE IF NOT EXISTS codenames (
                pk BIGSERIAL PRIMARY KEY,
                id BIGINT NOT NULL,
                username TEXT NOT NULL,
                codename TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_codenames_username ON codenames (username);
            CREATE INDEX IF NOT EXISTS idx_codenames_codename ON codenames (codename);
        `;

        await pool.query(createCodenamesTableQuery);
        logger.info('Codenames table created/verified successfully');

        // Announcements tablosunu oluştur
        await createAnnouncementsTable();

        // Wordle tablolarını oluştur
        await createWordleTables();

        // Kim Krediner Olmak İster tabloları
        await createKredinerTables();

        // Haftalık toplu terfi takvimi tablosu
        await createBulkPromotionScheduleTable();

        // Yüksek rütbe sohbet tablosu
        await createHighRankChatTable();

    } catch (error) {
        logger.error('Error creating time table:', error);
        throw error;
    }
}
// Codename Table CRUD Operations
export interface CodenameGetParams {
    in: "id" | "username" | "codename";
    value: string | number;
    out?: "all" | keyof CodenameRow;
}

export interface CodenameRow {
    pk: number;
    id: number;
    username: string;
    codename: string;
}

export async function getCodename(params: CodenameGetParams): Promise<CodenameRow | any | null> {
    const pool = getPostgresInstance();
    const { in: field, value, out = "all" } = params;
    
    try {
        let query: string;
        if (out === "all") {
            query = field === "username" || field === "codename"
                ? `SELECT * FROM codenames WHERE ${field} ILIKE $1`
                : `SELECT * FROM codenames WHERE ${field} = $1`;
        } else {
            query = field === "username" || field === "codename"
                ? `SELECT ${out} FROM codenames WHERE ${field} ILIKE $1`
                : `SELECT ${out} FROM codenames WHERE ${field} = $1`;
        }

        logger.debug('Getting codename entry:', { query, field, value });

        const result = await pool.query(query, [value]);
        
        if (result.rows.length === 0) return null;
        
        return out === "all" ? result.rows[0] : result.rows[0][out];
    } catch (error) {
        logger.error('Error in getCodename:', error);
        throw error;
    }
}

export async function createCodename(data: Omit<CodenameRow, 'pk'>): Promise<number | null> {
    const pool = getPostgresInstance();
    try {
        // Önce varolan kodu kontrol et ve varsa güncelle
        const checkQuery = `
            SELECT pk FROM codenames WHERE id = $1
        `;
        const checkResult = await pool.query(checkQuery, [data.id]);
        
        if (checkResult.rows.length > 0) {
            // Kullanıcının zaten bir kodu var, güncelle
            const updateQuery = `
                UPDATE codenames 
                SET codename = $1
                WHERE id = $2
                RETURNING pk
            `;
            logger.debug('Updating existing codename:', {
                id: data.id,
                newCodename: data.codename
            });
            const updateResult = await pool.query(updateQuery, [data.codename, data.id]);
            return updateResult.rows[0]?.pk || null;
        } else {
            // Yeni kod oluştur
            const insertQuery = `
                INSERT INTO codenames (id, username, codename)
                VALUES ($1, $2, $3)
                RETURNING pk
            `;
            logger.debug('Creating new codename entry:', {
                id: data.id,
                username: data.username,
                codename: data.codename
            });
            const insertResult = await pool.query(insertQuery, [data.id, data.username, data.codename]);
            return insertResult.rows[0]?.pk || null;
        }
    } catch (error) {
        logger.error('Error in createCodename:', error);
        throw error;
    }
}

export async function updateCodename(id: number, data: Partial<Omit<CodenameRow, 'pk' | 'id'>>): Promise<boolean> {
    const pool = getPostgresInstance();
    try {
        const setClause = Object.keys(data).map((key, i) => `${key} = $${i + 1}`).join(", ");
        const values = Object.values(data);
        const query = `UPDATE codenames SET ${setClause} WHERE id = $${values.length + 1}`;
        
        logger.debug('Updating codename entry:', { query, id, data });

        const result = await pool.query(query, [...values, id]);
        return (result.rowCount ?? 0) > 0;
    } catch (error) {
        logger.error('Error in updateCodename:', error);
        throw error;
    }
}

export async function deleteCodename(id: number): Promise<boolean> {
    const pool = getPostgresInstance();
    try {
        const query = `DELETE FROM codenames WHERE id = $1`;
        logger.debug('Deleting codename entry:', { id });
        const result = await pool.query(query, [id]);
        return (result.rowCount ?? 0) > 0;
    } catch (error) {
        logger.error('Error in deleteCodename:', error);
        throw error;
    }
}

// Archive Table CRUD Operations
export interface ArchiveGetParams {
    in: "id" | "username" | "promoter" | "action_date" | "type" | ("id" | "username" | "promoter" | "action_date" | "type")[];
    value: string | number | Date | (string | number | Date)[];
    out?: "all" | keyof ArchiveRow;
}

export interface ArchiveRow {
    id: number;
    username: string;
    promoter: string;
    action_timestamp: number;
    action_date: Date;
    action_time: string; // HH:mm:ss formatında
    type: string;
    old_badge: number;
    old_rank: number;
    new_badge: number;
    new_rank: number;
    promoted_users?: any; // JSONB column
}

export interface BulkPromotionArchiveRow {
    id: number;
    promoter_id: number;
    promoter_codename: string;
    promoted_users: Array<{
        username: string;
        old_badge: number;
        old_rank: number;
        new_badge: number;
        new_rank: number;
        habbo_id: string;
    }>;
    action_timestamp: number;
    action_date: Date;
    action_time: string;
    created_at: Date;
}

export async function createArchiveRow(data: Partial<ArchiveRow> | any): Promise<number[] | null> {
    const pool = getPostgresInstance();
    try {
        // Single insert logic for all cases
        const columns = Object.keys(data).join(", ");
        const placeholders = Object.keys(data).map((_, i) => `$${i + 1}`).join(", ");
        const values = Object.values(data);
        const query = `INSERT INTO archive (${columns}) VALUES (${placeholders}) RETURNING id`;

        logger.debug('Creating archive entry:', { query, values });

        const result = await pool.query(query, values);
        return result.rows.length > 0 ? [result.rows[0].id] : null;
    } catch (error) {
        logger.error('Error in createArchiveRow:', error);
        throw error;
    }
}

export async function getArchiveRow(params: ArchiveGetParams): Promise<ArchiveRow | any | null> {
    const pool = getPostgresInstance();
    const { in: fields, value, out = "all" } = params;
    
    try {
        let query: string;
        const conditions: string[] = [];
        const values: (string | number)[] = [];

        // Handle array of conditions
        if (Array.isArray(fields) && Array.isArray(value)) {
            fields.forEach((field, index) => {
                const val = value[index];
                if (val instanceof Date) {
                    values.push(val.toISOString().split('T')[0]);
                } else {
                    values.push(val);
                }
                
                if (field === "username" || field === "promoter") {
                    conditions.push(`${field} ILIKE $${index + 1}`);
                } else {
                    conditions.push(`${field} = $${index + 1}`);
                }
            });
            
            if (out === "all") {
                query = `SELECT * FROM archive WHERE ${conditions.join(' AND ')} ORDER BY action_timestamp DESC`;
            } else {
                query = `SELECT ${out} FROM archive WHERE ${conditions.join(' AND ')} ORDER BY action_timestamp DESC`;
            }
        } else {
            // Handle single condition
            const queryValue = value instanceof Date ? value.toISOString().split('T')[0] : value;
            values.push(queryValue as string | number);

            if (out === "all") {
                query = fields === "username" || fields === "promoter"
                    ? `SELECT * FROM archive WHERE ${fields} ILIKE $1 ORDER BY action_timestamp DESC`
                    : `SELECT * FROM archive WHERE ${fields} = $1 ORDER BY action_timestamp DESC`;
            } else {
                query = fields === "username" || fields === "promoter"
                    ? `SELECT ${out} FROM archive WHERE ${fields} ILIKE $1 ORDER BY action_timestamp DESC`
                    : `SELECT ${out} FROM archive WHERE ${fields} = $1 ORDER BY action_timestamp DESC`;
            }
        }

        logger.debug('Getting archive entry:', { query, fields, values });

        const result = await pool.query(query, values);
        
        if (result.rows.length === 0) return null;
        
        return out === "all" ? result.rows : result.rows.map(row => row[out]);
    } catch (error) {
        logger.error('Error in getArchiveRow:', error);
        throw error;
    }
}

export async function updateArchiveRow(id: number, data: Partial<ArchiveRow>): Promise<boolean> {
    const pool = getPostgresInstance();
    try {
        const setClause = Object.keys(data).map((key, i) => `${key} = $${i + 1}`).join(", ");
        const values = Object.values(data);
        const query = `UPDATE archive SET ${setClause} WHERE id = $${values.length + 1}`;
        
        logger.debug('Updating archive entry:', { query, id, data });

        const result = await pool.query(query, [...values, id]);
        return (result.rowCount ?? 0) > 0;
    } catch (error) {
        logger.error('Error in updateArchiveRow:', error);
        throw error;
    }
}

export async function deleteArchiveRow(id: number): Promise<boolean> {
    const pool = getPostgresInstance();
    try {
        const query = `DELETE FROM archive WHERE id = $1`;
        
        logger.debug('Deleting archive entry:', { query, id });

        const result = await pool.query(query, [id]);
        return (result.rowCount ?? 0) > 0;
    } catch (error) {
        logger.error('Error in deleteArchiveRow:', error);
        throw error;
    }
}

// Verification Interface ve Fonksiyonları
export interface PendingVerification {
    verification_code: string;
    discord_id: bigint;
    requested_username: string;
    expires_at: Date;
    created_at: Date;
}

export async function createPendingVerification(data: Omit<PendingVerification, 'created_at'>): Promise<string> {
    const pool = getPostgresInstance();
    try {
        // Önce tablo yapısını kontrol et
        const tableCheckQuery = `
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'pending_verifications'
            );
        `;
        
        const tableCheck = await pool.query(tableCheckQuery);
        logger.debug('Table check result:', {
            exists: tableCheck.rows[0].exists,
            query: tableCheckQuery
        });

        if (!tableCheck.rows[0].exists) {
            logger.warn('Pending verifications table does not exist, creating it now');
            await createTimeTable(); // Bu fonksiyon içinde tablo oluşturma var
        }

        const query = `
            INSERT INTO pending_verifications 
            (verification_code, discord_id, requested_username, expires_at)
            VALUES ($1, $2, $3, $4)
            RETURNING verification_code
        `;
        
        logger.debug('Executing query:', {
            query,
            params: {
                verification_code: data.verification_code,
                discord_id: data.discord_id.toString(),
                requested_username: data.requested_username,
                expires_at: data.expires_at
            }
        });

        const result = await pool.query(query, [
            data.verification_code,
            data.discord_id,
            data.requested_username,
            data.expires_at
        ]);

        if (!result.rows || result.rows.length === 0) {
            throw new Error('Insert succeeded but no verification code returned');
        }

        logger.info('Created pending verification:', {
            code: data.verification_code,
            discord_id: data.discord_id.toString(),
            username: data.requested_username,
            result: result.rows[0]
        });

        return result.rows[0].verification_code;
    } catch (error: any) {
        logger.error('Error creating pending verification:', {
            error: {
                message: error.message,
                code: error.code,
                detail: error.detail,
                hint: error.hint,
                where: error.where,
                schema: error.schema,
                table: error.table,
                column: error.column,
                dataType: error.dataType,
                constraint: error.constraint
            },
            data: {
                verification_code: data.verification_code,
                discord_id: data.discord_id.toString(),
                username: data.requested_username
            }
        });
        throw error;
    }
}

export async function getPendingVerification(code: string): Promise<PendingVerification | null> {
    const pool = getPostgresInstance();
    try {
        const query = `
            SELECT * FROM pending_verifications 
            WHERE verification_code = $1
        `;
        
        const result = await pool.query(query, [code]);
        return result.rows[0] || null;
    } catch (error) {
        logger.error('Error getting pending verification:', error);
        throw error;
    }
}

export async function deletePendingVerification(code: string): Promise<boolean> {
    const pool = getPostgresInstance();
    try {
        const query = `
            DELETE FROM pending_verifications 
            WHERE verification_code = $1
        `;
        
        const result = await pool.query(query, [code]);
        return (result.rowCount ?? 0) > 0;
    } catch (error) {
        logger.error('Error deleting pending verification:', error);
        throw error;
    }
}

// OAuth Interface ve Fonksiyonları
export interface OAuthLink {
    id?: number;
    user_id: number;
    discord_id: bigint;
    created_at?: Date;
}

export async function createOAuthLink(data: Omit<OAuthLink, 'id' | 'created_at'>): Promise<number> {
    const pool = getPostgresInstance();
    try {
        const query = `
            INSERT INTO oauth_links (user_id, discord_id)
            VALUES ($1, $2)
            RETURNING id
        `;
        
        const result = await pool.query(query, [data.user_id, data.discord_id]);
        
        logger.debug('Created OAuth link:', {
            user_id: data.user_id,
            discord_id: data.discord_id
        });

        return result.rows[0].id;
    } catch (error) {
        logger.error('Error creating OAuth link:', error);
        throw error;
    }
}

export async function getOAuthLink(discordId: string | bigint): Promise<OAuthLink | null> {
    const pool = getPostgresInstance();
    try {
        const query = `
            SELECT * FROM oauth_links 
            WHERE discord_id = $1::bigint
        `;
        
        const result = await pool.query(query, [typeof discordId === 'string' ? BigInt(discordId) : discordId]);
        return result.rows[0] || null;
    } catch (error) {
        logger.error('Error getting OAuth link:', error);
        throw error;
    }
}

export async function getOAuthLinkByUserId(userId: number): Promise<OAuthLink | null> {
    const pool = getPostgresInstance();
    try {
        const query = `
            SELECT * FROM oauth_links 
            WHERE user_id = $1
        `;
        
        const result = await pool.query(query, [userId]);
        return result.rows[0] || null;
    } catch (error) {
        logger.error('Error getting OAuth link by user ID:', error);
        throw error;
    }
}

export async function deleteOAuthLink(discordId: string | bigint): Promise<boolean> {
    const pool = getPostgresInstance();
    try {
        const query = `
            DELETE FROM oauth_links 
            WHERE discord_id = $1::bigint
        `;
        
        const result = await pool.query(query, [typeof discordId === 'string' ? BigInt(discordId) : discordId]);
        return (result.rowCount ?? 0) > 0;
    } catch (error) {
        logger.error('Error deleting OAuth link:', error);
        throw error;
    }
}

export async function getAllArchiveRows(limit?: number, offset?: number): Promise<ArchiveRow[]> {
    const pool = getPostgresInstance();
    try {
        let query = `SELECT * FROM archive ORDER BY action_timestamp DESC`;
        const values: number[] = [];

        if (limit) {
            query += ` LIMIT $1`;
            values.push(limit);
        }
        if (offset) {
            query += ` OFFSET $${values.length + 1}`;
            values.push(offset);
        }

        logger.debug('Getting all archive entries:', { query, limit, offset });

        const result = await pool.query(query, values);
        return result.rows;
    } catch (error) {
        logger.error('Error in getAllArchiveRows:', error);
        throw error;
    }
}

/**
 * Kullanıcının günlük süresini güncelle (24 saatlik cycle için)
 */
export async function updateDailyUserTime(userId: number, additionalTime: number, username?: string): Promise<void> {
    try {
        const pool = getPostgresInstance();
        
        // Eğer username verilmemişse stack tablosundan al
        let finalUsername = username;
        if (!finalUsername) {
            const stackQuery = 'SELECT username FROM stack WHERE id = $1';
            const stackResult = await pool.query(stackQuery, [userId]);
            if (stackResult.rows.length > 0) {
                finalUsername = stackResult.rows[0].username;
            }
        }

        // Önce kullanıcının son cycle başlangıcını kontrol et
        const checkQuery = 'SELECT cycle_start FROM daily_time WHERE user_id = $1';
        const checkResult = await pool.query(checkQuery, [userId]);
        
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        
        // Eğer kayıt varsa ve cycle_start bugünden önceyse sıfırla
        if (checkResult.rows.length > 0) {
            const cycleStart = new Date(checkResult.rows[0].cycle_start);
            if (cycleStart < startOfDay) {
                logger.info(`Resetting daily time for user ${userId} - new day started`);
                const resetQuery = `
                    UPDATE daily_time 
                    SET daily_total = 0, 
                        cycle_start = $1,
                        updated_at = $1 
                    WHERE user_id = $2
                `;
                await pool.query(resetQuery, [now, userId]);
            }
        }
        
        // Şimdi günlük süreyi güncelle
        const query = `
            INSERT INTO daily_time (user_id, username, daily_total, cycle_start, updated_at) 
            VALUES ($1, $2, $3, $4, $4)
            ON CONFLICT (user_id) 
            DO UPDATE SET 
                daily_total = daily_time.daily_total + EXCLUDED.daily_total,
                username = COALESCE(EXCLUDED.username, daily_time.username),
                updated_at = EXCLUDED.updated_at
        `;
        
        await pool.query(query, [userId, finalUsername, additionalTime, now]);
        logger.debug(`Updated daily time for user ID ${userId}: +${additionalTime}ms`);
        
    } catch (error) {
        logger.error('Error updating daily user time:', error);
        throw error;
    }
}

/**
 * Kullanıcının günlük süresini getir
 */
export async function getDailyUserTime(userId: number): Promise<number> {
    try {
        const pool = getPostgresInstance();
        
        const query = 'SELECT daily_total FROM daily_time WHERE user_id = $1';
        const result = await pool.query(query, [userId]);
        
        if (result.rows.length > 0) {
            return parseInt(result.rows[0].daily_total);
        }
        
        return 0;
        
    } catch (error) {
        logger.error('Error getting daily user time:', error);
        throw error;
    }
}

/**
 * Tüm günlük kullanıcı sürelerini sıfırla (24 saatlik reset için)
 */
export async function resetAllDailyUserTimes(): Promise<number> {
    try {
        const pool = getPostgresInstance();
        
        const query = 'DELETE FROM daily_time';
        const result = await pool.query(query);
        
        const deletedCount = result.rowCount || 0;
        logger.info(`Reset ${deletedCount} daily user time records`);
        
        return deletedCount;
        
    } catch (error) {
        logger.error('Error resetting daily user times:', error);
        throw error;
    }
}

/**
 * Haftanın Pazartesi gününü (YYYY-MM-DD) döndürür (hafta başı: Pazartesi).
 */
function getWeekStartDate(date: Date): string {
    const d = new Date(date);
    const day = d.getDay(); // 0: Pazar, 1: Pazartesi...
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d.toISOString().slice(0, 10);
}

/**
 * Haftalık süreyi delta (eklenen) süre ile arttırır.
 * Not: Bu fonksiyon "time" tablosundaki toplamdan bağımsızdır; günlük resetten etkilenmez.
 */
export async function incrementWeeklyTime(params: {
    userId: number;
    username?: string;
    deltaTotalMs: number;
    deltaWorkMs?: number;
    at?: Date;
}): Promise<void> {
    try {
        const pool = getPostgresInstance();
        const weekStart = getWeekStartDate(params.at ?? new Date());
        const deltaWork = typeof params.deltaWorkMs === 'number' ? params.deltaWorkMs : params.deltaTotalMs;

        await pool.query(
            `INSERT INTO weekly_time (user_id, username, week_start, total_time, work_time, updated_at)
             VALUES ($1::bigint, $2, $3::date, $4::bigint, $5::bigint, NOW())
             ON CONFLICT (user_id, week_start) DO UPDATE SET
               total_time = weekly_time.total_time + EXCLUDED.total_time,
               work_time  = weekly_time.work_time  + EXCLUDED.work_time,
               username   = COALESCE(EXCLUDED.username, weekly_time.username),
               updated_at = NOW()`,
            [params.userId, params.username ?? null, weekStart, params.deltaTotalMs, deltaWork]
        );
    } catch (error) {
        logger.error('Error incrementing weekly time:', error);
        throw error;
    }
}

let cachedEsSahipBadgeNumber: number | null = null;

function getEsSahipBadgeNumber(): number {
    if (cachedEsSahipBadgeNumber != null) return cachedEsSahipBadgeNumber;
    try {
        const badgesPath = path.join(__dirname, '..', '..', 'cache', 'badges.json');
        const badgesData = JSON.parse(fs.readFileSync(badgesPath, 'utf8'));
        const keys = Object.keys(badgesData);
        const target = 'eş sahip';
        const idx = keys.findIndex((k) => k.toLocaleLowerCase('tr-TR') === target);
        if (idx === -1) {
            logger.warn('Could not find "Eş Sahip" in badges.json keys', { sample: keys.slice(-15) });
            // Fallback: show nothing rather than wrong users
            cachedEsSahipBadgeNumber = Number.MAX_SAFE_INTEGER;
            return cachedEsSahipBadgeNumber;
        }
        cachedEsSahipBadgeNumber = idx + 1; // badge is 1-based index
        return cachedEsSahipBadgeNumber;
    } catch (err) {
        logger.error('Error computing Eş Sahip badge number:', err);
        cachedEsSahipBadgeNumber = Number.MAX_SAFE_INTEGER;
        return cachedEsSahipBadgeNumber;
    }
}

/**
 * Belirtilen haftanın (veya bu haftanın) haftalık süre verilerini getirir.
 * weekStart: YYYY-MM-DD (Pazartesi), opsiyonel.
 */
export async function getWeeklyTimeData(weekStart?: string): Promise<Array<{
    user_id: number;
    username: string | null;
    week_start: string;
    total_time: number;
    work_time: number;
    updated_at: string;
}>> {
    try {
        const pool = getPostgresInstance();
        const week = weekStart || getWeekStartDate(new Date());
        const minBadge = getEsSahipBadgeNumber();
        const result = await pool.query(
            `SELECT
               w.user_id,
               COALESCE(w.username, u.username) AS username,
               w.week_start::text,
               w.total_time,
               w.work_time,
               w.updated_at
             FROM weekly_time w
             LEFT JOIN LATERAL (
               SELECT username, badge
               FROM users
               WHERE id = w.user_id OR habbo_id = w.user_id
               ORDER BY badge DESC NULLS LAST
               LIMIT 1
             ) u ON true
             WHERE w.week_start = $1::date
               AND COALESCE(u.badge, 0) >= $2
             ORDER BY w.work_time DESC NULLS LAST, w.total_time DESC`,
            [week, minBadge]
        );

        return result.rows.map((row: any) => ({
            user_id: parseInt(row.user_id),
            username: row.username,
            week_start: row.week_start,
            total_time: parseInt(row.total_time || 0),
            work_time: parseInt(row.work_time || 0),
            updated_at: row.updated_at
        }));
    } catch (error) {
        logger.error('Error getting weekly time data:', error);
        throw error;
    }
}

/**
 * Kullanıcının toplam süresini getir (ID bazlı) - Gerçek zamanlı hesaplama ile
 */
export async function getUserTime(userId: number): Promise<{ 
    storedTotal: number; 
    currentSessionTime: number; 
    realTimeTotal: number; 
    isActive: boolean;
    lastSeen: number | null;
}> {
    try {
        const pool = getPostgresInstance();
        
        // Time tablosundan kayıtlı süreyi al
        const timeQuery = 'SELECT total FROM time WHERE user_id = $1';
        const timeResult = await pool.query(timeQuery, [userId]);
        const storedTotal = timeResult.rows.length > 0 ? parseInt(timeResult.rows[0].total) : 0;
        
        let currentSessionTime = 0;
        let isActive = false;
        let lastSeen: number | null = null;
        
        // Active time collection'dan gerçek zamanlı veriyi al
        try {
            const { globalStore } = await import('../utils/globalStore');
            const activeTimeCollection = globalStore.collection('activeTimeData');
            const activeTimeData = activeTimeCollection.get(userId.toString()) as any;
            
            if (activeTimeData) {
                // Kullanıcı aktif collection'da var - aktif demektir
                isActive = true;
                currentSessionTime = activeTimeData.currentSession || 0;
                lastSeen = activeTimeData.lastUpdated || null;
                
                logger.debug(`User ${userId} found in active collection`, {
                    currentSession: Math.round(currentSessionTime / 1000),
                    totalTime: activeTimeData.totalTime
                });
            } else {
                // Active collection'da yok - çevrimdışı
                isActive = false;
                currentSessionTime = 0;
                
                // Stack tablosundan son görülme zamanını al (isteğe bağlı)
                const stackQuery = 'SELECT last_seen FROM stack WHERE id = $1';
                const stackResult = await pool.query(stackQuery, [userId]);
                if (stackResult.rows.length > 0 && stackResult.rows[0].last_seen) {
                    lastSeen = parseInt(stackResult.rows[0].last_seen);
                }
                
                logger.debug(`User ${userId} not in active collection - offline`);
            }
        } catch (error) {
            // Active collection erişim hatası, fallback olarak stack kontrol et
            logger.warn(`Could not access active time collection for user ${userId}, using fallback`, error);
            
            const stackQuery = 'SELECT last_seen FROM stack WHERE id = $1';
            const stackResult = await pool.query(stackQuery, [userId]);
            
            if (stackResult.rows.length > 0 && stackResult.rows[0].last_seen) {
                lastSeen = parseInt(stackResult.rows[0].last_seen);
                const now = Date.now();
                const timeSinceLastSeen = now - lastSeen;
                
                // Son 60 saniye içinde görüldüyse aktif kabul et
                if (timeSinceLastSeen <= 60000) {
                    isActive = true;
                    currentSessionTime = timeSinceLastSeen;
                }
            }
        }
        
        const realTimeTotal = storedTotal + currentSessionTime;
        
        return {
            storedTotal,
            currentSessionTime,
            realTimeTotal,
            isActive,
            lastSeen
        };
        
    } catch (error) {
        logger.error('Error getting user time:', error);
        throw error;
    }
}

/**
 * Kullanıcının toplam süresini getir (basit versiyon - geriye uyumluluk için)
 */
export async function getUserTimeSimple(userId: number): Promise<number> {
    try {
        const pool = getPostgresInstance();
        
        const query = 'SELECT total FROM time WHERE user_id = $1';
        const result = await pool.query(query, [userId]);
        
        if (result.rows.length > 0) {
            return parseInt(result.rows[0].total);
        }
        
        return 0;
        
    } catch (error) {
        logger.error('Error getting user time:', error);
        throw error;
    }
}

/**
 * Kullanıcının toplam süresini güncelle (ID bazlı) - Username ile birlikte
 * NOT: Bu fonksiyon toplam süreyi SET eder, ADD etmez!
 */
export async function updateUserTime(userId: number, totalTime: number, username?: string): Promise<void> {
    try {
        const pool = getPostgresInstance();
        
        // Eğer username verilmemişse stack tablosundan al
        let finalUsername = username;
        if (!finalUsername) {
            const stackQuery = 'SELECT username FROM stack WHERE id = $1';
            const stackResult = await pool.query(stackQuery, [userId]);
            if (stackResult.rows.length > 0) {
                finalUsername = stackResult.rows[0].username;
            }
        }
        
        const query = `
            INSERT INTO time (user_id, username, total, updated_at) 
            VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
            ON CONFLICT (user_id) 
            DO UPDATE SET 
                total = EXCLUDED.total,
                username = COALESCE(EXCLUDED.username, time.username),
                updated_at = CURRENT_TIMESTAMP
        `;
        
        await pool.query(query, [userId, finalUsername, totalTime]);
        logger.debug(`Set total time for user ID ${userId}: ${totalTime}ms`);
        
    } catch (error) {
        logger.error('Error updating user time:', error);
        throw error;
    }
}

/**
 * Tüm kullanıcı sürelerini sıfırla
 */
export async function resetAllUserTimes(): Promise<number> {
    try {
        const pool = getPostgresInstance();
        
        const query = 'DELETE FROM time';
        const result = await pool.query(query);
        
        const deletedCount = result.rowCount || 0;
        logger.info(`Reset ${deletedCount} user time records`);
        
        return deletedCount;
        
    } catch (error) {
        logger.error('Error resetting user times:', error);
        throw error;
    }
}

/**
 * Tüm kullanıcı sürelerini getir (rapor oluşturma için)
 */
export async function getAllUserTimes(): Promise<Array<{
    user_id: number;
    username: string | null;
    total: number;
    updated_at: string;
}>> {
    try {
        const pool = getPostgresInstance();
        
        const query = `
            SELECT user_id, username, total, updated_at 
            FROM time 
            ORDER BY total DESC
        `;
        const result = await pool.query(query);
        
        return result.rows.map(row => ({
            user_id: parseInt(row.user_id),
            username: row.username,
            total: parseInt(row.total),
            updated_at: row.updated_at
        }));
        
    } catch (error) {
        logger.error('Error getting all user times:', error);
        throw error;
    }
}

/**
 * Toplu terfi arşivi kaydı oluştur
 */
export async function createBulkPromotionArchiveRow(data: {
    promoter_id: number;
    promoter_codename: string;
    promoted_users: Array<{
        username: string;
        old_badge: number;
        old_rank: number;
        new_badge: number;
        new_rank: number;
        habbo_id: string;
    }>;
    action_timestamp: number;
    action_date: Date;
    action_time: string;
}): Promise<number | null> {
    const pool = getPostgresInstance();
    try {
        const query = `
            INSERT INTO bulk_promotion_archive 
            (promoter_id, promoter_codename, promoted_users, action_timestamp, action_date, action_time)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id
        `;

        const result = await pool.query(query, [
            data.promoter_id,
            data.promoter_codename,
            JSON.stringify(data.promoted_users),
            data.action_timestamp,
            data.action_date,
            data.action_time
        ]);

        logger.debug('Created bulk promotion archive entry:', { id: result.rows[0].id });
        return result.rows[0]?.id || null;
    } catch (error) {
        logger.error('Error in createBulkPromotionArchiveRow:', error);
        throw error;
    }
}

/**
 * Toplu terfi arşivini getir
 */
export async function getBulkPromotionArchive(limit: number = 50, offset: number = 0): Promise<BulkPromotionArchiveRow[]> {
    const pool = getPostgresInstance();
    try {
        const query = `
            SELECT * FROM bulk_promotion_archive
            ORDER BY action_timestamp DESC
            LIMIT $1 OFFSET $2
        `;

        const result = await pool.query(query, [limit, offset]);
        
        return result.rows.map(row => ({
            id: row.id,
            promoter_id: row.promoter_id,
            promoter_codename: row.promoter_codename,
            promoted_users: typeof row.promoted_users === 'string' 
                ? JSON.parse(row.promoted_users) 
                : row.promoted_users,
            action_timestamp: row.action_timestamp,
            action_date: new Date(row.action_date),
            action_time: row.action_time,
            created_at: new Date(row.created_at)
        }));
    } catch (error) {
        logger.error('Error in getBulkPromotionArchive:', error);
        throw error;
    }
}

/**
 * Toplu terfi arşivini tarih aralığına göre getir
 */
export async function getBulkPromotionArchiveByDateRange(startDate: Date, endDate: Date): Promise<BulkPromotionArchiveRow[]> {
    const pool = getPostgresInstance();
    try {
        const query = `
            SELECT * FROM bulk_promotion_archive
            WHERE action_date >= $1 AND action_date < $2
            ORDER BY action_timestamp DESC
        `;

        const result = await pool.query(query, [startDate, endDate]);
        
        return result.rows.map(row => ({
            id: row.id,
            promoter_id: row.promoter_id,
            promoter_codename: row.promoter_codename,
            promoted_users: typeof row.promoted_users === 'string' 
                ? JSON.parse(row.promoted_users) 
                : row.promoted_users,
            action_timestamp: row.action_timestamp,
            action_date: new Date(row.action_date),
            action_time: row.action_time,
            created_at: new Date(row.created_at)
        }));
    } catch (error) {
        logger.error('Error in getBulkPromotionArchiveByDateRange:', error);
        throw error;
    }
}

/**
 * Toplu terfi arşivini promoter'a göre getir
 */
export async function getBulkPromotionArchiveByPromoter(promoterId: number): Promise<BulkPromotionArchiveRow[]> {
    const pool = getPostgresInstance();
    try {
        const query = `
            SELECT * FROM bulk_promotion_archive
            WHERE promoter_id = $1
            ORDER BY action_timestamp DESC
        `;

        const result = await pool.query(query, [promoterId]);
        
        return result.rows.map(row => ({
            id: row.id,
            promoter_id: row.promoter_id,
            promoter_codename: row.promoter_codename,
            promoted_users: typeof row.promoted_users === 'string' 
                ? JSON.parse(row.promoted_users) 
                : row.promoted_users,
            action_timestamp: row.action_timestamp,
            action_date: new Date(row.action_date),
            action_time: row.action_time,
            created_at: new Date(row.created_at)
        }));
    } catch (error) {
        logger.error('Error in getBulkPromotionArchiveByPromoter:', error);
        throw error;
    }
}

// Training Archive Interface
export interface TrainingArchiveRow {
    id: number;
    trainee_username: string;
    trainer_username: string;
    training_date: Date;
    training_time: string;
    discord_verified: number; // 0 = not verified, 1 = verified
    created_at: Date;
}

/**
 * Eğitim kaydını kullanıcı adına göre getir
 */
export async function getTrainingRecord(traineUsername: string): Promise<TrainingArchiveRow | null> {
    const pool = getPostgresInstance();
    try {
        const query = `
            SELECT * FROM training_archive
            WHERE LOWER(trainee_username) = LOWER($1)
        `;

        const result = await pool.query(query, [traineUsername]);
        
        if (result.rows.length === 0) {
            return null;
        }

        const row = result.rows[0];
        return {
            id: row.id,
            trainee_username: row.trainee_username,
            trainer_username: row.trainer_username,
            training_date: new Date(row.training_date),
            training_time: row.training_time,
            discord_verified: row.discord_verified || 0,
            created_at: new Date(row.created_at)
        };
    } catch (error) {
        logger.error('Error in getTrainingRecord:', error);
        throw error;
    }
}

/**
 * Yeni eğitim kaydı oluştur
 */
export async function createTrainingRecord(data: {
    trainee_username: string;
    trainer_username: string;
    discord_verified?: number;
}): Promise<TrainingArchiveRow | null> {
    const pool = getPostgresInstance();
    try {
        const now = new Date();
        const trainingDate = now.toISOString().split('T')[0]; // YYYY-MM-DD
        const trainingTime = now.toTimeString().split(' ')[0]; // HH:MM:SS

        const query = `
            INSERT INTO training_archive 
            (trainee_username, trainer_username, training_date, training_time, discord_verified)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `;

        const result = await pool.query(query, [
            data.trainee_username,
            data.trainer_username,
            trainingDate,
            trainingTime,
            data.discord_verified || 0
        ]);

        const row = result.rows[0];
        logger.info(`Training record created for ${data.trainee_username}`);
        
        return {
            id: row.id,
            trainee_username: row.trainee_username,
            trainer_username: row.trainer_username,
            training_date: new Date(row.training_date),
            training_time: row.training_time,
            discord_verified: row.discord_verified || 0,
            created_at: new Date(row.created_at)
        };
    } catch (error) {
        logger.error('Error in createTrainingRecord:', error);
        throw error;
    }
}

/**
 * Eğitim kaydını güncelle (discord_verified)
 */
export async function updateTrainingRecord(traineUsername: string, data: {
    discord_verified?: number;
}): Promise<TrainingArchiveRow | null> {
    const pool = getPostgresInstance();
    try {
        const query = `
            UPDATE training_archive
            SET discord_verified = $1
            WHERE LOWER(trainee_username) = LOWER($2)
            RETURNING *
        `;

        const result = await pool.query(query, [
            data.discord_verified || 0,
            traineUsername
        ]);

        if (result.rows.length === 0) {
            return null;
        }

        const row = result.rows[0];
        logger.info(`Training record updated for ${traineUsername}`);
        
        return {
            id: row.id,
            trainee_username: row.trainee_username,
            trainer_username: row.trainer_username,
            training_date: new Date(row.training_date),
            training_time: row.training_time,
            discord_verified: row.discord_verified || 0,
            created_at: new Date(row.created_at)
        };
    } catch (error) {
        logger.error('Error in updateTrainingRecord:', error);
        throw error;
    }
}

// ==================== ANNOUNCEMENTS TABLE ====================

export interface AnnouncementRow {
    id: number;
    type: 'UPDATE_NOTES' | 'ANNOUNCEMENT' | 'PLANS';
    sub_type: string; // e.g., 'SECURITY_UPDATE', 'SERVER_ANNOUNCEMENT', 'MAINTENANCE'
    title: string;
    description: string;
    published_by: string; // Username of the user who published
    published_at: Date;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
}

/**
 * Announcements tablosunu oluştur
 */
export async function createAnnouncementsTable(): Promise<void> {
    const pool = getPostgresInstance();
    try {
        const query = `
            CREATE TABLE IF NOT EXISTS announcements (
                id BIGSERIAL PRIMARY KEY,
                type TEXT NOT NULL CHECK (type IN ('UPDATE_NOTES', 'ANNOUNCEMENT', 'PLANS')),
                sub_type TEXT NOT NULL,
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                published_by TEXT NOT NULL,
                published_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_announcements_type ON announcements (type);
            CREATE INDEX IF NOT EXISTS idx_announcements_sub_type ON announcements (sub_type);
            CREATE INDEX IF NOT EXISTS idx_announcements_published_at ON announcements (published_at DESC);
            CREATE INDEX IF NOT EXISTS idx_announcements_is_active ON announcements (is_active);
        `;

        await pool.query(query);
        logger.info('Announcements table created/verified successfully');
    } catch (error) {
        logger.error('Error creating announcements table:', error);
        throw error;
    }
}

/**
 * Yeni duyuru oluştur
 */
export async function createAnnouncement(data: Omit<AnnouncementRow, 'id' | 'created_at' | 'updated_at'>): Promise<AnnouncementRow | null> {
    const pool = getPostgresInstance();
    try {
        const query = `
            INSERT INTO announcements 
            (type, sub_type, title, description, published_by, published_at, is_active)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `;

        const result = await pool.query(query, [
            data.type,
            data.sub_type,
            data.title,
            data.description,
            data.published_by,
            data.published_at,
            data.is_active ?? true
        ]);

        const row = result.rows[0];
        logger.info(`Announcement created: ${data.title} (${data.type}/${data.sub_type})`);

        return {
            id: row.id,
            type: row.type,
            sub_type: row.sub_type,
            title: row.title,
            description: row.description,
            published_by: row.published_by,
            published_at: new Date(row.published_at),
            is_active: row.is_active,
            created_at: new Date(row.created_at),
            updated_at: new Date(row.updated_at)
        };
    } catch (error) {
        logger.error('Error creating announcement:', error);
        throw error;
    }
}

/**
 * Duyuruyu ID'ye göre getir
 */
export async function getAnnouncement(id: number): Promise<AnnouncementRow | null> {
    const pool = getPostgresInstance();
    try {
        const query = `
            SELECT * FROM announcements WHERE id = $1
        `;

        const result = await pool.query(query, [id]);

        if (result.rows.length === 0) {
            return null;
        }

        const row = result.rows[0];
        return {
            id: row.id,
            type: row.type,
            sub_type: row.sub_type,
            title: row.title,
            description: row.description,
            published_by: row.published_by,
            published_at: new Date(row.published_at),
            is_active: row.is_active,
            created_at: new Date(row.created_at),
            updated_at: new Date(row.updated_at)
        };
    } catch (error) {
        logger.error('Error getting announcement:', error);
        throw error;
    }
}

/**
 * Tüm duyuruları getir (opsiyonel filtreleme)
 */
export async function getAllAnnouncements(filters?: {
    type?: 'UPDATE_NOTES' | 'ANNOUNCEMENT' | 'PLANS';
    sub_type?: string;
    is_active?: boolean;
    limit?: number;
    offset?: number;
}): Promise<AnnouncementRow[]> {
    const pool = getPostgresInstance();
    try {
        let query = `SELECT * FROM announcements WHERE 1=1`;
        const values: any[] = [];
        let paramCount = 1;

        if (filters?.type) {
            query += ` AND type = $${paramCount}`;
            values.push(filters.type);
            paramCount++;
        }

        if (filters?.sub_type) {
            query += ` AND sub_type = $${paramCount}`;
            values.push(filters.sub_type);
            paramCount++;
        }

        if (filters?.is_active !== undefined) {
            query += ` AND is_active = $${paramCount}`;
            values.push(filters.is_active);
            paramCount++;
        }

        query += ` ORDER BY published_at DESC`;

        if (filters?.limit) {
            query += ` LIMIT $${paramCount}`;
            values.push(filters.limit);
            paramCount++;
        }

        if (filters?.offset) {
            query += ` OFFSET $${paramCount}`;
            values.push(filters.offset);
            paramCount++;
        }

        const result = await pool.query(query, values);

        return result.rows.map(row => ({
            id: row.id,
            type: row.type,
            sub_type: row.sub_type,
            title: row.title,
            description: row.description,
            published_by: row.published_by,
            published_at: new Date(row.published_at),
            is_active: row.is_active,
            created_at: new Date(row.created_at),
            updated_at: new Date(row.updated_at)
        }));
    } catch (error) {
        logger.error('Error getting announcements:', error);
        throw error;
    }
}

/**
 * Duyuruyu güncelle
 */
export async function updateAnnouncement(id: number, data: Partial<Omit<AnnouncementRow, 'id' | 'created_at'>>): Promise<AnnouncementRow | null> {
    const pool = getPostgresInstance();
    try {
        const updates: string[] = [];
        const values: any[] = [];
        let paramCount = 1;

        for (const [key, value] of Object.entries(data)) {
            // Always manage updated_at internally to avoid duplicate column assignments
            // (some callers may pass updated_at explicitly).
            if (key === 'updated_at') continue;
            if (value !== undefined) {
                updates.push(`${key} = $${paramCount}`);
                values.push(value);
                paramCount++;
            }
        }

        if (updates.length === 0) {
            return getAnnouncement(id);
        }

        updates.push(`updated_at = $${paramCount}`);
        values.push(new Date());
        paramCount++;

        const query = `
            UPDATE announcements 
            SET ${updates.join(', ')}
            WHERE id = $${paramCount}
            RETURNING *
        `;
        values.push(id);

        const result = await pool.query(query, values);

        if (result.rows.length === 0) {
            return null;
        }

        const row = result.rows[0];
        logger.info(`Announcement updated: ${row.title}`);

        return {
            id: row.id,
            type: row.type,
            sub_type: row.sub_type,
            title: row.title,
            description: row.description,
            published_by: row.published_by,
            published_at: new Date(row.published_at),
            is_active: row.is_active,
            created_at: new Date(row.created_at),
            updated_at: new Date(row.updated_at)
        };
    } catch (error) {
        logger.error('Error updating announcement:', error);
        throw error;
    }
}

/**
 * Duyuruyu sil
 */
export async function deleteAnnouncement(id: number): Promise<boolean> {
    const pool = getPostgresInstance();
    try {
        const query = `DELETE FROM announcements WHERE id = $1`;

        const result = await pool.query(query, [id]);
        logger.info(`Announcement deleted: ${id}`);

        return (result.rowCount ?? 0) > 0;
    } catch (error) {
        logger.error('Error deleting announcement:', error);
        throw error;
    }
}

/**
 * Duyuruyu aktif/pasif yap
 */
export async function toggleAnnouncementActive(id: number, isActive: boolean): Promise<AnnouncementRow | null> {
    const pool = getPostgresInstance();
    try {
        const query = `
            UPDATE announcements 
            SET is_active = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
            RETURNING *
        `;

        const result = await pool.query(query, [isActive, id]);

        if (result.rows.length === 0) {
            return null;
        }

        const row = result.rows[0];
        logger.info(`Announcement ${isActive ? 'activated' : 'deactivated'}: ${row.title}`);

        return {
            id: row.id,
            type: row.type,
            sub_type: row.sub_type,
            title: row.title,
            description: row.description,
            published_by: row.published_by,
            published_at: new Date(row.published_at),
            is_active: row.is_active,
            created_at: new Date(row.created_at),
            updated_at: new Date(row.updated_at)
        };
    } catch (error) {
        logger.error('Error toggling announcement active status:', error);
        throw error;
    }
}

// ==================== WORDLE TABLES ====================

/**
 * Wordle tablolarını oluştur
 */
export async function createWordleTables(): Promise<void> {
    const pool = getPostgresInstance();
    try {
        const wordleWordsQuery = `
            CREATE TABLE IF NOT EXISTS wordle_words (
                id SERIAL PRIMARY KEY,
                word TEXT NOT NULL UNIQUE
            );
            CREATE INDEX IF NOT EXISTS idx_wordle_words_id ON wordle_words (id);
        `;
        await pool.query(wordleWordsQuery);
        logger.info('Wordle words table created/verified successfully');

        const dailyGuessesQuery = `
            CREATE TABLE IF NOT EXISTS wordle_daily_guesses (
                user_id BIGINT NOT NULL,
                game_date DATE NOT NULL,
                guessed_correctly BOOLEAN NOT NULL DEFAULT false,
                attempts SMALLINT DEFAULT 0,
                PRIMARY KEY (user_id, game_date)
            );
            CREATE INDEX IF NOT EXISTS idx_wordle_daily_guesses_game_date ON wordle_daily_guesses (game_date);
        `;
        await pool.query(dailyGuessesQuery);
        logger.info('Wordle daily guesses table created/verified successfully');

        const weeklyScoresQuery = `
            CREATE TABLE IF NOT EXISTS wordle_weekly_scores (
                user_id BIGINT NOT NULL,
                week_start DATE NOT NULL,
                points INT NOT NULL DEFAULT 0,
                PRIMARY KEY (user_id, week_start)
            );
            CREATE INDEX IF NOT EXISTS idx_wordle_weekly_scores_week_start ON wordle_weekly_scores (week_start);
        `;
        await pool.query(weeklyScoresQuery);
        logger.info('Wordle weekly scores table created/verified successfully');

        // Tablo boşsa seed listesini yükle (önce proje kökündeki src/data, sonra dist/data dene)
        const countResult = await pool.query('SELECT COUNT(*)::int AS c FROM wordle_words');
        const count = countResult.rows[0]?.c ?? 0;
        if (count === 0) {
            const possiblePaths = [
                path.join(process.cwd(), 'src', 'data', 'wordle-words.json'),
                path.join(__dirname, '..', 'data', 'wordle-words.json'),
                path.join(__dirname, '..', '..', 'src', 'data', 'wordle-words.json'),
                path.join(process.cwd(), 'data', 'wordle-words.json')
            ];
            let wordsPath: string | null = null;
            for (const p of possiblePaths) {
                if (fs.existsSync(p)) {
                    wordsPath = p;
                    break;
                }
            }
            if (wordsPath) {
                const words: string[] = JSON.parse(fs.readFileSync(wordsPath, 'utf-8'));
                const inserted = await seedWordleWords(words);
                logger.info(`Wordle words seeded: ${inserted} words from ${wordsPath}`);
            } else {
                logger.warn('Wordle words seed file not found. Tried: ' + possiblePaths.join(', '));
            }
        }
    } catch (error) {
        logger.error('Error creating wordle tables:', error);
        throw error;
    }
}

const WORDLE_EPOCH = new Date('2020-01-01T00:00:00.000Z').getTime();
const TURKEY_TZ = 'Europe/Istanbul';

/**
 * Verilen tarihin Türkiye saatine göre oyun günü (YYYY-MM-DD) döndürür.
 */
export function getWordleGameDate(date: Date): string {
    const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: TURKEY_TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
    const parts = formatter.formatToParts(date);
    const year = parts.find(p => p.type === 'year')!.value;
    const month = parts.find(p => p.type === 'month')!.value;
    const day = parts.find(p => p.type === 'day')!.value;
    return `${year}-${month}-${day}`;
}

/**
 * Oyun gününden deterministik kelime index'i (1-1000) hesaplar.
 */
export function getWordleDayIndex(gameDate: string): number {
    const [y, m, d] = gameDate.split('-').map(Number);
    const dayStart = new Date(Date.UTC(y, m - 1, d)).getTime();
    const daysSinceEpoch = Math.floor((dayStart - WORDLE_EPOCH) / 86400000);
    const index = ((daysSinceEpoch % 1000) + 1000) % 1000;
    return index === 0 ? 1000 : index;
}

/**
 * Haftanın ilk günü (Pazartesi) YYYY-MM-DD. gameDate (YYYY-MM-DD) bu haftaya ait Pazartesi döner.
 */
export function getWordleWeekStartFromGameDate(gameDate: string): string {
    const [y, m, d] = gameDate.split('-').map(Number);
    const dObj = new Date(Date.UTC(y, m - 1, d));
    const dayOfWeek = dObj.getUTCDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(dObj);
    monday.setUTCDate(monday.getUTCDate() + mondayOffset);
    const year = monday.getUTCFullYear();
    const month = String(monday.getUTCMonth() + 1).padStart(2, '0');
    const day = String(monday.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Türkiye saatine göre haftanın ilk günü (Pazartesi) YYYY-MM-DD.
 */
export function getWordleWeekStart(date: Date): string {
    const gameDate = getWordleGameDate(date);
    return getWordleWeekStartFromGameDate(gameDate);
}

/**
 * Günün kelimesini getirir (sunucu tarafında; client'a gönderilmemeli).
 */
export async function getWordOfTheDay(gameDate: string): Promise<{ word: string; id: number } | null> {
    const pool = getPostgresInstance();
    const wordId = getWordleDayIndex(gameDate);
    const result = await pool.query('SELECT id, word FROM wordle_words WHERE id = $1', [wordId]);
    if (result.rows.length === 0) return null;
    return { id: result.rows[0].id, word: (result.rows[0].word as string).toLowerCase() };
}

/**
 * Kullanıcının bugünkü tahmin kaydını getirir.
 */
export async function getWordleDailyGuess(userId: string, gameDate: string): Promise<{ guessed_correctly: boolean; attempts: number } | null> {
    const pool = getPostgresInstance();
    const result = await pool.query(
        'SELECT guessed_correctly, attempts FROM wordle_daily_guesses WHERE user_id = $1 AND game_date = $2::date',
        [userId, gameDate]
    );
    if (result.rows.length === 0) return null;
    return { guessed_correctly: result.rows[0].guessed_correctly, attempts: result.rows[0].attempts || 0 };
}

/**
 * Kullanıcının günlük doğru tahminini kaydeder ve haftalık puana +1 ekler.
 */
export async function recordWordleCorrectGuess(userId: string, gameDate: string, attempts: number): Promise<void> {
    const pool = getPostgresInstance();
    const weekStart = getWordleWeekStartFromGameDate(gameDate);
    await pool.query(
        `INSERT INTO wordle_daily_guesses (user_id, game_date, guessed_correctly, attempts)
         VALUES ($1::bigint, $2::date, true, $3)
         ON CONFLICT (user_id, game_date) DO UPDATE SET guessed_correctly = true, attempts = $3`,
        [userId, gameDate, attempts]
    );
    await pool.query(
        `INSERT INTO wordle_weekly_scores (user_id, week_start, points)
         VALUES ($1::bigint, $2::date, 1)
         ON CONFLICT (user_id, week_start) DO UPDATE SET points = wordle_weekly_scores.points + 1`,
        [userId, weekStart]
    );
}

/**
 * Günlük tahmin denemesi kaydı (yanlış tahmin; attempts artırılır).
 */
export async function recordWordleAttempt(userId: string, gameDate: string): Promise<void> {
    const pool = getPostgresInstance();
    await pool.query(
        `INSERT INTO wordle_daily_guesses (user_id, game_date, guessed_correctly, attempts)
         VALUES ($1::bigint, $2::date, false, 1)
         ON CONFLICT (user_id, game_date) DO UPDATE SET attempts = wordle_daily_guesses.attempts + 1`,
        [userId, gameDate]
    );
}

/**
 * Haftalık sıralamayı getirir (username ile).
 */
export async function getWordleLeaderboard(weekStart: string, limit: number = 50): Promise<Array<{ rank: number; user_id: string; username: string; points: number }>> {
    const pool = getPostgresInstance();
    const result = await pool.query(
        `SELECT w.user_id, u.username, w.points
         FROM wordle_weekly_scores w
         JOIN users u ON u.id = w.user_id
         WHERE w.week_start = $1::date
         ORDER BY w.points DESC, u.username ASC
         LIMIT $2`,
        [weekStart, limit]
    );
    return result.rows.map((row, i) => ({
        rank: i + 1,
        user_id: String(row.user_id),
        username: row.username,
        points: parseInt(row.points, 10)
    }));
}

/**
 * Kullanıcının bir haftalık puanını getirir.
 */
export async function getWordleUserWeekPoints(userId: string, weekStart: string): Promise<number> {
    const pool = getPostgresInstance();
    const result = await pool.query(
        'SELECT points FROM wordle_weekly_scores WHERE user_id = $1::bigint AND week_start = $2::date',
        [userId, weekStart]
    );
    if (result.rows.length === 0) return 0;
    return parseInt(result.rows[0].points, 10);
}

/**
 * Kelimenin wordle_words içinde olup olmadığını kontrol eder (opsiyonel sözlük doğrulama).
 */
export async function isWordleWordValid(word: string): Promise<boolean> {
    const pool = getPostgresInstance();
    const normalized = word.toLowerCase().trim();
    if (normalized.length !== 5) return false;
    const result = await pool.query('SELECT 1 FROM wordle_words WHERE LOWER(word) = $1', [normalized]);
    return result.rows.length > 0;
}

/**
 * wordle_words tablosuna kelime listesi ekler (seed). Tabloda kayıt varsa atlar.
 */
export async function seedWordleWords(words: string[]): Promise<number> {
    const pool = getPostgresInstance();
    let inserted = 0;
    for (let i = 0; i < words.length; i++) {
        const word = words[i].trim().toLowerCase();
        if (word.length !== 5) continue;
        const id = i + 1;
        const result = await pool.query(
            'INSERT INTO wordle_words (id, word) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING RETURNING id',
            [id, word]
        );
        if (result.rowCount && result.rowCount > 0) inserted++;
    }
    return inserted;
}

// ==================== KIM KREDINER OLMAK İSTER ====================

/**
 * Kim Krediner Olmak İster tablolarını oluşturur.
 */
export async function createKimKredinerTables(): Promise<void> {
    const pool = getPostgresInstance();
    try {
        const questionsQuery = `
            CREATE TABLE IF NOT EXISTS kim_krediner_questions (
                id SERIAL PRIMARY KEY,
                question_text TEXT NOT NULL,
                option_a TEXT NOT NULL,
                option_b TEXT NOT NULL,
                option_c TEXT NOT NULL,
                option_d TEXT NOT NULL,
                correct_answer CHAR(1) NOT NULL CHECK (correct_answer IN ('A','B','C','D')),
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_kim_krediner_questions_id ON kim_krediner_questions (id);
        `;
        await pool.query(questionsQuery);
        logger.info('Kim Krediner questions table created/verified successfully');

        const sessionsQuery = `
            CREATE TABLE IF NOT EXISTS kim_krediner_daily_sessions (
                user_id BIGINT NOT NULL,
                game_date DATE NOT NULL,
                question_ids INT[] NOT NULL,
                current_index SMALLINT NOT NULL DEFAULT 0,
                score SMALLINT NOT NULL DEFAULT 0,
                status TEXT NOT NULL CHECK (status IN ('in_progress','completed','failed')),
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW(),
                PRIMARY KEY (user_id, game_date)
            );
            CREATE INDEX IF NOT EXISTS idx_kim_krediner_daily_sessions_game_date ON kim_krediner_daily_sessions (game_date);
        `;
        await pool.query(sessionsQuery);
        logger.info('Kim Krediner daily sessions table created/verified successfully');

        const weeklyQuery = `
            CREATE TABLE IF NOT EXISTS kim_krediner_weekly_scores (
                user_id BIGINT NOT NULL,
                week_start DATE NOT NULL,
                points INT NOT NULL DEFAULT 0,
                PRIMARY KEY (user_id, week_start)
            );
            CREATE INDEX IF NOT EXISTS idx_kim_krediner_weekly_scores_week_start ON kim_krediner_weekly_scores (week_start);
        `;
        await pool.query(weeklyQuery);
        logger.info('Kim Krediner weekly scores table created/verified successfully');

        const countResult = await pool.query('SELECT COUNT(*)::int AS c FROM kim_krediner_questions');
        const count = countResult.rows[0]?.c ?? 0;
        if (count === 0) {
            const possiblePaths = [
                path.join(process.cwd(), 'src', 'data', 'kim-krediner-questions.json'),
                path.join(__dirname, '..', 'data', 'kim-krediner-questions.json'),
                path.join(process.cwd(), 'data', 'kim-krediner-questions.json')
            ];
            let jsonPath: string | null = null;
            for (const p of possiblePaths) {
                if (fs.existsSync(p)) {
                    jsonPath = p;
                    break;
                }
            }
            if (jsonPath) {
                const inserted = await seedKimKredinerQuestions(jsonPath);
                logger.info(`Kim Krediner questions seeded: ${inserted} from ${jsonPath}`);
            } else {
                logger.warn('Kim Krediner questions seed file not found. Tried: ' + possiblePaths.join(', '));
            }
        }
    } catch (error) {
        logger.error('Error creating Kim Krediner tables:', error);
        throw error;
    }
}

export function getKimKredinerGameDate(date: Date): string {
    return getWordleGameDate(date);
}

export function getKimKredinerWeekStart(date: Date): string {
    return getWordleWeekStart(date);
}

export async function seedKimKredinerQuestions(jsonPath: string): Promise<number> {
    const pool = getPostgresInstance();
    const raw = fs.readFileSync(jsonPath, 'utf-8');
    const items: Array<{ question_text: string; option_a: string; option_b: string; option_c: string; option_d: string; correct_answer: string }> = JSON.parse(raw);
    let inserted = 0;
    for (const q of items) {
        const ans = (q.correct_answer || 'A').toUpperCase();
        if (!['A','B','C','D'].includes(ans)) continue;
        const result = await pool.query(
            `INSERT INTO kim_krediner_questions (question_text, option_a, option_b, option_c, option_d, correct_answer)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
                (q.question_text || '').trim(),
                (q.option_a || '').trim(),
                (q.option_b || '').trim(),
                (q.option_c || '').trim(),
                (q.option_d || '').trim(),
                ans
            ]
        );
        if (result.rowCount && result.rowCount > 0) inserted++;
    }
    return inserted;
}

export async function hasPlayedKimKredinerToday(userId: string, gameDate: string): Promise<boolean> {
    const pool = getPostgresInstance();
    const result = await pool.query(
        'SELECT 1 FROM kim_krediner_daily_sessions WHERE user_id = $1::bigint AND game_date = $2::date',
        [userId, gameDate]
    );
    return result.rows.length > 0;
}

export async function getKimKredinerSession(userId: string, gameDate: string): Promise<{
    question_ids: number[];
    current_index: number;
    score: number;
    status: string;
} | null> {
    const pool = getPostgresInstance();
    const result = await pool.query(
        'SELECT question_ids, current_index, score, status FROM kim_krediner_daily_sessions WHERE user_id = $1::bigint AND game_date = $2::date',
        [userId, gameDate]
    );
    if (result.rows.length === 0) return null;
    const r = result.rows[0];
    return {
        question_ids: Array.isArray(r.question_ids) ? r.question_ids : [],
        current_index: parseInt(r.current_index, 10) || 0,
        score: parseInt(r.score, 10) || 0,
        status: r.status || 'in_progress'
    };
}

export async function getKimKredinerQuestionById(questionId: number): Promise<{
    id: number;
    question_text: string;
    option_a: string;
    option_b: string;
    option_c: string;
    option_d: string;
} | null> {
    const pool = getPostgresInstance();
    const result = await pool.query(
        'SELECT id, question_text, option_a, option_b, option_c, option_d FROM kim_krediner_questions WHERE id = $1',
        [questionId]
    );
    if (result.rows.length === 0) return null;
    const r = result.rows[0];
    return {
        id: r.id,
        question_text: r.question_text,
        option_a: r.option_a,
        option_b: r.option_b,
        option_c: r.option_c,
        option_d: r.option_d
    };
}

export async function getKimKredinerCorrectAnswer(questionId: number): Promise<string | null> {
    const pool = getPostgresInstance();
    const result = await pool.query('SELECT correct_answer FROM kim_krediner_questions WHERE id = $1', [questionId]);
    if (result.rows.length === 0) return null;
    return result.rows[0].correct_answer;
}

export async function getOrCreateKimKredinerSession(userId: string, gameDate: string): Promise<{
    session: { question_ids: number[]; current_index: number; score: number; status: string };
    firstQuestion: { id: number; question_text: string; option_a: string; option_b: string; option_c: string; option_d: string };
} | null> {
    const pool = getPostgresInstance();
    const existing = await getKimKredinerSession(userId, gameDate);
    if (existing) return null;

    const idsResult = await pool.query(
        'SELECT id FROM kim_krediner_questions ORDER BY RANDOM() LIMIT 10'
    );
    const questionIds: number[] = idsResult.rows.map((r: { id: number }) => r.id);
    if (questionIds.length < 10) return null;

    await pool.query(
        `INSERT INTO kim_krediner_daily_sessions (user_id, game_date, question_ids, current_index, score, status)
         VALUES ($1::bigint, $2::date, $3::int[], 0, 0, 'in_progress')`,
        [userId, gameDate, questionIds]
    );

    const firstQ = await getKimKredinerQuestionById(questionIds[0]);
    if (!firstQ) return null;

    return {
        session: { question_ids: questionIds, current_index: 0, score: 0, status: 'in_progress' },
        firstQuestion: firstQ
    };
}

export async function submitKimKredinerAnswer(
    userId: string,
    gameDate: string,
    answer: string,
    timedOut?: boolean
): Promise<{
    correct: boolean;
    nextQuestion: { id: number; question_text: string; option_a: string; option_b: string; option_c: string; option_d: string } | null;
    gameOver: boolean;
    score: number;
    status: string;
}> {
    const pool = getPostgresInstance();
    const session = await getKimKredinerSession(userId, gameDate);
    if (!session || session.status !== 'in_progress') {
        return {
            correct: false,
            nextQuestion: null,
            gameOver: true,
            score: session?.score ?? 0,
            status: session?.status ?? 'failed'
        };
    }

    const idx = session.current_index;
    const questionId = session.question_ids[idx];
    const correctAnswer = await getKimKredinerCorrectAnswer(questionId);
    const normalized = (answer || '').toUpperCase().trim();
    const correct = !timedOut && correctAnswer === normalized;

    let newScore = session.score;
    let newStatus = session.status;
    let newIndex = idx;

    if (correct) {
        newScore += 1;
        newIndex += 1;
        if (newIndex >= 10) {
            newStatus = 'completed';
        }
    } else {
        newStatus = 'failed';
    }

    await pool.query(
        `UPDATE kim_krediner_daily_sessions SET current_index = $1, score = $2, status = $3, updated_at = NOW()
         WHERE user_id = $4::bigint AND game_date = $5::date`,
        [newIndex, newScore, newStatus, userId, gameDate]
    );

    if (newStatus === 'completed' || newStatus === 'failed') {
        const weekStart = getWordleWeekStartFromGameDate(gameDate);
        await pool.query(
            `INSERT INTO kim_krediner_weekly_scores (user_id, week_start, points)
             VALUES ($1::bigint, $2::date, $3)
             ON CONFLICT (user_id, week_start) DO UPDATE SET points = kim_krediner_weekly_scores.points + $3`,
            [userId, weekStart, newScore]
        );
    }

    let nextQuestion: { id: number; question_text: string; option_a: string; option_b: string; option_c: string; option_d: string } | null = null;
    if (correct && newIndex < 10) {
        const nextId = session.question_ids[newIndex];
        nextQuestion = await getKimKredinerQuestionById(nextId);
    }

    return {
        correct,
        nextQuestion,
        gameOver: newStatus !== 'in_progress',
        score: newScore,
        status: newStatus
    };
}

export async function getKimKredinerLeaderboard(weekStart: string, limit: number = 50): Promise<Array<{ rank: number; user_id: string; username: string; points: number }>> {
    const pool = getPostgresInstance();
    const result = await pool.query(
        `SELECT k.user_id, u.username, k.points
         FROM kim_krediner_weekly_scores k
         JOIN users u ON u.id = k.user_id
         WHERE k.week_start = $1::date
         ORDER BY k.points DESC, u.username ASC
         LIMIT $2`,
        [weekStart, limit]
    );
    return result.rows.map((row: any, i: number) => ({
        rank: i + 1,
        user_id: String(row.user_id),
        username: row.username,
        points: parseInt(row.points, 10)
    }));
}

export async function getKimKredinerUserWeekPoints(userId: string, weekStart: string): Promise<number> {
    const pool = getPostgresInstance();
    const result = await pool.query(
        'SELECT points FROM kim_krediner_weekly_scores WHERE user_id = $1::bigint AND week_start = $2::date',
        [userId, weekStart]
    );
    if (result.rows.length === 0) return 0;
    return parseInt(result.rows[0].points, 10);
}

// ==================== KİM KREDİNER OLMAK İSTER (plan: krediner_*) ====================

export async function createKredinerTables(): Promise<void> {
    const pool = getPostgresInstance();
    await pool.query(`
        CREATE TABLE IF NOT EXISTS krediner_questions (
            id SERIAL PRIMARY KEY,
            question_text TEXT NOT NULL,
            option_a TEXT NOT NULL,
            option_b TEXT NOT NULL,
            option_c TEXT NOT NULL,
            option_d TEXT NOT NULL,
            correct_option CHAR(1) NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_krediner_questions_id ON krediner_questions (id);

        CREATE TABLE IF NOT EXISTS krediner_daily_scores (
            user_id BIGINT NOT NULL,
            game_date DATE NOT NULL,
            score SMALLINT NOT NULL,
            PRIMARY KEY (user_id, game_date)
        );
        CREATE INDEX IF NOT EXISTS idx_krediner_daily_scores_game_date ON krediner_daily_scores (game_date);

        CREATE TABLE IF NOT EXISTS krediner_game_sessions (
            id UUID PRIMARY KEY,
            user_id BIGINT NOT NULL,
            game_date DATE NOT NULL,
            question_ids JSONB NOT NULL,
            current_index SMALLINT NOT NULL,
            score_so_far SMALLINT NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_krediner_game_sessions_user_date ON krediner_game_sessions (user_id, game_date);
    `);
    const countResult = await pool.query('SELECT COUNT(*)::int AS c FROM krediner_questions');
    const count = countResult.rows[0]?.c ?? 0;
    if (count === 0) {
        const jsonPaths = [
            path.join(process.cwd(), 'src', 'data', 'krediner-questions.json'),
            path.join(__dirname, '..', 'data', 'krediner-questions.json'),
            path.join(process.cwd(), 'data', 'krediner-questions.json')
        ];
        let jsonPath: string | null = null;
        for (const p of jsonPaths) {
            if (fs.existsSync(p)) {
                jsonPath = p;
                break;
            }
        }
        if (jsonPath) {
            const raw = fs.readFileSync(jsonPath, 'utf-8');
            const items: Array<{ question: string; option_a: string; option_b: string; option_c: string; option_d: string; correct: string }> = JSON.parse(raw);
            for (const q of items) {
                const ans = (q.correct || 'A').toUpperCase();
                if (!['A', 'B', 'C', 'D'].includes(ans)) continue;
                await pool.query(
                    `INSERT INTO krediner_questions (question_text, option_a, option_b, option_c, option_d, correct_option)
                     VALUES ($1, $2, $3, $4, $5, $6)`,
                    [(q.question || '').trim(), (q.option_a || '').trim(), (q.option_b || '').trim(), (q.option_c || '').trim(), (q.option_d || '').trim(), ans]
                );
            }
            logger.info('Krediner questions seeded from ' + jsonPath);
        }
    }
    logger.info('Krediner tables created/verified successfully');
}

export async function getKredinerRandomQuestionIds(count: number): Promise<number[]> {
    const pool = getPostgresInstance();
    const result = await pool.query(
        'SELECT id FROM krediner_questions ORDER BY RANDOM() LIMIT $1',
        [count]
    );
    return result.rows.map((r: { id: number }) => r.id);
}

export async function getKredinerQuestionById(id: number): Promise<{
    id: number;
    question_text: string;
    option_a: string;
    option_b: string;
    option_c: string;
    option_d: string;
} | null> {
    const pool = getPostgresInstance();
    const result = await pool.query(
        'SELECT id, question_text, option_a, option_b, option_c, option_d FROM krediner_questions WHERE id = $1',
        [id]
    );
    if (result.rows.length === 0) return null;
    const r = result.rows[0];
    return {
        id: r.id,
        question_text: r.question_text,
        option_a: r.option_a,
        option_b: r.option_b,
        option_c: r.option_c,
        option_d: r.option_d
    };
}

export async function getKredinerCorrectOption(questionId: number): Promise<string | null> {
    const pool = getPostgresInstance();
    const result = await pool.query('SELECT correct_option FROM krediner_questions WHERE id = $1', [questionId]);
    if (result.rows.length === 0) return null;
    return result.rows[0].correct_option;
}

export async function hasKredinerPlayedToday(userId: string, gameDate: string): Promise<boolean> {
    const pool = getPostgresInstance();
    const result = await pool.query(
        'SELECT 1 FROM krediner_daily_scores WHERE user_id = $1::bigint AND game_date = $2::date',
        [userId, gameDate]
    );
    return result.rows.length > 0;
}

export async function getKredinerTodayScore(userId: string, gameDate: string): Promise<number | null> {
    const pool = getPostgresInstance();
    const result = await pool.query(
        'SELECT score FROM krediner_daily_scores WHERE user_id = $1::bigint AND game_date = $2::date',
        [userId, gameDate]
    );
    if (result.rows.length === 0) return null;
    return result.rows[0].score;
}

export async function createKredinerSession(userId: string, gameDate: string, questionIds: number[]): Promise<string> {
    const pool = getPostgresInstance();
    const id = randomUUID();
    await pool.query(
        `INSERT INTO krediner_game_sessions (id, user_id, game_date, question_ids, current_index, score_so_far)
         VALUES ($1, $2::bigint, $3::date, $4::jsonb, 0, 0)`,
        [id, userId, gameDate, JSON.stringify(questionIds)]
    );
    return id;
}

export async function getKredinerSession(sessionId: string): Promise<{
    id: string;
    user_id: string;
    game_date: string;
    question_ids: number[];
    current_index: number;
    score_so_far: number;
} | null> {
    const pool = getPostgresInstance();
    const result = await pool.query(
        'SELECT id, user_id, game_date, question_ids, current_index, score_so_far FROM krediner_game_sessions WHERE id = $1',
        [sessionId]
    );
    if (result.rows.length === 0) return null;
    const r = result.rows[0];
    return {
        id: r.id,
        user_id: String(r.user_id),
        game_date: r.game_date,
        question_ids: r.question_ids,
        current_index: r.current_index,
        score_so_far: r.score_so_far
    };
}

export function validateKredinerAnswer(questionId: number, selectedLetter: string): Promise<boolean> {
    const letter = (selectedLetter || '').toUpperCase();
    if (!['A', 'B', 'C', 'D'].includes(letter)) return Promise.resolve(false);
    return getKredinerCorrectOption(questionId).then((correct) => correct === letter);
}

export async function advanceKredinerSession(
    sessionId: string,
    correct: boolean
): Promise<{ game_over: boolean; score: number }> {
    const pool = getPostgresInstance();
    const session = await getKredinerSession(sessionId);
    if (!session) {
        throw new Error('Session not found');
    }
    if (correct) {
        const newScore = session.score_so_far + 1;
        const newIndex = session.current_index + 1;
        if (newIndex >= session.question_ids.length) {
            await pool.query('DELETE FROM krediner_game_sessions WHERE id = $1', [sessionId]);
            await pool.query(
                `INSERT INTO krediner_daily_scores (user_id, game_date, score) VALUES ($1::bigint, $2::date, $3)
                 ON CONFLICT (user_id, game_date) DO UPDATE SET score = $3`,
                [session.user_id, session.game_date, newScore]
            );
            return { game_over: true, score: newScore };
        }
        await pool.query(
            'UPDATE krediner_game_sessions SET current_index = $1, score_so_far = $2 WHERE id = $3',
            [newIndex, newScore, sessionId]
        );
        return { game_over: false, score: newScore };
    } else {
        const score = session.score_so_far;
        await pool.query('DELETE FROM krediner_game_sessions WHERE id = $1', [sessionId]);
        await pool.query(
            `INSERT INTO krediner_daily_scores (user_id, game_date, score) VALUES ($1::bigint, $2::date, $3)
             ON CONFLICT (user_id, game_date) DO UPDATE SET score = $3`,
            [session.user_id, session.game_date, score]
        );
        return { game_over: true, score };
    }
}

export async function finishKredinerGame(sessionId: string, finalScore: number): Promise<void> {
    const session = await getKredinerSession(sessionId);
    if (!session) return;
    const pool = getPostgresInstance();
    await pool.query('DELETE FROM krediner_game_sessions WHERE id = $1', [sessionId]);
    await pool.query(
        `INSERT INTO krediner_daily_scores (user_id, game_date, score) VALUES ($1::bigint, $2::date, $3)
         ON CONFLICT (user_id, game_date) DO UPDATE SET score = $3`,
        [session.user_id, session.game_date, finalScore]
    );
}

export async function getKredinerLeaderboard(
    weekStart: string,
    limit: number = 50
): Promise<Array<{ rank: number; user_id: string; username: string; points: number }>> {
    const pool = getPostgresInstance();
    const result = await pool.query(
        `SELECT u.id AS user_id, u.username, COALESCE(SUM(k.score), 0)::int AS total
         FROM users u
         INNER JOIN krediner_daily_scores k ON k.user_id = u.id
         WHERE k.game_date >= $1::date AND k.game_date < $1::date + INTERVAL '7 days'
         GROUP BY u.id, u.username
         ORDER BY total DESC
         LIMIT $2`,
        [weekStart, limit]
    );
    return result.rows.map((r: any, i: number) => ({
        rank: i + 1,
        user_id: String(r.user_id),
        username: r.username ?? '',
        points: parseInt(r.total, 10)
    }));
}

export async function getKredinerUserWeekPoints(userId: string, weekStart: string): Promise<number> {
    const pool = getPostgresInstance();
    const result = await pool.query(
        `SELECT COALESCE(SUM(score), 0)::int AS total FROM krediner_daily_scores
         WHERE user_id = $1::bigint AND game_date >= $2::date AND game_date < $2::date + INTERVAL '7 days'`,
        [userId, weekStart]
    );
    return result.rows[0]?.total ?? 0;
}

// ==================== BULK PROMOTION SCHEDULE ====================

/**
 * Haftalık toplu terfi takvimi tablosu (eş sahip ve üstleri slotlara kendini yazar).
 */
export async function createBulkPromotionScheduleTable(): Promise<void> {
    const pool = getPostgresInstance();
    await pool.query(`
        CREATE TABLE IF NOT EXISTS bulk_promotion_schedule (
            week_start DATE NOT NULL,
            day_of_week SMALLINT NOT NULL,
            time_slot VARCHAR(5) NOT NULL,
            user_id BIGINT NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            PRIMARY KEY (week_start, day_of_week, time_slot)
        );
        CREATE INDEX IF NOT EXISTS idx_bulk_promotion_schedule_week ON bulk_promotion_schedule (week_start);
    `);
    logger.info('Bulk promotion schedule table created/verified successfully');
}

export interface BulkPromotionScheduleSlot {
    day_of_week: number;
    time_slot: string;
    user_id: string | null;
    username: string | null;
}

/**
 * Bir haftanın takvim atamalarını getirir (JOIN users ile username).
 */
export async function getBulkPromotionSchedule(weekStart: string): Promise<BulkPromotionScheduleSlot[]> {
    const pool = getPostgresInstance();
    const result = await pool.query(
        `WITH slots AS (
           SELECT d.day_of_week, t.time_slot
           FROM (VALUES (1),(2),(3),(4),(5),(6),(7)) d(day_of_week),
                (VALUES ('12:00'),('15:00'),('16:00'),('18:00'),('20:00'),('22:00')) t(time_slot)
         )
         SELECT s.day_of_week, s.time_slot, b.user_id, u.username
         FROM slots s
         LEFT JOIN bulk_promotion_schedule b ON b.week_start = $1::date AND b.day_of_week = s.day_of_week AND b.time_slot = s.time_slot
         LEFT JOIN users u ON u.id = b.user_id
         ORDER BY s.day_of_week, s.time_slot`,
        [weekStart]
    );
    return result.rows.map((r: any) => ({
        day_of_week: r.day_of_week,
        time_slot: r.time_slot,
        user_id: r.user_id != null ? String(r.user_id) : null,
        username: r.username ?? null
    }));
}

/**
 * Bir slot için kullanıcıyı atar (varsa üzerine yazar).
 */
export async function setBulkPromotionScheduleSlot(weekStart: string, dayOfWeek: number, timeSlot: string, userId: string): Promise<void> {
    const pool = getPostgresInstance();
    const validSlots = ['12:00', '15:00', '16:00', '18:00', '20:00', '22:00'];
    if (!validSlots.includes(timeSlot) || dayOfWeek < 1 || dayOfWeek > 7) {
        throw new Error('Invalid slot');
    }
    if ((timeSlot === '12:00' || timeSlot === '15:00') && dayOfWeek >= 1 && dayOfWeek <= 5) {
        throw new Error('12:00 and 15:00 are only valid on weekends');
    }
    if (timeSlot === '16:00' && (dayOfWeek === 6 || dayOfWeek === 7)) {
        throw new Error('16:00 is only valid on weekdays');
    }
    await pool.query(
        `INSERT INTO bulk_promotion_schedule (week_start, day_of_week, time_slot, user_id)
         VALUES ($1::date, $2, $3, $4::bigint)
         ON CONFLICT (week_start, day_of_week, time_slot) DO UPDATE SET user_id = $4::bigint, created_at = NOW()`,
        [weekStart, dayOfWeek, timeSlot, userId]
    );
}

/**
 * Kullanıcı kendi atamasını kaldırır (sadece kendi user_id ise silinir).
 */
export async function unclaimBulkPromotionScheduleSlot(weekStart: string, dayOfWeek: number, timeSlot: string, userId: string): Promise<boolean> {
    const pool = getPostgresInstance();
    const result = await pool.query(
        'DELETE FROM bulk_promotion_schedule WHERE week_start = $1::date AND day_of_week = $2 AND time_slot = $3 AND user_id = $4::bigint',
        [weekStart, dayOfWeek, timeSlot, userId]
    );
    return (result.rowCount ?? 0) > 0;
}

/**
 * Yüksek rütbe sohbet tablosu (eş sahip ve üstleri genel sohbet).
 */
export async function createHighRankChatTable(): Promise<void> {
    const pool = getPostgresInstance();
    await pool.query(`
        CREATE TABLE IF NOT EXISTS high_rank_chat (
            id BIGSERIAL PRIMARY KEY,
            user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            message TEXT NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_high_rank_chat_created_at ON high_rank_chat (created_at DESC);
    `);
    logger.info('High rank chat table created/verified successfully');
}

export interface HighRankChatMessage {
    id: number;
    user_id: number;
    username: string | null;
    message: string;
    created_at: string;
}

export async function getHighRankChatMessages(limit: number = 100, beforeId?: number): Promise<HighRankChatMessage[]> {
    const pool = getPostgresInstance();
    let query: string;
    let params: any[];
    if (beforeId != null) {
        query = `SELECT c.id, c.user_id, u.username, c.message, c.created_at
                 FROM high_rank_chat c
                 LEFT JOIN users u ON u.id = c.user_id
                 WHERE c.id < $1
                 ORDER BY c.id DESC
                 LIMIT $2`;
        params = [beforeId, limit];
    } else {
        query = `SELECT c.id, c.user_id, u.username, c.message, c.created_at
                 FROM high_rank_chat c
                 LEFT JOIN users u ON u.id = c.user_id
                 ORDER BY c.id DESC
                 LIMIT $1`;
        params = [limit];
    }
    const result = await pool.query(query, params);
    return result.rows.map((r: any) => ({
        id: Number(r.id),
        user_id: Number(r.user_id),
        username: r.username ?? null,
        message: r.message,
        created_at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    })).reverse(); // en eski önce (yukarıda), en yeni en altta
}

export async function insertHighRankChatMessage(userId: string, message: string): Promise<HighRankChatMessage> {
    const pool = getPostgresInstance();
    const trimmed = (message || '').trim();
    if (trimmed.length === 0) throw new Error('Message cannot be empty');
    if (trimmed.length > 2000) throw new Error('Message too long');
    const result = await pool.query(
        `INSERT INTO high_rank_chat (user_id, message) VALUES ($1::bigint, $2) RETURNING id, user_id, message, created_at`,
        [userId, trimmed]
    );
    const r = result.rows[0];
    const usernameResult = await pool.query('SELECT username FROM users WHERE id = $1', [userId]);
    const username = usernameResult.rows[0]?.username ?? null;
    return {
        id: Number(r.id),
        user_id: Number(r.user_id),
        username,
        message: r.message,
        created_at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    };
}

export async function updateHighRankChatMessage(messageId: number, userId: string, message: string): Promise<HighRankChatMessage | null> {
    const pool = getPostgresInstance();
    const trimmed = (message || '').trim();
    if (trimmed.length === 0) throw new Error('Message cannot be empty');
    if (trimmed.length > 2000) throw new Error('Message too long');
    const result = await pool.query(
        `UPDATE high_rank_chat SET message = $3, created_at = NOW() WHERE id = $1 AND user_id = $2::bigint RETURNING id, user_id, message, created_at`,
        [messageId, userId, trimmed]
    );
    if (!result.rows.length) return null;
    const r = result.rows[0];
    const usernameResult = await pool.query('SELECT username FROM users WHERE id = $1', [userId]);
    const username = usernameResult.rows[0]?.username ?? null;
    return {
        id: Number(r.id),
        user_id: Number(r.user_id),
        username,
        message: r.message,
        created_at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    };
}

export async function deleteHighRankChatMessage(messageId: number, userId: string): Promise<boolean> {
    const pool = getPostgresInstance();
    const result = await pool.query(
        'DELETE FROM high_rank_chat WHERE id = $1 AND user_id = $2::bigint',
        [messageId, userId]
    );
    return (result.rowCount ?? 0) > 0;
}