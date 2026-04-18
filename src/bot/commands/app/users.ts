import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from "discord.js";
import { Command } from "../../../types/command";
import { globalStore } from "../../../utils/globalStore";
import { discordLogger } from "../../../logger";
import { InfoEmbed, ErrorEmbed, LoadingEmbed } from "../../utils/embeds";
import { getAllUsers } from "../../../db_utilities";

const usersCommand: Command = {
    data: new SlashCommandBuilder()
        .setName('kullanicilar')
        .setDescription('Kullanıcı istatistiklerini gösterir'),
    cooldown: 5,
    onlyAuthor: true,
    ephemeral: false,
    async exec(interaction: ChatInputCommandInteraction): Promise<void> {
        // İlk önce loading mesajı gönder
        await interaction.reply({
            embeds: [LoadingEmbed("Kullanıcı verilerini getiriliyor...")]
        });

        try {
            const globalCache = globalStore.collection('globalCache');
            
            // GlobalStore durumunu kontrol et
            discordLogger.debug("GlobalStore collections:", globalStore.listCollections());
            discordLogger.debug("GlobalCache collection size:", globalCache.size);
            
            // GlobalCache'deki tüm key'leri kontrol et
            const allKeys = Array.from(globalCache.keys());
            discordLogger.debug("GlobalCache keys:", allKeys);
            
            const users = globalCache.get("users");
            
            discordLogger.debug("users from cache - type:", typeof users);
            discordLogger.debug("users from cache - instanceof Map:", users instanceof Map);
            
            let usersData: any[] = [];
            let dataSource = "Unknown";
            
            // Önce cache'den dene
            if (users && users instanceof Map && users.size > 0) {
                usersData = Array.from(users.entries()).map(([id, userData]) => ({
                    id,
                    ...userData
                }));
                dataSource = `Cache (${users.size} users)`;
                discordLogger.debug(`users map {} ??? ${users.size} kullanıcı cache'de var`);
            } else {
                // Cache'de veri yoksa database'den al
                discordLogger.debug("Cache'de veri yok, database'den çekiliyor...");
                try {
                    const dbUsers = await getAllUsers();
                    usersData = dbUsers;
                    dataSource = `Database (${dbUsers.length} users)`;
                    discordLogger.debug(`Database'den ${dbUsers.length} kullanıcı çekildi`);
                } catch (dbError) {
                    discordLogger.error("Database'den kullanıcı çekme hatası:", dbError);
                    await interaction.editReply({
                        embeds: [ErrorEmbed("Database Hatası", "Kullanıcı verilerini database'den çekerken hata oluştu")]
                    });
                    return;
                }
            }
            
            if (usersData.length === 0) {
                await interaction.editReply({
                    embeds: [InfoEmbed("Kullanıcı Listesi", "Şu anda odada kimse yok")]
                });
                return;
            }

            // Sayfalama için ayarlar
            const usersPerPage = 10;
            const totalPages = Math.ceil(usersData.length / usersPerPage);
            let currentPage = 1;

            // Sayfa oluşturma fonksiyonu
            const createUserListPage = (page: number) => {
                const startIndex = (page - 1) * usersPerPage;
                const endIndex = startIndex + usersPerPage;
                const pageUsers = usersData.slice(startIndex, endIndex);

                const userList = pageUsers
                    .map((userData, index) => {
                        const globalIndex = startIndex + index + 1;
                        const id = userData.id || 'N/A';
                        const username = userData.username || 'Unknown';
                        const indexNum = userData.index || 'N/A';
                        return `${globalIndex}. **${username}** (ID: ${id}, Index: ${indexNum})`;
                    })
                    .join('\n');

                return InfoEmbed(
                    `Aktif Kullanıcılar (${usersData.length})`,
                    userList,
                    [
                        { name: "Sayfa", value: `${page}/${totalPages}`, inline: true },
                        { name: "Toplam Kullanıcı", value: usersData.length.toString(), inline: true },
                        { name: "Veri Kaynağı", value: dataSource, inline: true }
                    ]
                );
            };

            // Navigation butonları oluşturma fonksiyonu
            const createNavigationButtons = (page: number) => {
                const row = new ActionRowBuilder<ButtonBuilder>();

                // İlk sayfa butonu
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId('users_first')
                        .setLabel('⏪')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(page === 1)
                );

                // Önceki sayfa butonu
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId('users_prev')
                        .setLabel('◀️')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(page === 1)
                );

                // Sayfa bilgisi butonu (disabled)
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId('users_info')
                        .setLabel(`${page}/${totalPages}`)
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true)
                );

                // Sonraki sayfa butonu
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId('users_next')
                        .setLabel('▶️')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(page === totalPages)
                );

                // Son sayfa butonu
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId('users_last')
                        .setLabel('⏩')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(page === totalPages)
                );

                return row;
            };

            // İlk sayfayı göster
            const initialMessage: any = {
                embeds: [createUserListPage(currentPage)]
            };

            // Eğer birden fazla sayfa varsa butonları ekle
            if (totalPages > 1) {
                initialMessage.components = [createNavigationButtons(currentPage)];
            }

            await interaction.editReply(initialMessage);

            // Eğer tek sayfa varsa buton listener'ı ekleme
            if (totalPages <= 1) return;

            // Button collector oluştur
            const collector = interaction.channel?.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 300000, // 5 dakika
                filter: (i) => i.user.id === interaction.user.id && i.customId.startsWith('users_')
            });

            collector?.on('collect', async (buttonInteraction) => {
                try {
                    switch (buttonInteraction.customId) {
                        case 'users_first':
                            currentPage = 1;
                            break;
                        case 'users_prev':
                            if (currentPage > 1) currentPage--;
                            break;
                        case 'users_next':
                            if (currentPage < totalPages) currentPage++;
                            break;
                        case 'users_last':
                            currentPage = totalPages;
                            break;
                        default:
                            return;
                    }

                    await buttonInteraction.update({
                        embeds: [createUserListPage(currentPage)],
                        components: [createNavigationButtons(currentPage)]
                    });

                } catch (error) {
                    discordLogger.error('Error handling button interaction:', error);
                    await buttonInteraction.reply({
                        embeds: [ErrorEmbed("Hata", "Sayfa değiştirirken bir hata oluştu")],
                        ephemeral: true
                    });
                }
            });

            collector?.on('end', async () => {
                try {
                    // Butonları deaktif et
                    const disabledRow = new ActionRowBuilder<ButtonBuilder>();
                    
                    disabledRow.addComponents(
                        new ButtonBuilder()
                            .setCustomId('users_first_disabled')
                            .setLabel('⏪')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(true),
                        new ButtonBuilder()
                            .setCustomId('users_prev_disabled')
                            .setLabel('◀️')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(true),
                        new ButtonBuilder()
                            .setCustomId('users_info_disabled')
                            .setLabel(`${currentPage}/${totalPages}`)
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(true),
                        new ButtonBuilder()
                            .setCustomId('users_next_disabled')
                            .setLabel('▶️')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(true),
                        new ButtonBuilder()
                            .setCustomId('users_last_disabled')
                            .setLabel('⏩')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(true)
                    );

                    await interaction.editReply({
                        embeds: [createUserListPage(currentPage)],
                        components: [disabledRow]
                    });
                } catch (error) {
                    discordLogger.error('Error disabling buttons:', error);
                }
            });
            
        } catch (error) {
            discordLogger.error("Error in users command:", error);
            await interaction.editReply({
                embeds: [ErrorEmbed("Hata", "Kullanıcı verilerini alırken bir hata oluştu")]
            });
        }
    }
};

export = usersCommand;
