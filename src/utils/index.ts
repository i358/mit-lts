// Utils modülü index dosyası
export { configChecker, ConfigChecker, ServiceStatus, SystemStatus } from './configChecker';
export { globalStore, GlobalCollection, GlobalStore } from './globalStore';

/**
 * Discord mesajlarında mention spam saldırılarını önlemek için string'i sanitize eder
 * @everyone, @here, @role gibi mentions'ları escape eder
 */
export function sanitizeDiscordInput(input: string): string {
  if (!input) return '';
  
  return input
    .replace(/@everyone/gi, '@​everyone') // Zero-width space ekle
    .replace(/@here/gi, '@​here')         // Zero-width space ekle
    .replace(/<@(&)?(\d+)>/g, '@​$2')      // User mentions'ı escape et
    .replace(/<@&(\d+)>/g, '@​$1');        // Role mentions'ı escape et
}

/**
 * Input validation - uzunluk kontrolü
 */
export function validateInputLength(input: string, fieldName: string, minLength: number = 1, maxLength: number = 256): string | null {
  if (!input) return `${fieldName} boş olamaz`;
  if (input.length < minLength) return `${fieldName} en az ${minLength} karakter olmalıdır`;
  if (input.length > maxLength) return `${fieldName} en fazla ${maxLength} karakter olabilir`;
  return null;
}

/*
KULLANIM ÖRNEKLERİ:

=== CONFIG CHECKER ===
import { configChecker } from './utils';

// Tek bir servisi kontrol et
const proxyStatus = configChecker.checkService("proxy");
console.log(proxyStatus.active); // true/false
console.log(proxyStatus.logLevel); // "info", "debug", etc.

const apiStatus = configChecker.checkService("api");
console.log(apiStatus.active); // true/false

const discordStatus = configChecker.checkService("discord");
console.log(discordStatus.active); // true/false

// Sistem durumunu kontrol et
const systemStatus = configChecker.system;
console.log(systemStatus.initialized); // true/false
console.log(systemStatus.environment); // "development", "production", etc.

// Tüm servisleri kontrol et
const allServices = configChecker.getAllServices();
console.log(allServices.proxy.active);
console.log(allServices.api.active);
console.log(allServices.discord.active);

// Sistem hazır mı kontrol et
const isReady = configChecker.isSystemReady();
console.log(isReady); // true/false

// Tam sistem özeti
const overview = configChecker.getSystemOverview();
console.log(overview.system.initialized);
console.log(overview.services.proxy.active);
console.log(overview.ready);

// Config'i yeniden yükle
configChecker.reloadConfig();


// Utils modülü index dosyası
export { configChecker, ConfigChecker, ServiceStatus, SystemStatus } from './configChecker';
export { globalStore, GlobalCollection, GlobalStore, EventListener, StoredFunction } from './globalStore';

/*
KULLANIM ÖRNEKLERİ:

=== CONFIG CHECKER ===
import { configChecker } from './utils';

// Tek bir servisi kontrol et
const proxyStatus = configChecker.checkService("proxy");
console.log(proxyStatus.active); // true/false
console.log(proxyStatus.logLevel); // "info", "debug", etc.

const apiStatus = configChecker.checkService("api");
console.log(apiStatus.active); // true/false

const discordStatus = configChecker.checkService("discord");
console.log(discordStatus.active); // true/false

// Sistem durumunu kontrol et
const systemStatus = configChecker.system;
console.log(systemStatus.initialized); // true/false
console.log(systemStatus.environment); // "development", "production", etc.

// Tüm servisleri kontrol et
const allServices = configChecker.getAllServices();
console.log(allServices.proxy.active);
console.log(allServices.api.active);
console.log(allServices.discord.active);

// Sistem hazır mı kontrol et
const isReady = configChecker.isSystemReady();
console.log(isReady); // true/false

// Tam sistem özeti
const overview = configChecker.getSystemOverview();
console.log(overview.system.initialized);
console.log(overview.services.proxy.active);
console.log(overview.ready);

// Config'i yeniden yükle
configChecker.reloadConfig();


=== GLOBAL STORE (Discord Collection benzeri + Event Listeners + Functions) ===
import { globalStore } from './utils';

// Farklı tipte collection'lar oluştur
const users = globalStore.collection<string, any>('users');
const sessions = globalStore.collection<number, any>('sessions');
const cache = globalStore.collection<string, string>('cache');

// 1. TEMEL VERI İŞLEMLERİ
// Veri ekleme
users.set('12345', { name: 'Ahmet', level: 5 });
users.set('67890', { name: 'Mehmet', level: 10 });

sessions.set(1, { userId: '12345', token: 'abc123' });
cache.set('api_data', JSON.stringify({ data: 'some api response' }));

// Veri okuma
const user = users.get('12345');
console.log(user?.name); // 'Ahmet'

// Collection metodları (Discord.js benzeri)
const highLevelUsers = users.filter((user) => user.level >= 8);
const userName = users.find((user) => user.name === 'Ahmet');
const allUserNames = users.map((user) => user.name);

// 2. EVENT LISTENER SİSTEMİ
// Collection değişikliklerini dinle (otomatik event'ler)
users.on('set', (key, newValue, oldValue) => {
    console.log(`User ${key} updated:`, { newValue, oldValue });
});

users.on('delete', (key, deletedValue) => {
    console.log(`User ${key} deleted:`, deletedValue);
});

users.on('clear', (clearedCount) => {
    console.log(`Cleared ${clearedCount} users`);
});

// Custom event listener'lar ekle
users.addListener('userLogin', (userId, timestamp) => {
    console.log(`User ${userId} logged in at ${timestamp}`);
});

users.addListener('userLevelUp', (userId, oldLevel, newLevel) => {
    console.log(`User ${userId} leveled up from ${oldLevel} to ${newLevel}`);
});

// Event'leri emit et
users.emitEvent('userLogin', '12345', Date.now());
users.emitEvent('userLevelUp', '12345', 5, 6);

// Event listener durumunu kontrol et
console.log(users.getEventListeners()); // { userLogin: 1, userLevelUp: 1 }

// 3. FUNCTION STORAGE SİSTEMİ
// Fonksiyonları kaydet
users.setFunction('calculateUserScore', (user) => {
    return user.level * 100 + (user.achievements?.length || 0) * 50;
});

users.setFunction('getUsersByLevel', (minLevel) => {
    return users.filter((user) => user.level >= minLevel).toArray();
});

users.setFunction('promoteUser', (userId, levels = 1) => {
    const user = users.get(userId);
    if (user) {
        const oldLevel = user.level;
        user.level += levels;
        users.set(userId, user);
        users.emitEvent('userLevelUp', userId, oldLevel, user.level);
        return user;
    }
    return null;
});

// Fonksiyonları çalıştır
const userScore = users.callFunction('calculateUserScore', { level: 10, achievements: ['first_kill'] });
console.log(userScore); // 1050

const highLevelUsers2 = users.callFunction('getUsersByLevel', 8);
console.log(highLevelUsers2);

const promotedUser = users.callFunction('promoteUser', '12345', 2);
console.log(promotedUser);

// Fonksiyon durumunu kontrol et
console.log(users.listFunctions()); // ['calculateUserScore', 'getUsersByLevel', 'promoteUser']
console.log(users.hasFunction('calculateUserScore')); // true

// 4. GELİŞMİŞ KULLANIM ÖRNEKLERİ

// A. Game State Management
const gameState = globalStore.collection<string, any>('gameState');
gameState.setFunction('saveGame', (playerData) => {
    const saveData = { ...playerData, timestamp: Date.now() };
    gameState.set('currentSave', saveData);
    gameState.emitEvent('gameSaved', saveData);
    return saveData;
});

// B. API Response Caching with TTL
const apiCache = globalStore.collection<string, any>('apiCache');
apiCache.setFunction('cacheWithTTL', (key, data, ttlMs) => {
    const expiry = Date.now() + ttlMs;
    apiCache.set(key, { data, expiry });
    setTimeout(() => {
        if (apiCache.has(key)) {
            const cached = apiCache.get(key);
            if (cached && cached.expiry <= Date.now()) {
                apiCache.delete(key);
                apiCache.emitEvent('cacheExpired', key, cached.data);
            }
        }
    }, ttlMs);
});

// C. Real-time Event Processing
const events = globalStore.collection<number, any>('events');
events.setFunction('processEvent', (eventData) => {
    const eventId = Date.now();
    events.set(eventId, eventData);
    events.emitEvent('eventProcessed', eventId, eventData);
    
    // Process different event types
    switch (eventData.type) {
        case 'user_action':
            users.emitEvent('userAction', eventData.userId, eventData.action);
            break;
        case 'system_alert':
            console.log('SYSTEM ALERT:', eventData.message);
            break;
    }
    
    return eventId;
});

// Collection durumu ve debugging
users.inspect(); // Detaylı durum bilgisi (data + functions + listeners)
globalStore.inspect(); // Tüm collection'ları göster

// Temizleme
users.clear(); // Data + functions + listeners temizle
globalStore.clearAll(); // Tüm collection'ları temizle
*/
