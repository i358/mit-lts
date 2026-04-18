import { Client, GatewayIntentBits, Events } from "discord.js";
import { globalStore } from "../utils/globalStore";
import { discordLogger, LogLevel } from "../logger";
import { createCommandLoader } from "./utils/commandLoader";
import { createEventLoader } from "./utils/eventLoader";
import { createRestCommandManager } from "./utils/restCommandManager";
import { config } from "../config";

discordLogger.setLogLevel(LogLevel.DEBUG);

// Load config into global store (correct way)
const globalConfig = globalStore.collection<string, any>("config");
globalConfig.set("proxy", config().proxy);
globalConfig.set("api", config().api);
globalConfig.set("app", config().app);

export const client = new Client({intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers]});

discordLogger.info("Discord bot is starting...");

// Command loader'ı oluştur
const commandLoader = createCommandLoader(client);
const eventLoader = createEventLoader(client);

const commands = globalStore.collection<string, any>("commands");

Object.defineProperty(client, 'commands', {
    get: () => commands,
    enumerable: true,
    configurable: true
});

// Bot hazır olduğunda komutları yükle
client.once(Events.ClientReady, async (readyClient) => {
    try {
        // Event'leri yükle (ready event'i dahil olmak üzere)
        const loadedEventsCount = await eventLoader.loadEvents();
        discordLogger.info(`Loaded ${loadedEventsCount} event(s) successfully`);
        
        // Event istatistikleri
        const eventStats = eventLoader.getStats();
        discordLogger.debug("Event loading statistics:", eventStats);
        
        // Komutları yükle
        const loadedCount = await commandLoader.loadCommands();
        discordLogger.info(`Loaded ${loadedCount} command(s) successfully`);
        
        // Komut istatistikleri
        const stats = commandLoader.getStats();
        discordLogger.debug("Command loading statistics:", stats);
        
        // REST API ile komutları Discord'a kaydet
        const restManager = createRestCommandManager(readyClient.user.id);
        if (restManager) {
            try {
                const registeredCount = await restManager.registerCommands();
                discordLogger.info(`Registered ${registeredCount} command(s) with Discord API`);
            } catch (error) {
                discordLogger.error("Failed to register commands with Discord API", error);
            }
        } else {
            discordLogger.warn("Could not create REST command manager - commands not registered");
        }
        
    } catch (error) {
        discordLogger.error("Failed to load commands or events", error);
    }
});

const MAX_RETRY_ATTEMPTS = 5;
const RETRY_DELAY = 5000; // 5 seconds

async function loginWithRetry(attempt = 1): Promise<void> {
    try {
        await client.login(process.env.TOKEN);
        discordLogger.info("Discord bot logged in successfully");

        // Global store'a client'ı kaydet - collection kullan
        const clientStore = globalStore.collection<string, any>("system");
        clientStore.set('discordClient', client);
    } catch (error) {
        discordLogger.error(`Failed to login to Discord (Attempt ${attempt}/${MAX_RETRY_ATTEMPTS})`, error);
        
        if (attempt < MAX_RETRY_ATTEMPTS) {
            discordLogger.info(`Retrying in ${RETRY_DELAY / 1000} seconds...`);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
            return loginWithRetry(attempt + 1);
        } else {
            discordLogger.warn("Maximum retry attempts reached. Bot will continue running without Discord functionality.");
            // Don't exit - just let the application continue without Discord
        }
    }
}

// Start the login process
loginWithRetry();