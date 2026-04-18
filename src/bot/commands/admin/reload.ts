import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { Command } from "../../../types/command";
import { globalStore } from "../../../utils/globalStore";
import { SuccessEmbed, ErrorEmbed, LoadingEmbed } from "../../utils/embeds";

const reloadCommand: Command = {
    data: new SlashCommandBuilder()
        .setName('reload')
        .setDescription('Reloads all commands and events (Admin only)'),
    cooldown: 10,
    onlyAuthor: true,
    ephemeral: true, // Reload komutu ephemeral olarak kalacak
    async exec(interaction: ChatInputCommandInteraction): Promise<void> {
        // İlk olarak loading embed ile yanıtla
        const loadingEmbed = LoadingEmbed('System Reloading', 'Please wait while the system is being reloaded...');
        await interaction.reply({ embeds: [loadingEmbed], ephemeral: true });

        try {
            // Get loaders from global store if available, or create new ones
            const systemStore = globalStore.collection<string, any>("system");
            const client = systemStore.get('discordClient');
            
            if (!client) {
                const errorEmbed = ErrorEmbed('Error', 'Could not access Discord client.');
                await interaction.editReply({ embeds: [errorEmbed] });
                return;
            }

            // Import loaders
            const { createCommandLoader } = await import("../../utils/commandLoader");
            const { createEventLoader } = await import("../../utils/eventLoader");
            const { createRestCommandManager } = await import("../../utils/restCommandManager");

            const commandLoader = createCommandLoader(client);
            const eventLoader = createEventLoader(client);

            const startTime = Date.now();

            // Reload events
            const eventsCount = await eventLoader.reloadEvents();
            
            // Reload commands
            const commandsCount = await commandLoader.reloadCommands();
            
            // Re-register commands with Discord API
            const restManager = createRestCommandManager(client.user?.id);
            let registeredCount = 0;
            
            if (restManager) {
                registeredCount = await restManager.registerCommands();
            }

            const endTime = Date.now();
            const duration = (endTime - startTime) / 1000;

            const fields = [
                { name: '📁 Events', value: `${eventsCount} loaded`, inline: true },
                { name: '⚡ Commands', value: `${commandsCount} loaded`, inline: true },
                { name: '📡 API Registration', value: `${registeredCount} registered`, inline: true },
                { name: '⏱️ Duration', value: `${duration.toFixed(2)}s`, inline: true }
            ];

            const embed = SuccessEmbed(
                'System Reloaded',
                'All system components have been successfully reloaded.',
                fields
            );
            
            embed.setFooter({ text: 'Habbo JÖH Bot - Admin Panel' });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Reload command error:', error);
            const errorEmbed = ErrorEmbed('Reload Failed', 'An error occurred while reloading the system.');
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
};

export = reloadCommand;
