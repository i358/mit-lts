import { configChecker, ConfigChecker } from '../src/utils/configChecker';
import { systemLogger, createLogger, LogLevel } from '../src/logger';

// Test için özel logger
const testLogger = createLogger({
    logLevel: LogLevel.DEBUG,
    writeToFile: true,
    logFilePath: './logs/config-checker-test.log',
    module: 'CONFIG_TEST'
});

async function testConfigChecker(): Promise<void> {
    testLogger.info('=== CONFIG CHECKER TEST BAŞLADI ===');
    
    try {
        // 1. Singleton instance test
        testLogger.info('1. Singleton ConfigChecker Test');
        testLogger.debug('Config checker instance oluşturuluyor...');
        
        const systemStatus = configChecker.system;
        testLogger.info('Sistem durumu alındı', {
            initialized: systemStatus.initialized,
            environment: systemStatus.environment
        });
        
        // 2. Servis durumlarını test et
        testLogger.info('2. Servis Durumları Test');
        
        const proxyStatus = configChecker.checkService('proxy');
        testLogger.info('Proxy servisi durumu', {
            active: proxyStatus.active,
            logLevel: proxyStatus.logLevel
        });
        
        const apiStatus = configChecker.checkService('api');
        testLogger.info('API servisi durumu', {
            active: apiStatus.active,
            logLevel: apiStatus.logLevel
        });
        
        const discordStatus = configChecker.checkService('discord');
        testLogger.info('Discord servisi durumu', {
            active: discordStatus.active,
            logLevel: discordStatus.logLevel
        });
        
        // 3. Bilinmeyen servis test
        testLogger.info('3. Bilinmeyen Servis Test');
        const unknownService = configChecker.checkService('nonexistent');
        testLogger.warn('Bilinmeyen servis sorgulandı', {
            service: 'nonexistent',
            active: unknownService.active,
            logLevel: unknownService.logLevel
        });
        
        // 4. Tüm servisleri al
        testLogger.info('4. Tüm Servisler Test');
        const allServices = configChecker.getAllServices();
        testLogger.info('Tüm servisler alındı', allServices);
        
        // 5. Sistem hazırlık durumu test
        testLogger.info('5. Sistem Hazırlık Test');
        const systemReady = configChecker.isSystemReady();
        testLogger.info('Sistem hazırlık durumu', { ready: systemReady });
        
        // 6. Tam sistem özeti
        testLogger.info('6. Sistem Özeti Test');
        const overview = configChecker.getSystemOverview();
        testLogger.info('Sistem özeti alındı', {
            systemInitialized: overview.system.initialized,
            environment: overview.system.environment,
            totalServices: Object.keys(overview.services).length,
            systemReady: overview.ready
        });
        
        // 7. Config reload test
        testLogger.info('7. Config Reload Test');
        testLogger.debug('Config yeniden yükleniyor...');
        configChecker.reloadConfig();
        testLogger.info('Config başarıyla yeniden yüklendi');
        
        // 8. Custom ConfigChecker instance test
        testLogger.info('8. Custom ConfigChecker Instance Test');
        const customChecker = new ConfigChecker('./src/config.yaml');
        const customSystemStatus = customChecker.system;
        testLogger.info('Custom checker instance oluşturuldu', {
            initialized: customSystemStatus.initialized,
            environment: customSystemStatus.environment
        });
        
        // 9. Performans testi
        testLogger.info('9. Performans Test');
        const startTime = Date.now();
        
        for (let i = 0; i < 100; i++) {
            configChecker.checkService('proxy');
            configChecker.checkService('api');
            configChecker.checkService('discord');
            configChecker.system;
        }
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        testLogger.info('Performans test sonucu', {
            iterations: 100,
            totalTime: `${duration}ms`,
            avgTimePerIteration: `${(duration / 100).toFixed(2)}ms`
        });
        
        testLogger.info('=== TÜM CONFIG CHECKER TESTLERİ BAŞARILI ===');
        
    } catch (error) {
        testLogger.error('Config Checker test sırasında hata oluştu', error);
        throw error;
    }
}

async function testErrorCases(): Promise<void> {
    testLogger.info('=== HATA DURUMU TESTLERİ ===');
    
    try {
        // 1. Geçersiz config path ile test
        testLogger.info('1. Geçersiz Config Path Test');
        const invalidChecker = new ConfigChecker('./nonexistent/config.yaml');
        const invalidSystemStatus = invalidChecker.system;
        
        testLogger.warn('Geçersiz config path ile oluşturulan checker', {
            initialized: invalidSystemStatus.initialized,
            environment: invalidSystemStatus.environment
        });
        
        const invalidServiceStatus = invalidChecker.checkService('proxy');
        testLogger.warn('Geçersiz config ile servis durumu', {
            active: invalidServiceStatus.active,
            logLevel: invalidServiceStatus.logLevel
        });
        
        testLogger.info('Hata durumu testleri tamamlandı');
        
    } catch (error) {
        testLogger.error('Hata durumu testleri sırasında beklenmeyen hata', error);
    }
}

// Ana test fonksiyonu
async function runConfigCheckerTests(): Promise<void> {
    testLogger.info('CONFIG CHECKER TEST SÜİTİ BAŞLIYOR');
    testLogger.info('Test zamanı', { timestamp: new Date().toISOString() });
    
    try {
        await testConfigChecker();
        await testErrorCases();
        
        testLogger.info('=== TÜM CONFIG CHECKER TESTLERİ TAMAMLANDI ===');
        
    } catch (error) {
        testLogger.error('Test süiti sırasında kritik hata', error);
        process.exit(1);
    }
}

// Test'i çalıştır
if (require.main === module) {
    runConfigCheckerTests()
        .then(() => {
            testLogger.info('Test süiti başarıyla tamamlandı');
        })
        .catch((error) => {
            testLogger.error('Test süiti başarısız oldu', error);
            process.exit(1);
        });
}

export { runConfigCheckerTests };
