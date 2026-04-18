import { Client, Events } from "discord.js";
import { Event } from "../../types/event";
import { createLogger, LogLevel } from "../../logger";

const logger = createLogger({ 
    logLevel: LogLevel.INFO,
    writeToFile: true,
    logFilePath: './logs/discord.log',
    module: "Ready" 
});

const readyEvent: Event = {
    name: Events.ClientReady,
    once: false, // run.ts'deki once event'i ile çakışmasın diye
    async exec(client: Client): Promise<void> {
        // Set bot status
        client.user?.setActivity('HabboJÖH | /help', { type: 0 }); // 0 = Playing
        
        logger.debug(`Bot status set successfully`);
    }
};

export = readyEvent;
