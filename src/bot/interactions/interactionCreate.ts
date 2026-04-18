import { Client, Events, Interaction } from "discord.js";
import { Event } from "../../types/event";
import { Command } from "../../types/command";
import { globalStore } from "../../utils/globalStore";
import { createLogger, LogLevel } from "../../logger";
import { ErrorEmbed } from "../utils/embeds";

const logger = createLogger({ 
    logLevel: LogLevel.INFO,
    writeToFile: true,
    logFilePath: './logs/discord.log',
    module: "InteractionCreate" 
});

const interactionCreateEvent: Event = {
    name: Events.InteractionCreate,
    async exec(client: Client, interaction: Interaction): Promise<void> {
        if (interaction.isAutocomplete()) {
            if (interaction.commandName === 'terfi') {
                try {
                    const { handleBadgeAutocomplete } = await import('./badgeAutocomplete');
                    await handleBadgeAutocomplete(interaction);
                } catch (error) {
                    logger.error('Error handling badge autocomplete:', error);
                    await interaction.respond([]);
                }
            }
            return;
        }

        if (!interaction.isChatInputCommand()) return;

        // Get config from global store (correct way)
        const globalConfig = globalStore.collection<string, any>("config");
        const config = globalConfig.get("app");
        
        if (!config) {
            logger.warn("App configuration not found, cannot validate interaction");
            return;
        }

        // Check if interaction is in the allowed guild
        const allowedGuildId = config.DISCORD_BOT?.GUILD_ID;
        
        if (!allowedGuildId || interaction.guildId !== allowedGuildId) {
            logger.warn(`Command ${interaction.commandName} used in unauthorized guild: ${interaction.guildId}`);
            const embed = ErrorEmbed('Unauthorized Server', 'This bot can only be used in the authorized server.');
            await interaction.reply({ embeds: [embed], ephemeral: true });
            return;
        }

        // Check if interaction is in the allowed channel
        const allowedChannelId = config.DISCORD_BOT?.CHANNELS?.COMMANDS;
        if (allowedChannelId && interaction.channelId !== allowedChannelId) {
            const channelMention = `<#${allowedChannelId}>`;
            logger.warn(`Command ${interaction.commandName} used in unauthorized channel: ${interaction.channelId}`);
            const embed = ErrorEmbed('Wrong Channel', `Commands can only be used in ${channelMention}.`);
            await interaction.reply({ embeds: [embed], ephemeral: true });
            return;
        }

        const commandsStore = globalStore.collection<string, Command>("commands");
        const command = commandsStore.get(interaction.commandName);

        if (!command) {
            logger.warn(`No command matching ${interaction.commandName} was found.`);
            const embed = ErrorEmbed('Command Not Found', 'The requested command was not found.');
            await interaction.reply({ embeds: [embed], ephemeral: true });
            return;
        }

        // Check if command is admin-only
        if (command.onlyAuthor) {
            const adminIds = config.DISCORD_BOT?.ADMINS || [];
            if (!adminIds.includes(interaction.user.id)) {
                logger.warn(`User ${interaction.user.tag} (${interaction.user.id}) tried to use admin-only command: ${interaction.commandName}`);
                const embed = ErrorEmbed('Insufficient Permissions', 'This command can only be used by authorized users.');
                await interaction.reply({ embeds: [embed], ephemeral: true });
                return;
            }
        }

        // Helper function to determine if response should be ephemeral
        const shouldBeEphemeral = (): boolean => {
            // Eğer command.ephemeral tanımlıysa, onu kullan
            if (typeof command.ephemeral === 'boolean') {
                return command.ephemeral;
            }
            
            // Varsayılan olarak, admin-only komutlar ephemeral, diğerleri değil
            return command.onlyAuthor || false;
        };

        // Check cooldown
        if (command.cooldown) {
            const cooldownStore = globalStore.collection<string, number>("cooldowns");
            const cooldownKey = `${interaction.user.id}_${interaction.commandName}`;
            const now = Date.now();
            const cooldownAmount = Number(command.cooldown) * 1000; // Convert to milliseconds
            
            if (cooldownStore.has(cooldownKey)) {
                const expirationTime = cooldownStore.get(cooldownKey)! + cooldownAmount;
                
                if (now < expirationTime) {
                    const timeLeft = (expirationTime - now) / 1000;
                    logger.debug(`User ${interaction.user.tag} tried to use ${interaction.commandName} but is on cooldown for ${timeLeft}s`);
                    
                    const embed = ErrorEmbed('Command Cooldown', `Please wait ${timeLeft.toFixed(1)} more seconds before using this command again.`);
                    await interaction.reply({ embeds: [embed], ephemeral: shouldBeEphemeral() });
                    return;
                }
            }
            
            // Set the cooldown
            cooldownStore.set(cooldownKey, now);
            
            // Remove the cooldown after it expires
            setTimeout(() => {
                cooldownStore.delete(cooldownKey);
                logger.debug(`Cooldown expired for ${cooldownKey}`);
            }, cooldownAmount);
        }

        try {
            logger.info(`Executing command: ${interaction.commandName} by ${interaction.user.tag} (${interaction.user.id}) in guild: ${interaction.guildId}`);
            await command.exec(interaction);
            logger.debug(`Command ${interaction.commandName} executed successfully`);
        } catch (error) {
            logger.error(`Error executing command ${interaction.commandName}:`, error);
            
            const embed = ErrorEmbed('Command Error', 'There was an error while executing this command!');
            
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ embeds: [embed], ephemeral: shouldBeEphemeral() });
            } else {
                await interaction.reply({ embeds: [embed], ephemeral: shouldBeEphemeral() });
            }
        }
    }
};

export = interactionCreateEvent;
