//@ts-nocheck
import * as fs from 'fs';
import * as path from 'path';
import { createLogger, LogLevel } from '../logger';

const logger = createLogger({
    logLevel: LogLevel.DEBUG,
    writeToFile: true,
    logFilePath: '../logs/bitflags.log',
    module: "BitflagsManager"
});

interface BitflagsConfig {
    permissions: string[];
    badges: {
        [key: string]: {
            name: string;
            permissions: string[];
            condition: "=" | ">=";
            source: "badges" | "extras";
        };
    };
}

interface BitflagsExtras {
    [key: string]: {
        description: string;
        permissions: string[];
    };
}

// Varsayılan bitflags değeri: 0 (hiçbir izin yok)
export const DEFAULT_BITFLAGS = 0;

class BitflagsManager {
    private config: BitflagsConfig;
    private extras: BitflagsExtras;
    private permissionValues: { [key: string]: number };

    constructor() {
        this.loadConfig();
        this.loadExtras();
        this.initializePermissionValues();
    }

    private loadConfig() {
        try {
            const configPath = path.join(__dirname, '..', '..', 'cache', 'bitflags.json');
            this.config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        } catch (error) {
            logger.error('Error loading bitflags config:', error);
            throw new Error('Failed to load bitflags configuration');
        }
    }

    private loadExtras() {
        try {
            const extrasPath = path.join(__dirname, 'bitflagsExtras.json');
            if (fs.existsSync(extrasPath)) {
                this.extras = JSON.parse(fs.readFileSync(extrasPath, 'utf8'));
            } else {
                // Varsayılan extras yapısını oluştur
                this.extras = {};
                fs.writeFileSync(extrasPath, JSON.stringify(this.extras, null, 2));
            }
        } catch (error) {
            logger.error('Error loading bitflags extras:', error);
            this.extras = {};
        }
    }

    private initializePermissionValues() {
        this.permissionValues = {};
        this.config.permissions.forEach((permission, index) => {
            // Her permission için bir bit pozisyonu belirle
            this.permissionValues[permission] = 1 << index;
        });
    }

    public calculateBitflags(badgeIndex: number, currentBitflags: number = DEFAULT_BITFLAGS): number {
        try {
            let newBitflags = currentBitflags;
            
            // Tüm badge'leri kontrol et
            for (let i = 1; i <= badgeIndex; i++) {
                const badgeConfig = this.config.badges[i.toString()];
                if (!badgeConfig) continue;

                // Badge'i kontrol et ve log oluştur
                logger.debug(`Checking badge ${i}:`, {
                    exists: true,
                    condition: badgeConfig.condition,
                    isTargetBadge: i === badgeIndex,
                    permissions: badgeConfig.permissions
                });

                // Badge koşulunu kontrol et
                if (badgeConfig.condition === '>=' && i <= badgeIndex) {
                    // Badge'in permissionlarını ekle
                    badgeConfig.permissions.forEach(permission => {
                        const permissionValue = this.permissionValues[permission];
                        if (permissionValue !== undefined) {
                            newBitflags |= permissionValue;
                            logger.debug(`Added permission for badge ${i}:`, {
                                permission,
                                value: permissionValue,
                                newBitflags
                            });
                        } else {
                            logger.warn(`Unknown permission for badge ${i}:`, permission);
                        }
                    });
                }
            }

            return newBitflags;

        } catch (error) {
            logger.error('Error calculating bitflags:', error);
            return currentBitflags;
        }
    }

    public hasPermission(bitflags: number | string, permission: string): boolean {
        // String'i number'a çevir
        const bitflagsNum = typeof bitflags === 'string' ? parseInt(bitflags, 10) : bitflags;
        
        if (typeof bitflagsNum !== 'number' || isNaN(bitflagsNum)) {
            logger.warn('Invalid bitflags value:', bitflags);
            return false;
        }
        const permissionValue = this.permissionValues[permission];
        if (permissionValue === undefined) {
            logger.warn('Unknown permission:', permission);
            return false;
        }
        return (bitflagsNum & permissionValue) === permissionValue;
    }

    public addExtraPermission(name: string, permissions: string[], description: string = '') {
        this.extras[name] = { permissions, description };
        this.saveExtras();
    }

    public removeExtraPermission(name: string) {
        delete this.extras[name];
        this.saveExtras();
    }

    public getExtraPermissions(name: string): string[] {
        return this.extras[name]?.permissions || [];
    }

    private saveExtras() {
        try {
            const extrasPath = path.join(__dirname, 'bitflagsExtras.json');
            fs.writeFileSync(extrasPath, JSON.stringify(this.extras, null, 2));
        } catch (error) {
            logger.error('Error saving bitflags extras:', error);
        }
    }

    public getPermissionValue(permission: string): number {
        return this.permissionValues[permission] || 0;
    }

    public getAllPermissions(): string[] {
        return [...this.config.permissions];
    }

    public getBadgePermissions(badgeIndex: number): string[] {
        return this.config.badges[badgeIndex]?.permissions || [];
    }
}

// Singleton instance
export const bitflagsManager = new BitflagsManager();