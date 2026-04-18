import * as fs from 'fs';
import * as path from 'path';
import { Listener } from './listener';
import { proxyLogger } from '../../logger';

/**
 * Listener Loader Utility
 * Otomatik olarak listeners klasöründeki tüm listener dosyalarını yükler
 */
export class ListenerLoader {
    private listeners: Map<string, Listener> = new Map();
    private listenersPath: string;

    constructor(listenersPath: string = __dirname) {
        this.listenersPath = listenersPath;
    }

    /**
     * Listeners klasöründeki tüm dosyaları yükle
     * @returns Promise<Listener[]> Yüklenen listener'lar
     */
    public async loadListeners(): Promise<Listener[]> {
        const loadedListeners: Listener[] = [];
        
        try {
            proxyLogger.info('Loading listeners from directory', { path: this.listenersPath });
            
            if (!fs.existsSync(this.listenersPath)) {
                proxyLogger.warn('Listeners directory not found', { path: this.listenersPath });
                return loadedListeners;
            }

            const files = fs.readdirSync(this.listenersPath)
                .filter(file => {
                    // .ts ve .js dosyalarını al, .d.ts'leri hariç tut
                    return (file.endsWith('.ts') || file.endsWith('.js')) && 
                           !file.endsWith('.d.ts') && 
                           file !== 'listenerLoader.ts' &&
                           file !== 'listenerLoader.js';
                });

            proxyLogger.debug('Found listener files', { files });

            for (const file of files) {
                try {
                    const filePath = path.join(this.listenersPath, file);
                    const listenerModule = await import(filePath);
                    
                    // Default export veya named export'ları kontrol et
                    const listener = this.extractListener(listenerModule, file);
                    
                    if (listener) {
                        this.listeners.set(listener.event, listener);
                        loadedListeners.push(listener);
                        
                        proxyLogger.info('Listener loaded successfully', {
                            file,
                            event: listener.event,
                            direction: listener.direction,
                            hasExec: typeof listener.exec === 'function'
                        });
                    }
                    
                } catch (error) {
                    proxyLogger.error('Failed to load listener file', { file, error });
                }
            }

            proxyLogger.info('Listener loading completed', {
                totalLoaded: loadedListeners.length,
                events: loadedListeners.map(l => l.event)
            });

            return loadedListeners;
            
        } catch (error) {
            proxyLogger.error('Failed to load listeners', { error });
            return loadedListeners;
        }
    }

    /**
     * Module'dan listener'ı çıkar
     * @param listenerModule Import edilen modül
     * @param fileName Dosya adı
     * @returns Listener | null
     */
    private extractListener(listenerModule: any, fileName: string): Listener | null {
        // Named export (örn: export const RoomReadyListener)
        const listenerName = path.basename(fileName, path.extname(fileName));
        
        // Önce named export'u dene
        if (listenerModule[listenerName] && this.isValidListener(listenerModule[listenerName])) {
            return listenerModule[listenerName];
        }
        
        // Default export'u dene
        if (listenerModule.default && this.isValidListener(listenerModule.default)) {
            return listenerModule.default;
        }
        
        // Module'daki tüm export'ları kontrol et
        for (const [key, value] of Object.entries(listenerModule)) {
            if (key !== 'default' && this.isValidListener(value)) {
                return value as Listener;
            }
        }
        
        proxyLogger.warn('No valid listener found in file', { fileName });
        return null;
    }

    /**
     * Listener'ın valid olup olmadığını kontrol et
     * @param obj Kontrol edilecek obje
     * @returns boolean
     */
    private isValidListener(obj: any): obj is Listener {
        return obj && 
               typeof obj === 'object' && 
               typeof obj.event === 'string' && 
               typeof obj.direction === 'number' &&
               typeof obj.exec === 'function';
    }

    /**
     * Event adına göre listener al
     * @param eventName Event adı
     * @returns Listener | undefined
     */
    public getListener(eventName: string): Listener | undefined {
        return this.listeners.get(eventName);
    }

    /**
     * Tüm yüklü listener'ları al
     * @returns Listener[] 
     */
    public getAllListeners(): Listener[] {
        return Array.from(this.listeners.values());
    }

    /**
     * Yüklü listener event'lerini al
     * @returns string[]
     */
    public getEventNames(): string[] {
        return Array.from(this.listeners.keys());
    }

    /**
     * Listener sayısını al
     * @returns number
     */
    public getListenerCount(): number {
        return this.listeners.size;
    }

    /**
     * Tek bir listener dosyasını yükle
     * @param filePath Dosya yolu
     * @returns Promise<Listener | null>
     */
    public async loadSingleListener(filePath: string): Promise<Listener | null> {
        try {
            const listenerModule = await import(filePath);
            const fileName = path.basename(filePath);
            
            const listener = this.extractListener(listenerModule, fileName);
            
            if (listener) {
                this.listeners.set(listener.event, listener);
                proxyLogger.info('Single listener loaded', {
                    filePath,
                    event: listener.event
                });
                return listener;
            }
            
            return null;
            
        } catch (error) {
            proxyLogger.error('Failed to load single listener', { filePath, error });
            return null;
        }
    }

    /**
     * Listener'ları temizle
     */
    public clearListeners(): void {
        this.listeners.clear();
        proxyLogger.debug('All listeners cleared');
    }

    /**
     * Listener loader durumunu logla
     */
    public inspect(): void {
        proxyLogger.info('Listener Loader Status', {
            listenersPath: this.listenersPath,
            totalListeners: this.getListenerCount(),
            events: this.getEventNames()
        });
    }
}

// Singleton instance
export const listenerLoader = new ListenerLoader();
