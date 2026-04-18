import * as fs from "fs";
import * as path from "path";
import { Client } from "discord.js";
import { Command } from "../../types/command";
import { createLogger, LogLevel } from "../../logger";
import { globalStore } from "../../utils/globalStore";

const logger = createLogger({ 
    logLevel: LogLevel.INFO,
    writeToFile: true,
    logFilePath: './logs/discord.log',
    module: "CommandLoader" 
});

/**
 * Command loader utility for Discord bot
 * Automatically discovers and loads command files from commands directory
 */
export class CommandLoader {
    private client: Client;
    private commandsPath: string;

    constructor(client: Client, commandsDir?: string) {
        this.client = client;
        // Use the correct path for compiled JavaScript files
        // __dirname in compiled code will be dist/src/bot/utils, so we go up to get to commands
        this.commandsPath = commandsDir || path.join(__dirname, '..', 'commands');
    }

    /**
     * Loads all commands from the commands directory structure
     * Expected structure: commands/category/commandFile.js
     * @returns Promise<number> - Number of commands loaded
     */
    public async loadCommands(): Promise<number> {
        logger.info("Starting command loading process...");
        
        // Get or create commands collection from global store
        const commandsStore = globalStore.collection<string, Command>("commands");
        let loadedCount = 0;

        try {
            // Check if commands directory exists
            if (!fs.existsSync(this.commandsPath)) {
                logger.warn(`Commands directory not found: ${this.commandsPath}`);
                logger.info("Creating commands directory...");
                fs.mkdirSync(this.commandsPath, { recursive: true });
                return 0;
            }

            // Read command folders (categories)
            const commandFolders = fs.readdirSync(this.commandsPath, { withFileTypes: true })
                .filter(dirent => dirent.isDirectory())
                .map(dirent => dirent.name);

            if (commandFolders.length === 0) {
                logger.warn("No command folders found in commands directory");
                return 0;
            }

            logger.info(`Found ${commandFolders.length} command folder(s): ${commandFolders.join(', ')}`);

            // Process each command folder
            for (const folder of commandFolders) {
                const folderPath = path.join(this.commandsPath, folder);
                logger.debug(`Processing command folder: ${folder}`);

                // Get all JS files in the folder (compiled from TypeScript)
                const commandFiles = fs.readdirSync(folderPath)
                    .filter(file => file.endsWith('.js'));

                if (commandFiles.length === 0) {
                    logger.debug(`No command files found in folder: ${folder}`);
                    continue;
                }

                // Load each command file
                for (const file of commandFiles) {
                    const filePath = path.join(folderPath, file);
                    
                    try {
                        logger.debug(`Attempting to load command from: ${filePath}`);
                        
                        // Clear require cache for hot reloading
                        delete require.cache[require.resolve(filePath)];
                        
                        // Import the command
                        const commandModule = require(filePath);
                        const command: Command = commandModule.default || commandModule.command || commandModule;

                        logger.debug(`Command module loaded:`, { hasDefault: !!commandModule.default, hasCommand: !!command });

                        // Validate command structure
                        if (!this.validateCommand(command, filePath)) {
                            continue;
                        }

                        // Store command in global store
                        const commandName = command.data.name;
                        commandsStore.set(commandName, command);
                        
                        loadedCount++;
                        logger.debug(`Loaded command: ${commandName} from ${folder}/${file}`);

                    } catch (error) {
                        logger.error(`Failed to load command from ${filePath}:`, error);
                        if (error instanceof Error) {
                            logger.error(`File loading error details - Name: ${error.name}, Message: ${error.message}`);
                        }
                    }
                }
            }

            logger.info(`Successfully loaded ${loadedCount} command(s)`);
            
            return loadedCount;

        } catch (error) {
            logger.error("Error during command loading:", error);
            if (error instanceof Error) {
                logger.error("Error name:", error.name);
                logger.error("Error message:", error.message);
                logger.error("Error stack:", error.stack);
            }
            throw error;
        }
    }

    /**
     * Validates if a command object has the required properties
     * @param command - Command object to validate
     * @param filePath - File path for error reporting
     * @returns boolean - Whether the command is valid
     */
    private validateCommand(command: any, filePath: string): command is Command {
        if (!command) {
            logger.warn(`Command from ${filePath} is null or undefined`);
            return false;
        }

        if (!command.data) {
            logger.warn(`Command from ${filePath} is missing required "data" property`);
            return false;
        }

        if (!command.exec || typeof command.exec !== 'function') {
            logger.warn(`Command from ${filePath} is missing required "exec" function`);
            return false;
        }

        if (!command.data.name) {
            logger.warn(`Command from ${filePath} is missing command name in data property`);
            return false;
        }

        return true;
    }

    /**
     * Gets a command by name from the global store
     * @param commandName - Name of the command to retrieve
     * @returns Command | undefined
     */
    public getCommand(commandName: string): Command | undefined {
        const commandsStore = globalStore.collection<string, Command>("commands");
        return commandsStore.get(commandName);
    }

    /**
     * Lists all loaded commands
     * @returns Command[] - Array of all loaded commands
     */
    public getAllCommands(): Command[] {
        const commandsStore = globalStore.collection<string, Command>("commands");
        return Array.from(commandsStore.values());
    }

    /**
     * Reloads all commands (useful for hot reloading)
     * @returns Promise<number> - Number of commands reloaded
     */
    public async reloadCommands(): Promise<number> {
        logger.info("Reloading all commands...");
        
        // Clear existing commands
        const commandsStore = globalStore.collection<string, Command>("commands");
        commandsStore.clear();
        
        return await this.loadCommands();
    }

    /**
     * Gets command loading statistics
     * @returns Object with loading stats
     */
    public getStats() {
        const commandsStore = globalStore.collection<string, Command>("commands");
        const commands = this.getAllCommands();
        
        const stats = {
            totalCommands: commands.length,
            commandsWithCooldown: commands.filter(cmd => cmd.cooldown !== undefined).length,
            adminOnlyCommands: commands.filter(cmd => cmd.onlyAuthor === true).length,
            commandsByCategory: {} as Record<string, number>
        };

        // Count commands by category (based on file structure)
        try {
            if (fs.existsSync(this.commandsPath)) {
                const folders = fs.readdirSync(this.commandsPath, { withFileTypes: true })
                    .filter(dirent => dirent.isDirectory())
                    .map(dirent => dirent.name);

                for (const folder of folders) {
                    const folderPath = path.join(this.commandsPath, folder);
                    const fileCount = fs.readdirSync(folderPath)
                        .filter(file => file.endsWith('.js')).length;
                    stats.commandsByCategory[folder] = fileCount;
                }
            }
        } catch (error) {
            logger.debug("Error getting category stats:", error);
        }

        return stats;
    }
}

/**
 * Creates and returns a new CommandLoader instance
 * @param client - Discord client instance
 * @param commandsDir - Optional custom commands directory path
 * @returns CommandLoader instance
 */
export function createCommandLoader(client: Client, commandsDir?: string): CommandLoader {
    return new CommandLoader(client, commandsDir);
}
