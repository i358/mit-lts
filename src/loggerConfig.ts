import { LogLevel, createLogger, systemLogger, apiLogger, proxyLogger, discordLogger } from './logger';

// Config'ten gelen log level'ları logger'lara uygulama
export function configureLoggers(config: any): void {
    // System logger'ı genel app log level ile yapılandır
    systemLogger.setLogLevel(config.app.LOG_LEVEL);
    
    // API logger'ı yapılandır
    if (config.api.ACTIVE) {
        apiLogger.setLogLevel(config.api.LOG_LEVEL);
    }
    
    // Proxy logger'ı yapılandır
    if (config.proxy.ACTIVE) {
        proxyLogger.setLogLevel(config.proxy.LOG_LEVEL);
    }
    
    // Discord logger'ı yapılandır
    if (config.app.DISCORD_BOT.ACTIVE) {
        discordLogger.setLogLevel(config.app.DISCORD_BOT.LOG_LEVEL);
    }
}

// Kullanım kolaylığı için export edilen logger'lar
export {
    LogLevel,
    createLogger,
    systemLogger,
    apiLogger, 
    proxyLogger,
    discordLogger
};

// Kullanım örnekleri:
/*
import { configureLoggers, systemLogger, apiLogger } from './loggerConfig';
import config from './config'; // config dosyanızı import edin

// Logger'ları yapılandır
configureLoggers(config);

// Kullanım
systemLogger.info('Uygulama başlatıldı');
systemLogger.debug('Debug bilgisi', { userId: 123, action: 'login' });
systemLogger.error('Bir hata oluştu', error);

apiLogger.info('API endpoint çağrıldı', { endpoint: '/users', method: 'GET' });
apiLogger.warn('Rate limit yaklaşıldı', { remainingRequests: 10 });
*/
