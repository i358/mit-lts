import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../../types/command';
import { discordLogger as logger } from '../../../logger';
import { getOAuthLink, deleteOAuthLink } from '../../../db_utilities/postgres';

export const command: Command = {
    data: new SlashCommandBuilder()
        .setName('unlink')
        .setDescription('Discord hesabınızın JÖH bağlantısını kaldırın'),
    cooldown: 60, // 60 saniye cooldown
    async exec(interaction: ChatInputCommandInteraction) {
        try {
            // Komut başlangıcını logla
            logger.info('Starting unlink command execution:', {
                userId: interaction.user.id,
                username: interaction.user.username
            });

            // Kullanıcının OAuth bağlantısını kontrol et
            const existingLink = await getOAuthLink(interaction.user.id);
            if (!existingLink) {
                logger.info('No OAuth link found:', {
                    userId: interaction.user.id
                });
                await interaction.reply({
                    content: '❌ Discord hesabınız zaten herhangi bir Habbo hesabına bağlı değil!',
                    ephemeral: true
                });
                return;
            }

            // OAuth bağlantısını sil
            await deleteOAuthLink(interaction.user.id);
            
            logger.info('OAuth link deleted successfully:', {
                userId: interaction.user.id,
                username: interaction.user.username
            });

            await interaction.reply({
                content: '✅ Discord hesabınızın JÖH bağlantısı başarıyla kaldırıldı!\n\n' +
                        'Artık hesabınız bağlı değil ve JÖH komutlarını kullanamayacaksınız.\n' +
                        'Tekrar bağlamak için `/verify` komutunu kullanabilirsiniz.',
                ephemeral: true
            });

        } catch (error) {
            logger.error('Error in unlink command:', error);
            await interaction.reply({
                content: '❌ Bağlantıyı kaldırırken bir hata oluştu. Lütfen daha sonra tekrar deneyin.',
                ephemeral: true
            });
        }
    }
};