import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../../types/command';
import { discordLogger as logger } from '../../../logger';
import { getOAuthLink, getCodename, createCodename, getUserRow } from '../../../db_utilities/postgres';

export const command: Command = {
    data: new SlashCommandBuilder()
        .setName('kod')
        .setDescription('Kod yönetimi komutları')
        .addSubcommand(subcommand =>
            subcommand
                .setName('ayarla')
                .setDescription('Yeni kod ayarla')
                .addStringOption(option =>
                    option
                        .setName('kod')
                        .setDescription('Ayarlamak istediğiniz kod')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('goruntule')
                .setDescription('Mevcut kodunuzu görüntüleyin')
        ),
    cooldown: 10, // 10 saniye cooldown
    async exec(interaction: ChatInputCommandInteraction) {
        try {
            // Discord bağlantısını kontrol et
            const oauthLink = await getOAuthLink(interaction.user.id);
            if (!oauthLink) {
                await interaction.reply({
                    content: '❌ Önce Discord hesabınızı JÖH hesabınıza bağlamalısınız!\n' +
                            'Site üzerinden Discord hesabınızı bağlayın.',
                    ephemeral: true
                });
                return;
            }

            const user = await getUserRow({
                in: 'id',
                value: oauthLink.user_id,
                out: 'all'
            });

            if (!user) {
                await interaction.reply({
                    content: '❌ Kullanıcı bilgileri bulunamadı!',
                    ephemeral: true
                });
                return;
            }

            const subcommand = interaction.options.getSubcommand();

            if (subcommand === 'ayarla') {
                const code = interaction.options.getString('kod', true);

                // Kod formatını kontrol et (örnek: sadece harf ve rakam, en az 3 karakter)
                if (!/^[a-zA-Z0-9]{1,}$/.test(code)) {
                    await interaction.reply({
                        content: '❌ Kod en az 1 karakter uzunluğunda olmalı ve sadece harf ve rakam içermelidir!',
                        ephemeral: true
                    });
                    return;
                }

                // Kodun başka biri tarafından kullanılıp kullanılmadığını kontrol et
                const existingCode = await getCodename({
                    in: 'codename',
                    value: code,
                    out: 'all'
                });

                if (existingCode) {
                    await interaction.reply({
                        content: '❌ Bu kod başka bir kullanıcı tarafından kullanılıyor!',
                        ephemeral: true
                    });
                    return;
                }

                // Kullanıcının mevcut bir kodu var mı kontrol et
                const currentCode = await getCodename({
                    in: 'id',
                    value: oauthLink.user_id,
                    out: 'all'
                });

                if (currentCode) {
                    await interaction.reply({
                        content: '❌ Zaten bir kodunuz var: `' + currentCode.codename + '`\n' +
                                'Tek bir kod kullanabilirsiniz.',
                        ephemeral: true
                    });
                    return;
                }

                // Yeni kodu kaydet
                await createCodename({
                    id: oauthLink.user_id,
                    username: user.username,
                    codename: code
                });

                logger.info('Code set successfully:', {
                    userId: oauthLink.user_id,
                    username: user.username,
                    code: code
                });

                await interaction.reply({
                    content: '✅ Kodunuz başarıyla ayarlandı: `' + code + '`\n' +
                            'Artık terfi işlemlerinde bu kod kullanılacak.',
                    ephemeral: true
                });

            } else if (subcommand === 'goruntule') {
                const code = await getCodename({
                    in: 'id',
                    value: oauthLink.user_id,
                    out: 'all'
                });

                if (!code) {
                    await interaction.reply({
                        content: '❌ Henüz bir kodunuz yok!\n' +
                                '`/kod ayarla` komutunu kullanarak yeni bir kod ayarlayabilirsiniz.',
                        ephemeral: true
                    });
                    return;
                }

                await interaction.reply({
                    content: '📋 Mevcut kodunuz: `' + code.codename + '`',
                    ephemeral: true
                });
            }

        } catch (error) {
            logger.error('Error in code command:', error);
            await interaction.reply({
                content: '❌ Bir hata oluştu! Lütfen daha sonra tekrar deneyin.',
                ephemeral: true
            });
        }
    }
};