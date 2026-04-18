import { getPostgresInstance } from './postgres';
import { createLogger, LogLevel } from '../logger';

const logger = createLogger({
    logLevel: LogLevel.DEBUG,
    writeToFile: true,
    logFilePath: '../logs/oauth.log',
    module: "OAuth"
});

/**
 * Get Habbo username from Discord ID using OAuth link
 */
export async function getOAuthUsername(discordId: string): Promise<string | null> {
    try {
        const pool = getPostgresInstance();
        const query = `
            SELECT username 
            FROM oauth_links 
            WHERE discord_id = $1 
            AND verified = true
            ORDER BY created_at DESC 
            LIMIT 1
        `;
        
        const result = await pool.query(query, [discordId]);
        
        if (result.rows.length > 0) {
            return result.rows[0].username;
        }
        
        return null;
    } catch (error) {
        logger.error('Error getting OAuth username:', error);
        return null;
    }
}