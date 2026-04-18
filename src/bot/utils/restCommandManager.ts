import { REST, Routes } from "discord.js";
import { Command } from "../../types/command";
import { globalStore } from "../../utils/globalStore";
import { createLogger, LogLevel } from "../../logger";

const logger = createLogger({ 
    logLevel: LogLevel.INFO,
    writeToFile: true,
    logFilePath: '../../logs/discord.log',
    module: "RestCommandManager" 
});

/**
 * REST API utility for managing Discord slash commands
 * Registers commands with Discord API and handles guild-specific deployment
 */
export class RestCommandManager {
    private rest: REST;
    private clientId: string;

    constructor(token: string, clientId: string) {
        this.rest = new REST({ version: '10' }).setToken(token);
        this.clientId = clientId;
    }

    /**
     * Registers all loaded commands with Discord API for a specific guild
     * @param guildId - Discord guild ID to register commands to
     * @returns Promise<number> - Number of commands registered
     */
    public async registerGuildCommands(guildId: string): Promise<number> {
        logger.info(`Starting guild command registration for guild: ${guildId}...`);
        
        try {
            const commandsStore = globalStore.collection<string, Command>("commands");
            
            if (commandsStore.size === 0) {
                logger.warn("No commands found to register");
                return 0;
            }

            // Convert commands to JSON format for Discord API
            const commandsData = [];
            for (const command of commandsStore.values()) {
                if (command.data && typeof command.data.toJSON === 'function') {
                    commandsData.push(command.data.toJSON());
                    logger.debug(`Prepared command for registration: ${command.data.name}`);
                } else {
                    logger.warn(`Command ${command.data?.name || 'unknown'} does not have valid SlashCommandBuilder data`);
                }
            }

            if (commandsData.length === 0) {
                logger.warn("No valid commands to register with Discord API");
                return 0;
            }

            logger.info(`Registering ${commandsData.length} command(s) to guild ${guildId}...`);

            // Register commands to specific guild (faster, instant updates)
            const data = await this.rest.put(
                Routes.applicationGuildCommands(this.clientId, guildId),
                { body: commandsData }
            ) as any[];

            logger.info(`Successfully registered ${data.length} guild command(s) with Discord API`);
            
            // Log registered commands
            data.forEach(cmd => {
                logger.debug(`Registered: /${cmd.name} - ${cmd.description}`);
            });

            return data.length;

        } catch (error) {
            logger.error("Failed to register guild commands with Discord API:", error);
            if (error instanceof Error) {
                logger.error("Registration error details:", {
                    name: error.name,
                    message: error.message
                });
            }
            throw error;
        }
    }

    /**
     * Registers all loaded commands with Discord API (legacy global method)
     * @returns Promise<number> - Number of commands registered
     */
    public async registerCommands(): Promise<number> {
        logger.info("Starting global command registration with Discord API...");
        
        try {
            const globalConfig = globalStore.collection<string, any>("config");
            const config = globalConfig.get("app");
            
            // Eğer config'de GUILD_ID varsa, guild'e kaydet
            if (config?.DISCORD_BOT?.GUILD_ID) {
                logger.info("Guild ID found in config, registering to guild instead of globally");
                return await this.registerGuildCommands(String(config.DISCORD_BOT.GUILD_ID));
            }

            const commandsStore = globalStore.collection<string, Command>("commands");
            
            if (commandsStore.size === 0) {
                logger.warn("No commands found to register");
                return 0;
            }

            // Convert commands to JSON format for Discord API
            const commandsData = [];
            for (const command of commandsStore.values()) {
                if (command.data && typeof command.data.toJSON === 'function') {
                    commandsData.push(command.data.toJSON());
                    logger.debug(`Prepared command for registration: ${command.data.name}`);
                } else {
                    logger.warn(`Command ${command.data?.name || 'unknown'} does not have valid SlashCommandBuilder data`);
                }
            }

            if (commandsData.length === 0) {
                logger.warn("No valid commands to register with Discord API");
                return 0;
            }

            logger.info(`Registering ${commandsData.length} command(s) globally...`);

            // Register commands globally (slower but doesn't require special permissions)
            const data = await this.rest.put(
                Routes.applicationCommands(this.clientId),
                { body: commandsData }
            ) as any[];

            logger.info(`Successfully registered ${data.length} global command(s) with Discord API`);
            
            // Log registered commands
            data.forEach(cmd => {
                logger.debug(`Registered: /${cmd.name} - ${cmd.description}`);
            });

            return data.length;

        } catch (error) {
            logger.error("Failed to register commands with Discord API:", error);
            if (error instanceof Error) {
                logger.error("Registration error details:", {
                    name: error.name,
                    message: error.message
                });
            }
            throw error;
        }
    }

    /**
     * Clears all registered commands from the guild or globally
     * @param guildId - Optional guild ID to clear guild commands
     * @returns Promise<boolean> - Success status
     */
    public async clearCommands(guildId?: string): Promise<boolean> {
        logger.info(`Clearing all registered commands${guildId ? ` for guild: ${guildId}` : ' globally'}...`);
        
        try {
            if (guildId) {
                await this.rest.put(
                    Routes.applicationGuildCommands(this.clientId, guildId),
                    { body: [] }
                );
                logger.info(`Successfully cleared all registered guild commands for ${guildId}`);
            } else {
                await this.rest.put(
                    Routes.applicationCommands(this.clientId),
                    { body: [] }
                );
                logger.info("Successfully cleared all registered global commands");
            }

            return true;

        } catch (error) {
            logger.error("Failed to clear commands:", error);
            return false;
        }
    }

    /**
     * Gets all registered commands from Discord API
     * @param guildId - Optional guild ID to get guild commands
     * @returns Promise<any[]> - Array of registered commands
     */
    public async getRegisteredCommands(guildId?: string): Promise<any[]> {
        try {
            let commands;
            if (guildId) {
                commands = await this.rest.get(
                    Routes.applicationGuildCommands(this.clientId, guildId)
                ) as any[];
                logger.debug(`Found ${commands.length} registered guild command(s) for ${guildId}`);
            } else {
                commands = await this.rest.get(
                    Routes.applicationCommands(this.clientId)
                ) as any[];
                logger.debug(`Found ${commands.length} registered global command(s)`);
            }

            return commands;

        } catch (error) {
            logger.error("Failed to fetch registered commands:", error);
            return [];
        }
    }
}

/**
 * Creates and returns a new RestCommandManager instance using config values
 * @param clientId - Discord client ID (from client.user.id)
 * @returns RestCommandManager instance
 */
export function createRestCommandManager(clientId?: string): RestCommandManager | null {
    try {
        // Get config from global store (correct way)
        const globalConfig = globalStore.collection<string, any>("config");
        const config = globalConfig.get("app");

        if (!config) {
            logger.error("App configuration not found in global store");
            return null;
        }

        const token = process.env.TOKEN;
        const actualClientId = clientId || String(config.DISCORD_BOT?.CLIENT_ID);

        if (!token) {
            logger.error("Discord bot token not found in environment variables");
            return null;
        }

        if (!actualClientId) {
            logger.error("Discord client ID not found");
            return null;
        }

        logger.debug(`Creating REST manager for client: ${actualClientId}`);
        return new RestCommandManager(token, actualClientId);

    } catch (error) {
        logger.error("Failed to create REST command manager:", error);
        return null;
    }
}
