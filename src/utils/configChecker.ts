import * as fs from 'fs';
import * as yaml from 'js-yaml';
import * as path from 'path';
import { systemLogger } from '../logger';

interface ServiceStatus {
    active: boolean;
    logLevel?: string;
    listenEvents?: boolean;
}

interface SystemStatus {
    initialized: boolean;
    environment: string;
}

class ConfigChecker {
    private config: any = null;
    private configPath: string;

    constructor(configPath: string = './src/config.yaml') {
        this.configPath = path.resolve(configPath);
        this.loadConfig();
    }

    private loadConfig(): void {
        try {
            if (fs.existsSync(this.configPath)) {
                const fileContents = fs.readFileSync(this.configPath, 'utf8');
                this.config = yaml.load(fileContents);
                systemLogger.debug('Config loaded for service checker', { path: this.configPath });
            } else {
                systemLogger.error('Config file not found', { path: this.configPath });
                this.config = {};
            }
        } catch (error) {
            systemLogger.error('Failed to load config for service checker', error);
            this.config = {};
        }
    }

    /**
     * Reload config from file
     */
    public reloadConfig(): void {
        this.loadConfig();
    }

    /**
     * Check if a service is active
     * @param serviceName - Name of the service (proxy, api, discord_bot, spotter)
     * @returns ServiceStatus object with active status and log level
     */
    public checkService(serviceName: string): ServiceStatus {
        const defaultStatus: ServiceStatus = { active: false };

        if (!this.config) {
            systemLogger.warn('Config not loaded, returning default service status', { service: serviceName });
            return defaultStatus;
        }

        switch (serviceName.toLowerCase()) {
            case 'proxy':
                return {
                    active: this.config?.proxy?.ACTIVE || false,
                    logLevel: this.config?.proxy?.LOG_LEVEL || 'info'
                };

            case 'api':
                return {
                    active: this.config?.api?.ACTIVE || false,
                    logLevel: this.config?.api?.LOG_LEVEL || 'info'
                };

            case 'discord':
            case 'discord_bot':
                return {
                    active: this.config?.app?.DISCORD_BOT?.ACTIVE || false,
                    logLevel: this.config?.app?.DISCORD_BOT?.LOG_LEVEL || 'info'
                };

            case 'spotter':
            case 'app:spotter':
                return {
                    active: this.config?.app?.SPOTTER?.LISTEN_EVENTS || false,
                    logLevel: this.config?.app?.LOG_LEVEL || 'info',
                    listenEvents: this.config?.app?.SPOTTER?.LISTEN_EVENTS || false
                };

            default:
                systemLogger.warn('Unknown service requested', { service: serviceName });
                return defaultStatus;
        }
    }

    /**
     * Get system initialization status
     * @returns SystemStatus object with initialization status and environment
     */
    public get system(): SystemStatus {
        if (!this.config) {
            systemLogger.warn('Config not loaded, returning default system status');
            return { initialized: false, environment: 'development' };
        }

        return {
            initialized: this.config?.app?.INITIALIZED || false,
            environment: this.config?.app?.ENVIRONMENT || 'development'
        };
    }

    /**
     * Check if all required services are properly configured
     * @returns boolean indicating if system is ready
     */
    public isSystemReady(): boolean {
        const system = this.system;
        
        // Sistem initialized mı kontrol et
        if (!system.initialized) {
            systemLogger.warn('System not initialized');
            return false;
        }

        // Spotter ID ve Main Room ID kontrol et
        const spotterId = this.getConfigValue('app.SPOTTER.ID');
        const mainRoomId = this.getConfigValue('app.MAIN_ROOM_ID');

        if (!spotterId || !mainRoomId) {
            systemLogger.warn('Missing required config values', {
                spotterId: !!spotterId,
                mainRoomId: !!mainRoomId
            });
            return false;
        }

        // En az bir servisin aktif olmasını kontrol et
        const requiredServices = ['proxy', 'api'];
        const activeServices = requiredServices.filter(service => this.checkService(service).active);
        
        if (activeServices.length === 0) {
            systemLogger.warn('No services are active');
            return false;
        }

        systemLogger.info('System ready check passed', { 
            activeServices,
            environment: system.environment,
            spotterId,
            mainRoomId
        });
        
        return true;
    }

    /**
     * Get all service statuses at once
     * @returns Object with all service statuses
     */
    public getAllServices(): { [key: string]: ServiceStatus } {
        return {
            proxy: this.checkService('proxy'),
            api: this.checkService('api'),
            discord: this.checkService('discord'),
            spotter: this.checkService('spotter')
        };
    }

    /**
     * Get full system and services overview
     * @returns Complete status overview
     */
    public getSystemOverview(): {
        system: SystemStatus;
        services: { [key: string]: ServiceStatus };
        ready: boolean;
    } {
        const system = this.system;
        const services = this.getAllServices();
        const ready = this.isSystemReady();

        return {
            system,
            services,
            ready
        };
    }

    // === CONFIG EDITING METHODS ===

    /**
     * Update a config value by path and save to file
     * @param path - Dot notation path (e.g., 'app.LOG_LEVEL', 'proxy.ACTIVE')
     * @param value - New value to set
     * @returns boolean indicating success
     */
    public updateConfig(path: string, value: any): boolean {
        try {
            if (!this.config) {
                systemLogger.error('Config not loaded, cannot update');
                return false;
            }

            // Split path and navigate to the target
            const pathParts = path.split('.');
            let current = this.config;
            
            // Navigate to parent object
            for (let i = 0; i < pathParts.length - 1; i++) {
                const part = pathParts[i];
                if (!(part in current)) {
                    current[part] = {};
                }
                current = current[part];
            }
            
            // Set the final value
            const finalKey = pathParts[pathParts.length - 1];
            const oldValue = current[finalKey];
            current[finalKey] = value;
            
            // Save to file
            const success = this.saveConfigToFile();
            
            if (success) {
                systemLogger.info('Config updated successfully', {
                    path,
                    oldValue,
                    newValue: value
                });
                
                // Auto reload
                this.reloadConfig();
                return true;
            } else {
                // Revert on failure
                current[finalKey] = oldValue;
                return false;
            }
            
        } catch (error) {
            systemLogger.error('Failed to update config', { path, value, error });
            return false;
        }
    }

    /**
     * Update multiple config values at once
     * @param updates - Object with path-value pairs
     * @returns boolean indicating success
     */
    public updateConfigs(updates: { [path: string]: any }): boolean {
        try {
            const backupConfig = JSON.parse(JSON.stringify(this.config));
            
            // Apply all updates
            for (const [path, value] of Object.entries(updates)) {
                const pathParts = path.split('.');
                let current = this.config;
                
                // Navigate to parent object
                for (let i = 0; i < pathParts.length - 1; i++) {
                    const part = pathParts[i];
                    if (!(part in current)) {
                        current[part] = {};
                    }
                    current = current[part];
                }
                
                // Set the final value
                const finalKey = pathParts[pathParts.length - 1];
                current[finalKey] = value;
            }
            
            // Save to file
            const success = this.saveConfigToFile();
            
            if (success) {
                systemLogger.info('Multiple configs updated successfully', { updates });
                
                // Auto reload
                this.reloadConfig();
                return true;
            } else {
                // Revert all changes on failure
                this.config = backupConfig;
                return false;
            }
            
        } catch (error) {
            systemLogger.error('Failed to update multiple configs', { updates, error });
            return false;
        }
    }

    /**
     * Get a config value by path
     * @param path - Dot notation path (e.g., 'app.LOG_LEVEL')
     * @returns The value at the specified path
     */
    public getConfigValue(path: string): any {
        if (!this.config) {
            systemLogger.warn('Config not loaded');
            return undefined;
        }
        
        const pathParts = path.split('.');
        let current = this.config;
        
        for (const part of pathParts) {
            if (current && typeof current === 'object' && part in current) {
                current = current[part];
            } else {
                return undefined;
            }
        }
        
        return current;
    }

    /**
     * Check if a config path exists
     * @param path - Dot notation path
     * @returns boolean indicating if path exists
     */
    public hasConfigPath(path: string): boolean {
        return this.getConfigValue(path) !== undefined;
    }

    /**
     * Save current config to YAML file
     * @returns boolean indicating success
     */
    private saveConfigToFile(): boolean {
        try {
            const yamlContent = yaml.dump(this.config, {
                indent: 2,
                lineWidth: -1,
                quotingType: '"',
                forceQuotes: false
            });
            
            // Add header comment
            const headerComment = '# Configuration\n# Fill in your actual values\n\n';
            const finalContent = headerComment + yamlContent;
            
            fs.writeFileSync(this.configPath, finalContent, 'utf8');
            
            systemLogger.debug('Config saved to file', { path: this.configPath });
            return true;
            
        } catch (error) {
            systemLogger.error('Failed to save config to file', { path: this.configPath, error });
            return false;
        }
    }

    /**
     * Create a backup of current config
     * @returns string path to backup file
     */
    public createBackup(): string | null {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupPath = this.configPath.replace('.yaml', `.backup.${timestamp}.yaml`);
            
            fs.copyFileSync(this.configPath, backupPath);
            
            systemLogger.info('Config backup created', { backupPath });
            return backupPath;
            
        } catch (error) {
            systemLogger.error('Failed to create config backup', error);
            return null;
        }
    }

    /**
     * Restore config from backup
     * @param backupPath - Path to backup file
     * @returns boolean indicating success
     */
    public restoreFromBackup(backupPath: string): boolean {
        try {
            if (!fs.existsSync(backupPath)) {
                systemLogger.error('Backup file not found', { backupPath });
                return false;
            }
            
            fs.copyFileSync(backupPath, this.configPath);
            this.reloadConfig();
            
            systemLogger.info('Config restored from backup', { backupPath });
            return true;
            
        } catch (error) {
            systemLogger.error('Failed to restore config from backup', { backupPath, error });
            return false;
        }
    }

    /**
     * Watch config file for changes and auto-reload
     * @param callback - Optional callback to run after reload
     */
    public watchConfig(callback?: () => void): boolean {
        try {
            fs.watchFile(this.configPath, (curr, prev) => {
                if (curr.mtime !== prev.mtime) {
                    systemLogger.info('Config file changed, reloading...', {
                        path: this.configPath,
                        mtime: curr.mtime
                    });
                    
                    this.reloadConfig();
                    
                    if (callback) {
                        callback();
                    }
                }
            });
            
            systemLogger.debug('Config file watcher started', { path: this.configPath });
            return true;
            
        } catch (error) {
            systemLogger.error('Failed to start config file watcher', error);
            return false;
        }
    }

    /**
     * Stop watching config file
     */
    public unwatchConfig(): void {
        try {
            fs.unwatchFile(this.configPath);
            systemLogger.debug('Config file watcher stopped', { path: this.configPath });
        } catch (error) {
            systemLogger.error('Failed to stop config file watcher', error);
        }
    }
}

// Create a singleton instance
export const configChecker = new ConfigChecker();

// Export the class for custom instances
export { ConfigChecker, ServiceStatus, SystemStatus };
