import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { createPendingVerification, getOAuthLink, getUserRow } from '../../../db_utilities/postgres';
import { randomBytes } from 'crypto';
import { Command } from '../../../types/command';
import { discordLogger as logger } from '../../../logger';

export const command: Command = {
    data: new SlashCommandBuilder()
        .setName('link')
        .setDescription('Habbo hesabınızı Discord hesabınıza bağlayın')
        .addStringOption(option =>
            option.setName('username')
                .setDescription('Habbo kullanıcı adınız')
                .setRequired(true)
        ),
    cooldown: 5, // 60 saniye cooldown
    async exec(interaction) {
        try {
            // Komut başlangıcını logla
            logger.info('Starting verify command execution:', {
                userId: interaction.user.id,
                username: interaction.user.username
            });

            // Önce mevcut bir bağlantı var mı kontrol et
            const existingLink = await getOAuthLink(interaction.user.id);
            if (existingLink) {
                logger.info('User already has OAuth link:', {
                    userId: interaction.user.id,
                    existingLink
                });
                await interaction.reply({
                    content: '❌ Discord hesabınız zaten bir Habbo hesabına bağlı!',
                    ephemeral: true
                });
                return;
            }

            let username = interaction.options.getString('username', true);
            username = username.toLowerCase();
            
            // 8 karakterlik rastgele bir doğrulama kodu oluştur
            const verificationCode = randomBytes(4).toString('hex').toUpperCase();
            
            // 15 dakika sonra geçersiz olacak şekilde ayarla
            const expiresAt = new Date();
            expiresAt.setMinutes(expiresAt.getMinutes() + 15);

            logger.debug('Creating verification request:', {
                verificationCode,
                discordId: interaction.user.id,
                username,
                expiresAt
            });

            await createPendingVerification({
                verification_code: verificationCode,
                discord_id: BigInt(interaction.user.id),
                requested_username: username,
                expires_at: expiresAt
            });

            logger.info('Verification created successfully:', {
                verificationCode,
                discordId: interaction.user.id,
                username
            });

            await interaction.reply({
                content: `✅ Doğrulama kodunuz: **${verificationCode}**\n\n` +
                        '1. JÖH sitesinde menüden "Discord\'a Bağla" sayfasına gidin\n' +
                        '2. Yukarıdaki kodu girin ve bağlantıyı tamamlayın\n' +
                        '⚠️ Bu kod 15 dakika sonra geçersiz olacaktır.',
                ephemeral: true
            });
            return;

        } catch (error: any) {
            logger.error('Error in verify command:', {
                error: {
                    message: error.message,
                    code: error.code,
                    stack: error.stack,
                    name: error.name,
                    detail: error.detail
                },
                context: {
                    userId: interaction.user.id,
                    username: interaction.user.username,
                    requestedUsername: interaction.options.getString('username', true)
                }
            });

            await interaction.reply({
                content: '❌ Bir hata oluştu. Lütfen daha sonra tekrar deneyin.',
                ephemeral: true
            });
            return;
        }
    }
};