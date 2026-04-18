import { systemLogger } from '../logger';
import { EventEmitter } from 'events';

/**
 * Event listener ve function tiplerini tanımla
 */
type EventListener = (...args: any[]) => void;
type StoredFunction = (...args: any[]) => any;

/**
 * Discord.js Collection benzeri global store sistemi
 * Key-Value çiftlerini global olarak saklama ve yönetme
 * Event listener'lar ve fonksiyonlar da desteklenir
 */
class GlobalCollection<K, V> extends EventEmitter {
    private store: Map<K, V>;
    private name: string;
    private eventListeners: Map<string, EventListener[]>;
    private functions: Map<string, StoredFunction>;

    constructor(name: string = 'GlobalCollection') {
        super();
        this.store = new Map<K, V>();
        this.name = name;
        this.eventListeners = new Map();
        this.functions = new Map();
        systemLogger.debug(`${this.name} collection created`);
    }

    /**
     * Bir key-value çifti ekle veya güncelle
     */
    set(key: K, value: V): this {
        const oldValue = this.store.get(key);
        this.store.set(key, value);
        
        // Collection değişikliği event'i emit et
        this.emit('set', key, value, oldValue);
        
        systemLogger.verbose(`${this.name}: Set key`, { key: String(key) });
        return this;
    }

    /**
     * Bir key'e göre value al
     */
    get(key: K): V | undefined {
        const value = this.store.get(key);
        
        // Get event'i emit et
        this.emit('get', key, value);
        
        systemLogger.verbose(`${this.name}: Get key`, { key: String(key), found: value !== undefined });
        return value;
    }

    /**
     * Bir key'in var olup olmadığını kontrol et
     */
    has(key: K): boolean {
        return this.store.has(key);
    }

    /**
     * Bir key-value çiftini sil
     */
    delete(key: K): boolean {
        const oldValue = this.store.get(key);
        const deleted = this.store.delete(key);
        
        if (deleted) {
            // Delete event'i emit et
            this.emit('delete', key, oldValue);
            systemLogger.verbose(`${this.name}: Deleted key`, { key: String(key) });
        }
        return deleted;
    }

    /**
     * Tüm key-value çiftlerini temizle
     */
    clear(): void {
        const size = this.store.size;
        this.store.clear();
        this.functions.clear();
        this.eventListeners.clear();
        
        // Clear event'i emit et
        this.emit('clear', size);
        
        systemLogger.debug(`${this.name}: Cleared ${size} items`);
    }

    // === EVENT LISTENER METODLARI ===

    /**
     * Event listener ekle (collection-specific)
     */
    addListener(eventName: string, listener: EventListener): this {
        if (!this.eventListeners.has(eventName)) {
            this.eventListeners.set(eventName, []);
        }
        this.eventListeners.get(eventName)!.push(listener);
        
        systemLogger.debug(`${this.name}: Added listener for event '${eventName}'`);
        return this;
    }

    /**
     * Event listener kaldır
     */
    removeListener(eventName: string, listener: EventListener): this {
        const listeners = this.eventListeners.get(eventName);
        if (listeners) {
            const index = listeners.indexOf(listener);
            if (index > -1) {
                listeners.splice(index, 1);
                systemLogger.debug(`${this.name}: Removed listener for event '${eventName}'`);
            }
        }
        return this;
    }

    /**
     * Event emit et (collection-specific)
     */
    emitEvent(eventName: string, ...args: any[]): boolean {
        const listeners = this.eventListeners.get(eventName);
        if (listeners && listeners.length > 0) {
            listeners.forEach(listener => {
                try {
                    listener(...args);
                } catch (error) {
                    systemLogger.error(`${this.name}: Error in event listener '${eventName}'`, error);
                }
            });
            return true;
        }
        return false;
    }

    /**
     * Tüm event listener'ları listele
     */
    getEventListeners(): { [eventName: string]: number } {
        const result: { [eventName: string]: number } = {};
        this.eventListeners.forEach((listeners, eventName) => {
            result[eventName] = listeners.length;
        });
        return result;
    }

    // === FUNCTION STORAGE METODLARI ===

    /**
     * Fonksiyon kaydet
     */
    setFunction(name: string, func: StoredFunction): this {
        this.functions.set(name, func);
        systemLogger.debug(`${this.name}: Stored function '${name}'`);
        return this;
    }

    /**
     * Fonksiyon al
     */
    getFunction(name: string): StoredFunction | undefined {
        return this.functions.get(name);
    }

    /**
     * Fonksiyon çalıştır
     */
    callFunction(name: string, ...args: any[]): any {
        const func = this.functions.get(name);
        if (func) {
            try {
                const result = func(...args);
                systemLogger.verbose(`${this.name}: Called function '${name}'`);
                return result;
            } catch (error) {
                systemLogger.error(`${this.name}: Error calling function '${name}'`, error);
                throw error;
            }
        } else {
            systemLogger.warn(`${this.name}: Function '${name}' not found`);
            return undefined;
        }
    }

    /**
     * Fonksiyon var mı kontrol et
     */
    hasFunction(name: string): boolean {
        return this.functions.has(name);
    }

    /**
     * Fonksiyon sil
     */
    deleteFunction(name: string): boolean {
        const deleted = this.functions.delete(name);
        if (deleted) {
            systemLogger.debug(`${this.name}: Deleted function '${name}'`);
        }
        return deleted;
    }

    /**
     * Tüm fonksiyonları listele
     */
    listFunctions(): string[] {
        return Array.from(this.functions.keys());
    }

    /**
     * Collection'ın boyutu
     */
    get size(): number {
        return this.store.size;
    }

    /**
     * Tüm key'leri al
     */
    keys(): IterableIterator<K> {
        return this.store.keys();
    }

    /**
     * Tüm value'ları al
     */
    values(): IterableIterator<V> {
        return this.store.values();
    }

    /**
     * Tüm entries'leri al
     */
    entries(): IterableIterator<[K, V]> {
        return this.store.entries();
    }

    /**
     * Collection üzerinde forEach
     */
    forEach(callbackfn: (value: V, key: K, map: Map<K, V>) => void): void {
        this.store.forEach(callbackfn);
    }

    /**
     * Koşula göre filtrele (yeni Collection döner)
     */
    filter(predicate: (value: V, key: K) => boolean): GlobalCollection<K, V> {
        const filtered = new GlobalCollection<K, V>(`${this.name}_filtered`);
        this.store.forEach((value, key) => {
            if (predicate(value, key)) {
                filtered.set(key, value);
            }
        });
        return filtered;
    }

    /**
     * İlk koşulu sağlayan elemanı bul
     */
    find(predicate: (value: V, key: K) => boolean): V | undefined {
        for (const [key, value] of this.store.entries()) {
            if (predicate(value, key)) {
                return value;
            }
        }
        return undefined;
    }

    /**
     * Map fonksiyonu (yeni array döner)
     */
    map<T>(mapper: (value: V, key: K) => T): T[] {
        const results: T[] = [];
        this.store.forEach((value, key) => {
            results.push(mapper(value, key));
        });
        return results;
    }

    /**
     * Koşula göre bazı elemanlar var mı kontrol et
     */
    some(predicate: (value: V, key: K) => boolean): boolean {
        for (const [key, value] of this.store.entries()) {
            if (predicate(value, key)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Tüm elemanlar koşulu sağlıyor mu kontrol et
     */
    every(predicate: (value: V, key: K) => boolean): boolean {
        for (const [key, value] of this.store.entries()) {
            if (!predicate(value, key)) {
                return false;
            }
        }
        return true;
    }

    /**
     * Collection'ı array'e çevir
     */
    toArray(): V[] {
        return Array.from(this.store.values());
    }

    /**
     * Collection'ı JSON'a çevir
     */
    toJSON(): { [key: string]: V } {
        const obj: any = {};
        this.store.forEach((value, key) => {
            obj[String(key)] = value;
        });
        return obj;
    }

    /**
     * Collection durumunu logla
     */
    inspect(): void {
        systemLogger.info(`${this.name} Collection Status`, {
            size: this.size,
            keys: Array.from(this.keys()).map(k => String(k)),
            functions: this.listFunctions(),
            eventListeners: this.getEventListeners()
        });
    }
}

/**
 * Global Collection Manager
 * Birden fazla global collection'ı yönetir
 */
class GlobalStore {
    private collections: Map<string, GlobalCollection<any, any>>;

    constructor() {
        this.collections = new Map();
        systemLogger.debug('Global Store initialized');
    }

    /**
     * Yeni bir collection oluştur veya mevcut olanı al
     */
    collection<K, V>(name: string): GlobalCollection<K, V> {
        if (!this.collections.has(name)) {
            this.collections.set(name, new GlobalCollection<K, V>(name));
            systemLogger.debug(`Created new collection: ${name}`);
        }
        return this.collections.get(name) as GlobalCollection<K, V>;
    }

    /**
     * Collection'ı sil
     */
    deleteCollection(name: string): boolean {
        const deleted = this.collections.delete(name);
        if (deleted) {
            systemLogger.debug(`Deleted collection: ${name}`);
        }
        return deleted;
    }

    /**
     * Tüm collection'ları temizle
     */
    clearAll(): void {
        const size = this.collections.size;
        this.collections.forEach(collection => collection.clear());
        this.collections.clear();
        systemLogger.debug(`Cleared all ${size} collections`);
    }

    /**
     * Mevcut collection'ları listele
     */
    listCollections(): string[] {
        return Array.from(this.collections.keys());
    }

    /**
     * Global store durumunu göster
     */
    inspect(): void {
        const collections = this.listCollections();
        systemLogger.info('Global Store Status', {
            totalCollections: collections.length,
            collections: collections.map(name => ({
                name,
                size: this.collections.get(name)?.size || 0
            }))
        });
    }
}

// Global singleton instance
export const globalStore = new GlobalStore();

// Export edilen types ve classes
export { GlobalCollection, GlobalStore, EventListener, StoredFunction };
