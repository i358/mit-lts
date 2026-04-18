import { AutocompleteInteraction } from 'discord.js';
import * as fs from 'fs';
import * as path from 'path';
import { createLogger, LogLevel } from '../../logger';

const logger = createLogger({
    logLevel: LogLevel.DEBUG,
    writeToFile: true,
    logFilePath: '../logs/badge.log',
    module: "Badge"
});

interface BadgeData {
    id: number;
    ranks: string[];
    duration: number;
}

export async function handleBadgeAutocomplete(interaction: AutocompleteInteraction) {
    const focusedOption = interaction.options.getFocused(true);
    const currentInput = focusedOption.value.toLowerCase();

    try {
        // badges.json dosyasını oku
        const badgesPath = path.join(__dirname, '..', '..', '..', 'cache', 'badges.json');
        const badgesData = JSON.parse(fs.readFileSync(badgesPath, 'utf8'));

        if (focusedOption.name === 'rozet') {
            // Badge isimleri için autocomplete
            const badges = Object.keys(badgesData)
                .filter(badge => badge.toLowerCase().includes(currentInput))
                .slice(0, 25)
                .map(badge => ({
                    name: badge,
                    value: badge
                }));

            await interaction.respond(badges);
        } else if (focusedOption.name === 'rutbe') {
            // Seçili badge için rank listesi
            const selectedBadge = interaction.options.getString('rozet');
            if (!selectedBadge) {
                await interaction.respond([]);
                return;
            }

            const badge = Object.entries(badgesData).find(([name]) => name === selectedBadge);
            if (!badge) {
                await interaction.respond([]);
                return;
            }

            const [, badgeData] = badge as [string, BadgeData];
            const ranks = badgeData.ranks
                .filter(rank => rank.toLowerCase().includes(currentInput))
                .map((rank, index) => ({
                    name: rank,
                    value: rank
                }));

            await interaction.respond(ranks);
        }
    } catch (error) {
        logger.error('Badge autocomplete error:', error);
        await interaction.respond([]);
    }
}