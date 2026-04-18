// # LOOK .env FOR DATABASE CONFIGURATION
// # LOOK config.yaml FOR OTHER CONFIGURATION

import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";
import { LogLevel } from "./logger";

interface Config {
 app: {
    INITIALIZED: boolean;
    ENVIRONMENT: 'development' | 'production' | 'test';
    PRODUCTION_NAME: string;
    MAIN_ROOM_ID: number | null;
    LOG_LEVEL: LogLevel;
    SPOTTER: {
        ID: string | null;
    };
    DISCORD_BOT:{
        ACTIVE: boolean;
        GUILD_ID: string | null;
        CLIENT_ID: string | null;
        CHANNELS: {
            LOGS: number;
            EVENTS: number; 
            COMMANDS: number;
            BADGE_LOG: number;
            DEMOTE_LOG: number;
            MULTIBADGE_LOG: number;
            SITE_LOG: number;
            TRAINING_LOG: number;
        }
        ADMINS: string[];
        LOG_LEVEL: LogLevel;
    }
 };
 paths: {
    API_DIR: string;
    PROXY_DIR: string;
    LOGS_DIR?: string;
    TEMP_DIR?: string;
    BOT_DIR?: string;
    CACHE_DIR: string;
 };
 proxy: {
    ACTIVE: boolean;
     LOG_LEVEL: LogLevel;
 };
 api: {
    ACTIVE: boolean;
    HOST: string;
    PORT: number;
    VERSION: string;
    BASE_PATH: string;
    LOG_LEVEL: LogLevel;
    EPOCH: number;
    CORS_CONFIG: {
        origin: string[];
        methods: string[];
        allowedHeaders: string[];
        credentials: boolean;
    };

    GRAPHQL?: {
        ENABLED: boolean;
        ENDPOINT: string;
        PLAYGROUND: boolean;
        INTROSPECTION: boolean;
        SUBSCRIPTIONS: boolean;
    };

    REST?: {
        ENABLED: boolean;
        ENDPOINT: string;
    };

    SECURITY?: {
        JWT_SECRET: string;
        TOKEN_EXPIRY: string;
    };

    RATE_LIMIT?: {
        MAX_REQUESTS: number;
        WINDOW_MS: number;
    };
 }
}

export function config(): Config{
    try {
        const fileContents = fs.readFileSync(path.join(__dirname, './config.yaml'), 'utf8');
        const data = yaml.load(fileContents) as Config;
        return data;
    }catch(e){
        throw new Error("Failed to load configuration file: " + e);
    }
}