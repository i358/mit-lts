export interface APIConfig {
    ACTIVE: boolean;
    HOST: string;
    PORT: number;
    VERSION: string;
    BASE_PATH: string;
    CORS_CONFIG: {
        origin: string[];
        methods: string[];
        allowedHeaders: string[];
        credentials: boolean;
    };
    RATE_LIMIT: {
        MAX: number;
        TIME_WINDOW: string;
    };
    GRAPHQL: {
        ENABLED: boolean;
        PLAYGROUND: boolean;
        INTROSPECTION: boolean;
        SUBSCRIPTIONS: boolean;
        ENDPOINT: string;
    };
    REST: {
        ENABLED: boolean;
        ENDPOINT: string;
    };
    SECURITY: {
        JWT_SECRET: string;
        TOKEN_EXPIRY: string;
    };
    EPOCH: number;
    MAX_REQUEST_LIMIT: number;
    TIMEOUT: number;
    LOG_LEVEL: string;
}