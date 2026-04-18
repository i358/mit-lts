import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } from 'discord.js';
import { Command } from '../../../types/command';
import { createArchiveRow, getCodename, getDailyUserTime, getOAuthLink, getUserBadgeInfo, getUserRow, updateUserBadge, updateUserRow } from '../../../db_utilities/postgres';
import * as fs from 'fs';
import * as path from 'path';
import { globalStore } from '../../../utils/globalStore';
import { createLogger, LogLevel } from '../../../logger';

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

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('terfi')
        .setDescription('Terfi yönetimi komutları')
        .addSubcommand(subcommand =>
            subcommand
                .setName('goruntule')
                .setDescription('Kullanıcının mevcut terfi ve rütbe bilgilerini görüntüle')
                .addStringOption(option =>
                    option
                        .setName('kullanici')
                        .setDescription('Habbo kullanıcı adı')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('ver')
                .setDescription('Kullanıcıya terfi ver')
                .addStringOption(option =>
                    option
                        .setName('kullanici')
                        .setDescription('Terfi verilecek kullanıcının adı')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName('mod')
                        .setDescription('İşlem modu')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Kontrol Et', value: 'check' },
                            { name: 'Terfi Ver', value: 'promote' }
                        )
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('ayarla')
                .setDescription('Kullanıcıya yeni badge ve rank ata')
                .addStringOption(option =>
                    option
                        .setName('kullanici')
                        .setDescription('Habbo kullanıcı adı')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName('rozet')
                        .setDescription('Badge ismi (örn: İçişleri)')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
                .addStringOption(option =>
                    option
                        .setName('rutbe')
                        .setDescription('Rank seviyesi (örn: II)')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
        ),
    ephemeral: false,
    onlyAuthor: false,

    async exec(interaction: ChatInputCommandInteraction) {
        const configStore = globalStore.collection<string, any>("config");
        const config = configStore.get("app");
        
        
        if (!config) {
            logger.error('Could not load config from globalStore');
            throw new Error('Configuration not found');
        }

        const subcommand = interaction.options.getSubcommand();

        try {
            switch (subcommand) {
                case 'goruntule': {
                    const username = interaction.options.getString('kullanici', true);

                    // Defer reply to show "bot is thinking"
                    await interaction.deferReply({ ephemeral: false });

                    try {
                        const { getUserRow } = await import('../../../db_utilities/postgres');
                        const userRow = await getUserRow({
                            in: 'username',
                            value: username,
                            out: 'all'
                        });

                        if (!userRow) {
                            await interaction.editReply({
                                content: `${username} adlı kullanıcı veritabanında bulunamadı.`
                            });
                            return;
                        }

                        const badgeInfo = await getUserBadgeInfo(userRow.id);
                        
                        if (!badgeInfo) {
                            await interaction.editReply({
                                content: `${username} kullanıcısının badge bilgileri alınırken bir hata oluştu.`
                            });
                            return;
                        }

                        // Work time bilgisini al
                        const { getUserWorkTime } = await import('../../../db_utilities/work_time');
                        const workTime = await getUserWorkTime(userRow.habbo_id);
                        const workTimeMinutes = Math.floor(workTime / (1000 * 60));

                        const embed = new EmbedBuilder()
                            .setColor('#0099ff')
                            .setTitle('Badge Bilgileri')
                            .setDescription(`${username} kullanıcısının badge bilgileri:`)
                            .addFields(
                                { name: 'Badge', value: badgeInfo.badgeName || 'Yok', inline: true },
                                { name: 'Rank', value: badgeInfo.rankName || 'Yok', inline: true },
                                { name: 'Badge Index', value: badgeInfo.badge.toString(), inline: true },
                                { name: 'Rank Index', value: badgeInfo.rank.toString(), inline: true },
                                { name: 'Terfi Süresi', value: `${workTimeMinutes} dakika`, inline: true }
                            )
                            .setTimestamp();

                        if (userRow.avatar) {
                            embed.setThumbnail(userRow.avatar);
                        }

                        await interaction.editReply({ embeds: [embed] });
                    } catch (error) {
                        logger.error('Error in badge view command:', error);
                        await interaction.editReply({
                            content: 'Badge bilgileri alınırken bir hata oluştu. Lütfen tekrar deneyin.'
                        });
                    }
                    break;
                }

                case 'ayarla': {
                    const adminIds = config.DISCORD_BOT?.ADMINS || [];
            if (!adminIds.includes(interaction.user.id)){
                await interaction.reply({ content: 'Bu komutu kullanmak için yetkiniz yok.', ephemeral: true });
                return;
            }
                    const username = interaction.options.getString('kullanici', true);
                    const badge = interaction.options.getString('rozet', true);
                    const rank = interaction.options.getString('rutbe', true);

                    // Defer reply to show "bot is thinking"
                    await interaction.deferReply({ ephemeral: false });

                    try {
                        const { getUserRow } = await import('../../../db_utilities/postgres');
                        const userRow = await getUserRow({
                            in: 'username',
                            value: username,
                            out: 'all'
                        });

                        if (!userRow) {
                            await interaction.editReply({
                                content: `${username} adlı kullanıcı veritabanında bulunamadı.`
                            });
                            return;
                        }

                        // Load badge data and validate badge name
                        const badgeData: { [key: string]: BadgeData } = JSON.parse(
                            fs.readFileSync(path.join(__dirname, '../../../../cache/badges.json'), 'utf-8')
                        );
                        
                        const badgeEntry = Object.entries(badgeData).find(([name]) => 
                            name.toLowerCase() === badge.toLowerCase()
                        );

                        if (!badgeEntry) {
                            await interaction.editReply({
                                content: `${badge} adlı badge bulunamadı.`
                            });
                            return;
                        }

                        // Validate rank
                        const validRanks = badgeEntry[1].ranks;
                        
                        // Eğer rank "0" ise ve validRanks boşsa veya rank validRanks içindeyse devam et
                        if (rank !== "0" && !validRanks.includes(rank)) {
                            await interaction.editReply({
                                content: `${rank} rankı, ${badge} badge'i için geçerli değil.\nGeçerli ranklar: ${validRanks.length > 0 ? validRanks.join(', ') : 'Yok'}`
                            });
                            return;
                        }

                        // Update user badge and bitflags
                        // Object.keys(badgeData) grup ID'lerini döndürür, bize index lazım
                        const badgeIndex = Object.keys(badgeData).indexOf(badge) + 1; // 1-based index
                        const rankIndex = rank === "0" ? 0 : validRanks.indexOf(rank) + 1; // Rank 0 ise 0, değilse 1'den başlar

                        // Bitflags yönetimi
                        const { DEFAULT_BITFLAGS, bitflagsManager } = await import('../../../utils/bitflagsManager');

                        // Badge index varsa her zaman bitflags hesapla (rank'tan bağımsız)
                        const newBitflags = badgeIndex > 0 
                            ? bitflagsManager.calculateBitflags(badgeIndex, DEFAULT_BITFLAGS)
                            : DEFAULT_BITFLAGS;

                        logger.info(`Calculated bitflags for badge ${badgeIndex}:`, {
                            badgeIndex,
                            newBitflags,
                            binary: newBitflags.toString(2).padStart(32, '0'),
                            badge,
                            rank
                        });

                        // Work time'ı sıfırla
                        const { resetUserWorkTime } = await import('../../../db_utilities/work_time');
                        await resetUserWorkTime(userRow.habbo_id);

                        // Work time işlemleri için fonksiyonları import et
                        const { getUserWorkTime, setUserWorkTime, resetUserWorkTime: resetWorkTime } = await import('../../../db_utilities/work_time');
                        
                        // Work time'ı sıfırla
                        await resetWorkTime(userRow.habbo_id);

                        // Eğer CB rozeti (badge 5) ise ve önceki süreden daha az bir rank'a düşürülüyorsa, önceki süreyi koru
                        if (badgeIndex === 5 && rankIndex < userRow.rank) {
                            const currentWorkTime = await getUserWorkTime(userRow.habbo_id);
                            await setUserWorkTime(userRow.habbo_id, currentWorkTime);
                        }

                        // Kullanıcının badge ve bitflags bilgilerini güncelle
                        const updateSuccess = await updateUserBadge(userRow.id, badgeIndex, rankIndex, newBitflags);
                        
                        if (!updateSuccess) {
                            logger.error('Badge update failed in database:', {
                                userId: userRow.id,
                                badgeIndex,
                                rankIndex,
                                newBitflags
                            });
                            await interaction.editReply({
                                content: 'Badge ayarlanırken bir hata oluştu. Veritabanı güncellenemedi.'
                            });
                            return;
                        }

                        // Format bitflags bilgisi
                        const bitflagsInfo = `\`\`\`
Badge Index: ${badgeIndex}
Decimal: ${newBitflags}
Binary: ${newBitflags.toString(2).padStart(32, '0')}
\`\`\``;

                        const permissions = bitflagsManager.getAllPermissions()
                            .filter((perm: string) => bitflagsManager.hasPermission(newBitflags, perm))
                            .join('\n');

                        const permissionsInfo = permissions ? `\`\`\`\n${permissions}\`\`\`` : '*Yetki yok*';

                        const embed = new EmbedBuilder()
                            .setColor('#00ff00')
                            .setTitle('Badge Ayarlandı')
                            .setDescription(`${username} kullanıcısına yeni badge atandı.`)
                            .addFields([
                                { name: 'Badge', value: badge, inline: true },
                                { name: 'Rank', value: rank, inline: true },
                                { name: 'Badge Index', value: badgeIndex.toString(), inline: true },
                                { name: 'Bitflags Değeri', value: bitflagsInfo, inline: false },
                                { name: 'Aktif Yetkiler', value: permissionsInfo, inline: false }
                            ]);

                        const logEmbed = new EmbedBuilder()
                            .setColor('#00ff00')
                            .setTitle('Badge Değişikliği')
                            .setDescription(`${interaction.user.tag} tarafından ${username} kullanıcısına yeni badge atandı:\nBadge: ${badge}\nRank: ${rank}`)
                            .setTimestamp();

                        // Log to badge log channel
                        const badgeLogChannel = interaction.client.channels.cache.get(config.DISCORD_BOT.CHANNELS.BADGE_LOG);
                        if (badgeLogChannel && 'send' in badgeLogChannel) {
                            await badgeLogChannel.send({ embeds: [logEmbed] });
                        }

                        await interaction.editReply({ embeds: [embed] });
                    } catch (error) {
                        logger.error('Error in badge set command:', error);
                        await interaction.editReply({
                            content: 'Badge ayarlanırken bir hata oluştu. Lütfen tekrar deneyin.'
                        });
                    }
                    break;
                }

                case 'ver': {

                    await interaction.deferReply();

                    const targetUsername = interaction.options.getString('kullanici', true);
                    const mode = interaction.options.getString('mod', true);

                    // Önce kullanıcı yetkisini kontrol edelim
                    let siteUser = await getOAuthLink(interaction.user.id);
                    if (!siteUser) {
                        await interaction.editReply({
                            content: 'Öncelikle /link komutunu kullanarak hesabınızı bağlamanız gerekiyor.'
                        });
                        return;
                    }

                    let user = await getUserRow({
                        in: "id",
                        value: siteUser.user_id,
                        out: "all"
                    });

                    if (!user) {
                        await interaction.editReply({
                            content: 'Hesabınız veritabanında bulunamadı. Lütfen siteye giriş yapın ve tekrar deneyin.'
                        });
                        return;
                    }

                    // Terfi verecek kişinin yetkisini kontrol et
                    const { bitflagsManager } = await import('../../../utils/bitflagsManager');
                    if (!bitflagsManager.hasPermission(user.bitflags, "GIVE_BADGES")) {
                        await interaction.editReply({
                            content: 'Bu işlemi gerçekleştirmek için yeterli yetkiniz yok.'
                        });
                        return;
                    }

                    // Hedef kullanıcıyı bul
                    const targetUser = await getUserRow({
                        in: "username",
                        value: targetUsername,
                        out: "all"
                    });

                    if (!targetUser) {
                        await interaction.editReply({
                            content: 'Hedef kullanıcı veritabanında bulunamadı.'
                        });
                        return;
                    }

                    // Terfi veren kişinin rozet seviyesi kontrolü
                    if (user.badge <= targetUser.badge) {
                        await interaction.editReply({
                            content: 'Sadece kendinizden düşük rütbedeki kullanıcılara terfi verebilirsiniz.'
                        });
                        return;
                    }

                    if (targetUser.rank === 0) {
                        await interaction.editReply({
                            content: 'Eş sahip üzeri olan veya kayıtsız olan kullanıcılara terfi veremezsiniz.'
                        });
                        return;
                    }

                    // Work time tablosundan süre kontrolü
                    const { getUserWorkTime, resetUserWorkTime } = await import('../../../db_utilities/work_time');
                    const workTime = await getUserWorkTime(targetUser.habbo_id);
                    const realTime = workTime / (1000 * 60); // ms to minutes

                    // Badge bilgilerini yükle
                    const badgesData = JSON.parse(
                        fs.readFileSync(path.join(__dirname, '../../../../cache/badges.json'), 'utf-8')
                    );

                    // Mevcut rozet kontrolü
                    const currentBadgeKey = Object.keys(badgesData)[targetUser.badge - 1];
                    const currentBadgeData = badgesData[currentBadgeKey];
                    const isLastRank = targetUser.rank >= currentBadgeData.ranks.length;

                    // Sonraki rozeti belirle
                    let nextBadgeLevel = targetUser.badge;
                    let nextRank = targetUser.rank;
                    let promotionType = 'badge_up';

                    if (isLastRank) {
                        nextBadgeLevel = targetUser.badge + 1;
                        nextRank = 1;
                    } else {
                        nextRank = targetUser.rank + 1;
                    }

                    const requiredTime = badgesData[currentBadgeKey].duration;

                    // Süre kontrolü
                    if (realTime >= requiredTime) {
                        if (mode === 'promote') {
                            // Terfi veren kişinin kodunu kontrol et
                            const promoterCode = await getCodename({
                                in: "id",
                                value: user.id,
                                out: "all"
                            });

                            if (!promoterCode) {
                                await interaction.editReply({
                                    content: 'Terfi verebilmek için önce bir kod ayarlamanız gerekiyor. /kod ayarla komutunu kullanın.'
                                });
                                return;
                            }

                            // Badge ve rank isimlerini al
                            const currentBadgeKey = Object.keys(badgesData)[targetUser.badge - 1];
                            const nextBadgeKey = Object.keys(badgesData)[nextBadgeLevel - 1];
                            const currentRankName = badgesData[currentBadgeKey]?.ranks[targetUser.rank - 1] || 'Bilinmeyen Rank';
                            const nextRankName = badgesData[nextBadgeKey]?.ranks[nextRank - 1] || 'Bilinmeyen Rank';

                            // Onay için Embed oluştur
                            const confirmEmbed = new EmbedBuilder()
                                .setColor(0x3498db)
                                .setTitle('Terfi Onayı')
                                .setDescription(`${targetUsername} kullanıcısına terfi vermek istediğinizden emin misiniz?`)
                                .addFields([
                                    { name: 'Kullanıcı', value: targetUsername, inline: true },
                                    { name: 'Yükselten', value: `${user.username} (${promoterCode.codename})`, inline: true },
                                    { name: 'Mevcut Rozet/Rank', value: `${currentBadgeKey}\n${currentRankName}`, inline: true },
                                    { name: 'Yeni Rozet/Rank', value: `${nextBadgeKey}\n${nextRankName}`, inline: true },
                                    { name: 'Toplam Süre', value: `${Math.floor(realTime)} dakika`, inline: true }
                                ]);

                            // Onay butonları oluştur
                            const confirmButton = new ButtonBuilder()
                                .setCustomId('terfi_onay')
                                .setLabel('Terfi Ver')
                                .setStyle(ButtonStyle.Success);

                            const cancelButton = new ButtonBuilder()
                                .setCustomId('terfi_iptal')
                                .setLabel('İptal')
                                .setStyle(ButtonStyle.Danger);

                            const row = new ActionRowBuilder<ButtonBuilder>()
                                .addComponents(confirmButton, cancelButton);

                            const message = await interaction.editReply({
                                embeds: [confirmEmbed],
                                components: [row]
                            });

                            try {
                                // Buton yanıtını bekle
                                const confirmation = await message.awaitMessageComponent({
                                    filter: i => {
                                        i.deferUpdate(); // Buton yanıt bekliyor görüntüsünü kaldır
                                        return i.user.id === interaction.user.id;
                                    },
                                    time: 30000 // 30 saniye bekle
                                });

                                if (confirmation.customId === 'terfi_onay') {
                                    // Terfi verildikten sonra work_time'ı sıfırla
                                    await resetUserWorkTime(targetUser.habbo_id);

                                    const now = new Date();
                                    const payload = {
                                        id: targetUser.habbo_id,
                                        type: promotionType,
                                        username: targetUser.username,
                                        promoter: user.id,
                                        old_badge: targetUser.badge,
                                        old_rank: targetUser.rank,
                                        new_badge: nextBadgeLevel,
                                        new_rank: nextRank,
                                        action_timestamp: Math.floor(realTime),  // Ensure it's a whole number
                                        action_date: now,
                                        action_time: now.toTimeString().split(' ')[0],
                                        codename: promoterCode.codename
                                    };

                                    // Archive kaydı oluştur
                                    await createArchiveRow(payload);

                                    // Kullanıcı bilgilerini güncelle
                                    const updateResult = await updateUserRow(targetUser.id, {
                                        badge: nextBadgeLevel,
                                        rank: nextRank
                                    });

                                    if (!updateResult) {
                                        await interaction.editReply({
                                            content: 'Terfi kaydı oluşturuldu fakat kullanıcı bilgileri güncellenemedi.',
                                            components: [] // Butonları kaldır
                                        });
                                        return;
                                    }

                                    // Discord log embed'i
                                    const embed = new EmbedBuilder()
                                        .setColor(promotionType === 'badge_up' ? 0xFFD700 : 0x00FF00)
                                        .setTitle(promotionType === 'badge_up' ? '🎖️ Rozet Yükseltme' : '⭐ Rank Yükseltme')
                                        .setDescription(`${promotionType === 'badge_up' ? '🎖️ **BADGE UP!**' : '⭐ **RANK UP!**'} ${targetUsername} ${promotionType === 'badge_up' ? 'rozeti' : 'rankı'} yükseldi!\n`)
                                        .addFields([
                                            { name: 'Kullanıcı', value: targetUsername, inline: true },
                                            { name: 'Yükselten', value: `${user.username} (${promoterCode.codename})`, inline: true },
                                            { name: 'Eski Rozet/Rank', value: `${currentBadgeKey}\n${currentRankName}`, inline: true },
                                            { name: 'Yeni Rozet/Rank', value: `${nextBadgeKey}\n${nextRankName}`, inline: true },
                                            { name: 'Süre', value: `${Math.floor(realTime)} dakika`, inline: true }
                                        ])
                                        .setTimestamp();

                                    await interaction.editReply({
                                        embeds: [embed],
                                        components: [] // Butonları kaldır
                                    });

                                    // Badge log kanalına da gönder
                                    const badgeLogChannel = interaction.client.channels.cache.get(config.DISCORD_BOT.CHANNELS.BADGE_LOG);
                                    if (badgeLogChannel && 'send' in badgeLogChannel) {
                                        await badgeLogChannel.send({ embeds: [embed] });
                                    }
                                } else {
                                    // İptal edildi
                                    await interaction.editReply({
                                        content: 'Terfi işlemi iptal edildi.',
                                        embeds: [],
                                        components: [] // Butonları kaldır
                                    });
                                }
                            } catch (error: any) {
                                if (error?.name === 'Time') {
                                    // Zaman aşımı
                                    await interaction.editReply({
                                        content: 'Terfi onayı zaman aşımına uğradı. Lütfen tekrar deneyin.',
                                        embeds: [],
                                        components: [] // Butonları kaldır
                                    });
                                } else {
                                    logger.error('Error during promotion:', error);
                                    await interaction.editReply({
                                        content: 'Terfi işlemi sırasında bir hata oluştu.',
                                        embeds: [],
                                        components: [] // Butonları kaldır
                                    });
                                }
                            }
                        } else {
                            // Kontrol modu - sadece bilgi ver
                            const currentBadgeName = Object.keys(badgesData)[targetUser.badge - 1];
                            const nextBadgeKey = Object.keys(badgesData)[nextBadgeLevel - 1];
                            const nextBadgeName = nextBadgeKey;
                            const currentRankName = badgesData[currentBadgeKey]?.ranks[targetUser.rank - 1] || 'Bilinmeyen Rank';
                            const nextRankName = badgesData[nextBadgeKey]?.ranks[nextRank - 1] || 'Bilinmeyen Rank';

                            const embed = new EmbedBuilder()
                                .setColor(0x3498db)
                                .setTitle('Terfi Kontrolü')
                                .setDescription(`${targetUsername} kullanıcısı terfi için uygun!`)
                                .addFields([
                                    { name: 'Mevcut Rozet', value: currentBadgeName, inline: true },
                                    { name: 'Mevcut Rank', value: currentRankName, inline: true },
                                    { name: 'Sonraki Rozet', value: nextBadgeName, inline: true },
                                    { name: 'Sonraki Rank', value: nextRankName, inline: true },
                                    { name: 'Mevcut Süre', value: `${Math.floor(realTime)} dakika`, inline: true },
                                    { name: 'Gereken Süre', value: `${requiredTime} dakika`, inline: true }
                                ])
                                .setTimestamp();

                            await interaction.editReply({ embeds: [embed] });
                        }
                    } else {
                        // Süre yeterli değil
                        const embed = new EmbedBuilder()
                            .setColor(0xe74c3c)
                            .setTitle('Terfi Kontrolü')
                            .setDescription(`${targetUsername} kullanıcısı henüz terfi için uygun değil.`)
                            .addFields([
                                { name: 'Mevcut Rozet', value: Object.keys(badgesData)[targetUser.badge - 1], inline: true },
                                { name: 'Mevcut Rank', value: badgesData[currentBadgeKey]?.ranks[targetUser.rank - 1] || 'Bilinmeyen Rank', inline: true },
                                { name: 'Mevcut Süre', value: `${Math.floor(realTime)} dakika`, inline: true },
                                { name: 'Gereken Süre', value: `${requiredTime} dakika`, inline: true },
                                { name: 'Kalan Süre', value: `${Math.floor(requiredTime - realTime)} dakika`, inline: true }
                            ])
                            .setTimestamp();

                        await interaction.editReply({ embeds: [embed] });
                    }
                }
            }
        } catch (error) {
            logger.error('Badge command error:', error);
            await interaction.reply({
                content: 'Bir hata oluştu. Lütfen tekrar deneyin.',
                ephemeral: false
            });
        }
    }
};

export default command;