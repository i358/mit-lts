import * as fs from "fs";
import * as path from "path";
import { Client } from "discord.js";
import { Event } from "../../types/event";
import { createLogger, LogLevel } from "../../logger";
import { globalStore } from "../../utils/globalStore";

const logger = createLogger({ 
    logLevel: LogLevel.INFO,
    writeToFile: true,
    logFilePath: './logs/discord.log',
    module: "EventLoader" 
});

/**
 * Event loader utility for Discord bot
 * Automatically discovers and loads event files from interactions directory
 */
export class EventLoader {
    private client: Client;
    private eventsPath: string;

    constructor(client: Client, eventsDir?: string) {
        this.client = client;
        // Use the correct path for compiled JavaScript files
        // __dirname in compiled code will be dist/src/bot/utils, so we go up to get to interactions
        this.eventsPath = eventsDir || path.join(__dirname, '..', 'interactions');
    }

    /**
     * Loads all events from the interactions directory
     * Expected structure: interactions/eventFile.js
     * @returns Promise<number> - Number of events loaded
     */
    public async loadEvents(): Promise<number> {
        logger.info("Starting event loading process...");
        
        // Get or create events collection from global store
        const eventsStore = globalStore.collection<string, Event>("events");
        let loadedCount = 0;

        try {
            // Check if events directory exists
            if (!fs.existsSync(this.eventsPath)) {
                logger.warn(`Events directory not found: ${this.eventsPath}`);
                logger.info("Creating events directory...");
                fs.mkdirSync(this.eventsPath, { recursive: true });
                return 0;
            }

            // Get all JS files in the events directory
            const eventFiles = fs.readdirSync(this.eventsPath)
                .filter(file => file.endsWith('.js'));

            if (eventFiles.length === 0) {
                logger.warn("No event files found in interactions directory");
                return 0;
            }

            logger.info(`Found ${eventFiles.length} event file(s): ${eventFiles.join(', ')}`);

            // Load each event file
            for (const file of eventFiles) {
                const filePath = path.join(this.eventsPath, file);
                
                try {
                    logger.debug(`Attempting to load event from: ${filePath}`);
                    
                    // Clear require cache for hot reloading
                    delete require.cache[require.resolve(filePath)];
                    
                    // Import the event
                    const eventModule = require(filePath);
                    const event: Event = eventModule.default || eventModule;

                    logger.debug(`Event module loaded:`, { hasDefault: !!eventModule.default, hasEvent: !!event });

                    // Validate event structure
                    if (!this.validateEvent(event, filePath)) {
                        continue;
                    }

                    // Register event with Discord client
                    if (event.once) {
                        this.client.once(event.name, (...args) => event.exec(this.client, ...args));
                        logger.debug(`Registered once event: ${event.name} from ${file}`);
                    } else {
                        this.client.on(event.name, (...args) => event.exec(this.client, ...args));
                        logger.debug(`Registered event: ${event.name} from ${file}`);
                    }

                    // Store event in global store
                    const eventKey = `${event.name}_${file}`;
                    eventsStore.set(eventKey, event);
                    
                    loadedCount++;
                    logger.debug(`Loaded event: ${event.name} from ${file}`);

                } catch (error) {
                    logger.error(`Failed to load event from ${filePath}:`, error);
                    if (error instanceof Error) {
                        logger.error(`File loading error details - Name: ${error.name}, Message: ${error.message}`);
                    }
                }
            }

            logger.info(`Successfully loaded ${loadedCount} event(s)`);
            
            return loadedCount;

        } catch (error) {
            logger.error("Error during event loading:", error);
            if (error instanceof Error) {
                logger.error("Error name:", error.name);
                logger.error("Error message:", error.message);
                logger.error("Error stack:", error.stack);
            }
            throw error;
        }
    }

    /**
     * Validates if an event object has the required properties
     * @param event - Event object to validate
     * @param filePath - File path for error reporting
     * @returns boolean - Whether the event is valid
     */
    private validateEvent(event: any, filePath: string): event is Event {
        if (!event) {
            logger.warn(`Event from ${filePath} is null or undefined`);
            return false;
        }

        if (!event.name) {
            logger.warn(`Event from ${filePath} is missing required "name" property`);
            return false;
        }

        if (!event.exec || typeof event.exec !== 'function') {
            logger.warn(`Event from ${filePath} is missing required "exec" function`);
            return false;
        }

        return true;
    }

    /**
     * Gets an event by name from the global store
     * @param eventName - Name of the event to retrieve
     * @returns Event[] - Array of events with the given name
     */
    public getEvents(eventName: string): Event[] {
        const eventsStore = globalStore.collection<string, Event>("events");
        const events: Event[] = [];
        
        eventsStore.forEach((event, key) => {
            if (event.name === eventName) {
                events.push(event);
            }
        });
        
        return events;
    }

    /**
     * Lists all loaded events
     * @returns Event[] - Array of all loaded events
     */
    public getAllEvents(): Event[] {
        const eventsStore = globalStore.collection<string, Event>("events");
        return Array.from(eventsStore.values());
    }

    /**
     * Reloads all events (useful for hot reloading)
     * @returns Promise<number> - Number of events reloaded
     */
    public async reloadEvents(): Promise<number> {
        logger.info("Reloading all events...");
        
        // Clear existing events
        const eventsStore = globalStore.collection<string, Event>("events");
        eventsStore.clear();
        
        // Remove all listeners (be careful with this in production)
        this.client.removeAllListeners();
        
        return await this.loadEvents();
    }

    /**
     * Gets event loading statistics
     * @returns Object with loading stats
     */
    public getStats() {
        const eventsStore = globalStore.collection<string, Event>("events");
        const events = this.getAllEvents();
        
        const eventTypes = new Map<string, number>();
        const onceEvents = events.filter(event => event.once).length;
        
        events.forEach(event => {
            const count = eventTypes.get(event.name) || 0;
            eventTypes.set(event.name, count + 1);
        });
        
        const stats = {
            totalEvents: events.length,
            onceEvents: onceEvents,
            regularEvents: events.length - onceEvents,
            eventsByType: Object.fromEntries(eventTypes)
        };

        return stats;
    }
}

/**
 * Creates and returns a new EventLoader instance
 * @param client - Discord client instance
 * @param eventsDir - Optional custom events directory path
 * @returns EventLoader instance
 */
export function createEventLoader(client: Client, eventsDir?: string): EventLoader {
    return new EventLoader(client, eventsDir);
}
