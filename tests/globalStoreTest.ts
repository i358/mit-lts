import { globalStore, GlobalCollection } from '../src/utils/globalStore';
import { createLogger, LogLevel } from '../src/logger';

// Test için özel logger
const testLogger = createLogger({
    logLevel: LogLevel.DEBUG,
    writeToFile: true,
    logFilePath: './logs/global-store-test.log',
    module: 'STORE_TEST'
});

interface TestUser {
    id: string;
    name: string;
    level: number;
    score: number;
    lastLogin?: number;
}

interface TestSession {
    userId: string;
    token: string;
    expires: number;
    active: boolean;
}

async function testBasicCollectionOperations(): Promise<void> {
    testLogger.info('=== TEMEL COLLECTİON İŞLEMLERİ TEST ===');
    
    try {
        // Test collection'ı oluştur
        const users = globalStore.collection<string, TestUser>('test_users');
        
        testLogger.info('1. Collection Oluşturma Test');
        testLogger.debug('Test users collection oluşturuldu');
        
        // Test verileri ekle
        testLogger.info('2. Veri Ekleme Test');
        const testUsers: TestUser[] = [
            { id: '1', name: 'Ahmet', level: 5, score: 1500 },
            { id: '2', name: 'Mehmet', level: 8, score: 3200 },
            { id: '3', name: 'Ayşe', level: 12, score: 5600 }
        ];
        
        testUsers.forEach(user => {
            users.set(user.id, user);
            testLogger.debug('Kullanıcı eklendi', { id: user.id, name: user.name, level: user.level });
        });
        
        testLogger.info('Toplam kullanıcı sayısı', { count: users.size });
        
        // Veri okuma test
        testLogger.info('3. Veri Okuma Test');
        const user1 = users.get('1');
        testLogger.info('Kullanıcı 1 alındı', user1);
        
        const nonExistentUser = users.get('999');
        testLogger.warn('Var olmayan kullanıcı sorgulandı', { found: nonExistentUser !== undefined });
        
        // Has kontrolü
        testLogger.info('4. Varlık Kontrolü Test');
        const hasUser1 = users.has('1');
        const hasUser999 = users.has('999');
        testLogger.info('Varlık kontrolleri', { hasUser1, hasUser999 });
        
        // Collection metodları test
        testLogger.info('5. Collection Metodları Test');
        
        const highLevelUsers = users.filter((user) => user.level >= 8);
        testLogger.info('Yüksek seviye kullanıcılar filtrelendi', { 
            count: highLevelUsers.size,
            users: highLevelUsers.toArray()
        });
        
        const topUser = users.find((user) => user.level > 10);
        testLogger.info('En üst seviye kullanıcı bulundu', topUser);
        
        const userNames = users.map((user) => user.name);
        testLogger.info('Kullanıcı isimleri', { names: userNames });
        
        const hasHighLevelUser = users.some((user) => user.level > 10);
        const allUsersActive = users.every((user) => user.score > 0);
        testLogger.info('Koşul kontrolleri', { hasHighLevelUser, allUsersActive });
        
        testLogger.info('Temel işlemler başarıyla tamamlandı');
        
    } catch (error) {
        testLogger.error('Temel collection işlemleri test hatası', error);
        throw error;
    }
}

async function testEventListenerSystem(): Promise<void> {
    testLogger.info('=== EVENT LİSTENER SİSTEMİ TEST ===');
    
    try {
        const events = globalStore.collection<string, any>('test_events');
        
        testLogger.info('1. Otomatik Event Listener Test');
        
        // Otomatik event'leri dinle
        events.on('set', (key, newValue, oldValue) => {
            testLogger.info('SET event tetiklendi', { key, hasOldValue: oldValue !== undefined });
        });
        
        events.on('delete', (key, deletedValue) => {
            testLogger.info('DELETE event tetiklendi', { key, deletedValue });
        });
        
        events.on('clear', (clearedCount) => {
            testLogger.info('CLEAR event tetiklendi', { clearedCount });
        });
        
        // Test verileri ekle (set event'leri tetiklenecek)
        events.set('event1', { type: 'login', userId: '123', timestamp: Date.now() });
        events.set('event2', { type: 'action', userId: '456', action: 'purchase' });
        
        // Veri güncelle
        events.set('event1', { type: 'login', userId: '123', timestamp: Date.now(), updated: true });
        
        testLogger.info('2. Custom Event Listener Test');
        
        // Custom event listener'lar ekle
        events.addListener('userAction', (userId: string, action: string, timestamp: number) => {
            testLogger.info('Kullanıcı aksiyonu', { userId, action, timestamp });
        });
        
        events.addListener('systemAlert', (level: string, message: string) => {
            testLogger.warn('Sistem uyarısı', { level, message });
        });
        
        events.addListener('gameEvent', (eventType: string, data: any) => {
            testLogger.info('Oyun eventi', { eventType, data });
        });
        
        testLogger.info('Event listener durumu', events.getEventListeners());
        
        // Custom event'leri tetikle
        testLogger.info('3. Custom Event Emit Test');
        events.emitEvent('userAction', '123', 'level_up', Date.now());
        events.emitEvent('systemAlert', 'warning', 'Yüksek CPU kullanımı tespit edildi');
        events.emitEvent('gameEvent', 'boss_defeated', { boss: 'Dragon King', reward: 1000 });
        
        // Olmayan event emit et
        const nonExistentEmitted = events.emitEvent('nonExistent', 'data');
        testLogger.warn('Olmayan event emit edilmeye çalışıldı', { success: nonExistentEmitted });
        
        // Delete event tetikle
        events.delete('event2');
        
        testLogger.info('Event listener sistemı testleri tamamlandı');
        
    } catch (error) {
        testLogger.error('Event listener sistem test hatası', error);
        throw error;
    }
}

async function testFunctionStorage(): Promise<void> {
    testLogger.info('=== FONKSİYON STORAGE SİSTEMİ TEST ===');
    
    try {
        const gameData = globalStore.collection<string, any>('test_game_data');
        
        testLogger.info('1. Fonksiyon Kaydetme Test');
        
        // Matematik fonksiyonları
        gameData.setFunction('calculateScore', (baseScore: number, multiplier: number = 1) => {
            return Math.floor(baseScore * multiplier);
        });
        
        gameData.setFunction('calculateLevel', (experience: number) => {
            return Math.floor(Math.sqrt(experience / 100)) + 1;
        });
        
        gameData.setFunction('generatePlayerId', () => {
            return `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        });
        
        // Veri işleme fonksiyonları
        gameData.setFunction('savePlayerData', (playerId: string, data: any) => {
            const saveData = {
                ...data,
                playerId,
                lastSaved: Date.now(),
                version: '1.0'
            };
            gameData.set(playerId, saveData);
            testLogger.info('Oyuncu verisi kaydedildi', { playerId });
            return saveData;
        });
        
        gameData.setFunction('getTopPlayers', (limit: number = 10) => {
            const allPlayers = Array.from(gameData.values()).filter(item => item.score !== undefined);
            return allPlayers
                .sort((a, b) => b.score - a.score)
                .slice(0, limit);
        });
        
        testLogger.info('Fonksiyon listesi', { functions: gameData.listFunctions() });
        
        testLogger.info('2. Fonksiyon Çalıştırma Test');
        
        // Fonksiyonları test et
        const score1 = gameData.callFunction('calculateScore', 1000, 1.5);
        const score2 = gameData.callFunction('calculateScore', 500);
        testLogger.info('Skor hesaplamaları', { score1, score2 });
        
        const level1 = gameData.callFunction('calculateLevel', 2500);
        const level2 = gameData.callFunction('calculateLevel', 10000);
        testLogger.info('Seviye hesaplamaları', { level1, level2 });
        
        const playerId1 = gameData.callFunction('generatePlayerId');
        const playerId2 = gameData.callFunction('generatePlayerId');
        testLogger.info('Oluşturulan oyuncu IDleri', { playerId1, playerId2 });
        
        // Oyuncu verileri kaydet
        const playerData1 = gameData.callFunction('savePlayerData', playerId1, {
            name: 'TestPlayer1',
            score: score1,
            level: level1
        });
        
        const playerData2 = gameData.callFunction('savePlayerData', playerId2, {
            name: 'TestPlayer2',
            score: score2,
            level: level2
        });
        
        testLogger.info('Oyuncu verileri kaydedildi', { 
            player1: playerData1?.playerId,
            player2: playerData2?.playerId
        });
        
        // Top players al
        const topPlayers = gameData.callFunction('getTopPlayers', 5);
        testLogger.info('En iyi oyuncular', { count: topPlayers.length, topPlayers });
        
        testLogger.info('3. Hata Durumları Test');
        
        // Olmayan fonksiyon çağır
        const nonExistentResult = gameData.callFunction('nonExistentFunction', 'arg1', 'arg2');
        testLogger.warn('Olmayan fonksiyon çağrıldı', { result: nonExistentResult });
        
        // Hatalı parametrelerle fonksiyon çağır
        try {
            gameData.setFunction('errorFunction', () => {
                throw new Error('Test hatası');
            });
            
            gameData.callFunction('errorFunction');
        } catch (error) {
            testLogger.warn('Fonksiyon hatası yakalandı', { error: error instanceof Error ? error.message : error });
        }
        
        testLogger.info('4. Fonksiyon Yönetimi Test');
        
        const hasCalculateScore = gameData.hasFunction('calculateScore');
        testLogger.info('calculateScore fonksiyonu var mı', { exists: hasCalculateScore });
        
        const deletedSuccess = gameData.deleteFunction('errorFunction');
        testLogger.info('errorFunction silindi', { success: deletedSuccess });
        
        testLogger.info('Güncel fonksiyon listesi', { functions: gameData.listFunctions() });
        
        testLogger.info('Fonksiyon storage testleri tamamlandı');
        
    } catch (error) {
        testLogger.error('Fonksiyon storage test hatası', error);
        throw error;
    }
}

async function testAdvancedUseCases(): Promise<void> {
    testLogger.info('=== GELİŞMİŞ KULLANIM SENARYOLARI TEST ===');
    
    try {
        testLogger.info('1. Real-time Game State Management Test');
        
        const gameState = globalStore.collection<string, any>('advanced_game_state');
        
        // Game state management fonksiyonları
        gameState.setFunction('updatePlayerState', (playerId: string, updates: any) => {
            const currentState = gameState.get(playerId) || { playerId, createdAt: Date.now() };
            const newState = { ...currentState, ...updates, updatedAt: Date.now() };
            gameState.set(playerId, newState);
            
            // State değişikliği event'i
            gameState.emitEvent('playerStateChanged', playerId, newState, currentState);
            return newState;
        });
        
        // Event listener'lar
        gameState.addListener('playerStateChanged', (playerId: string, newState: any, oldState: any) => {
            testLogger.info('Oyuncu durumu değişti', { 
                playerId,
                levelChange: newState.level !== oldState.level,
                scoreChange: newState.score !== oldState.score
            });
            
            // Level up kontrolü
            if (newState.level > oldState.level) {
                gameState.emitEvent('playerLevelUp', playerId, oldState.level, newState.level);
            }
        });
        
        gameState.addListener('playerLevelUp', (playerId: string, oldLevel: number, newLevel: number) => {
            testLogger.info('Oyuncu seviye atladı!', { playerId, oldLevel, newLevel });
            
            // Ödül hesapla
            const reward = (newLevel - oldLevel) * 100;
            gameState.callFunction('updatePlayerState', playerId, { 
                coins: (gameState.get(playerId)?.coins || 0) + reward 
            });
        });
        
        // Test senaryoları
        gameState.callFunction('updatePlayerState', 'player1', {
            name: 'AdvancedPlayer',
            level: 1,
            score: 100,
            coins: 0
        });
        
        gameState.callFunction('updatePlayerState', 'player1', {
            level: 3,
            score: 500
        });
        
        testLogger.info('2. API Cache with TTL Test');
        
        const apiCache = globalStore.collection<string, any>('advanced_api_cache');
        
        apiCache.setFunction('cacheWithTTL', (key: string, data: any, ttlMs: number) => {
            const expiry = Date.now() + ttlMs;
            const cacheEntry = { data, expiry, cachedAt: Date.now() };
            apiCache.set(key, cacheEntry);
            
            testLogger.debug('Veri cache\'e eklendi', { key, ttlMs, expiry });
            
            // TTL timeout
            setTimeout(() => {
                const cached = apiCache.get(key);
                if (cached && cached.expiry <= Date.now()) {
                    apiCache.delete(key);
                    apiCache.emitEvent('cacheExpired', key, cached.data);
                }
            }, ttlMs);
            
            return cacheEntry;
        });
        
        apiCache.setFunction('getCached', (key: string) => {
            const cached = apiCache.get(key);
            if (!cached) return null;
            
            if (cached.expiry <= Date.now()) {
                apiCache.delete(key);
                apiCache.emitEvent('cacheExpired', key, cached.data);
                return null;
            }
            
            return cached.data;
        });
        
        // Cache expiry listener
        apiCache.addListener('cacheExpired', (key: string, expiredData: any) => {
            testLogger.warn('Cache süresi doldu', { key, expiredData });
        });
        
        // Cache test
        apiCache.callFunction('cacheWithTTL', 'user_data', { id: 1, name: 'Test' }, 1000);
        const cachedData = apiCache.callFunction('getCached', 'user_data');
        testLogger.info('Cache\'den veri alındı', { data: cachedData });
        
        // TTL expire test (1 saniye bekle)
        await new Promise(resolve => setTimeout(resolve, 1100));
        const expiredData = apiCache.callFunction('getCached', 'user_data');
        testLogger.info('Süresi dolan cache kontrolü', { data: expiredData });
        
        testLogger.info('Gelişmiş kullanım senaryoları testleri tamamlandı');
        
    } catch (error) {
        testLogger.error('Gelişmiş kullanım senaryoları test hatası', error);
        throw error;
    }
}

async function testPerformanceAndCleanup(): Promise<void> {
    testLogger.info('=== PERFORMANS VE TEMİZLİK TESTLERİ ===');
    
    try {
        testLogger.info('1. Performans Test');
        
        const perfCollection = globalStore.collection<number, any>('performance_test');
        
        // Çok sayıda veri ekleme performansı
        const insertStart = Date.now();
        for (let i = 0; i < 1000; i++) {
            perfCollection.set(i, { id: i, data: `test_data_${i}`, timestamp: Date.now() });
        }
        const insertEnd = Date.now();
        
        testLogger.info('1000 adet veri ekleme performansı', {
            totalTime: `${insertEnd - insertStart}ms`,
            avgPerItem: `${((insertEnd - insertStart) / 1000).toFixed(3)}ms`
        });
        
        // Okuma performansı
        const readStart = Date.now();
        for (let i = 0; i < 1000; i++) {
            perfCollection.get(i);
        }
        const readEnd = Date.now();
        
        testLogger.info('1000 adet veri okuma performansı', {
            totalTime: `${readEnd - readStart}ms`,
            avgPerItem: `${((readEnd - readStart) / 1000).toFixed(3)}ms`
        });
        
        testLogger.info('Collection boyutu', { size: perfCollection.size });
        
        testLogger.info('2. Collection İstatistikleri');
        perfCollection.inspect();
        
        testLogger.info('3. Global Store İstatistikleri');
        globalStore.inspect();
        
        testLogger.info('4. Temizlik Test');
        
        // Tek collection temizle
        perfCollection.clear();
        testLogger.info('Performance collection temizlendi', { newSize: perfCollection.size });
        
        // Tüm test collection'larını temizle
        const initialCollections = globalStore.listCollections();
        testLogger.info('Temizlik öncesi collection\'lar', { collections: initialCollections });
        
        // Test collection'larını temizle
        globalStore.deleteCollection('test_users');
        globalStore.deleteCollection('test_events');
        globalStore.deleteCollection('test_game_data');
        globalStore.deleteCollection('advanced_game_state');
        globalStore.deleteCollection('advanced_api_cache');
        
        const remainingCollections = globalStore.listCollections();
        testLogger.info('Temizlik sonrası collection\'lar', { collections: remainingCollections });
        
        testLogger.info('Performans ve temizlik testleri tamamlandı');
        
    } catch (error) {
        testLogger.error('Performans ve temizlik testleri hatası', error);
        throw error;
    }
}

// Ana test fonksiyonu
async function runGlobalStoreTests(): Promise<void> {
    testLogger.info('GLOBAL STORE TEST SÜİTİ BAŞLIYOR');
    testLogger.info('Test zamanı', { timestamp: new Date().toISOString() });
    
    try {
        await testBasicCollectionOperations();
        await testEventListenerSystem();
        await testFunctionStorage();
        await testAdvancedUseCases();
        await testPerformanceAndCleanup();
        
        testLogger.info('=== TÜM GLOBAL STORE TESTLERİ TAMAMLANDI ===');
        
    } catch (error) {
        testLogger.error('Test süiti sırasında kritik hata', error);
        process.exit(1);
    }
}

// Test'i çalıştır
if (require.main === module) {
    runGlobalStoreTests()
        .then(() => {
            testLogger.info('Test süiti başarıyla tamamlandı');
        })
        .catch((error) => {
            testLogger.error('Test süiti başarısız oldu', error);
            process.exit(1);
        });
}

export { runGlobalStoreTests };
