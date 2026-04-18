import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { Command } from "../../../types/command";
import { discordLogger } from "../../../logger";
import { InfoEmbed, ErrorEmbed, LoadingEmbed } from "../../utils/embeds";
import { getUser } from "../../../db_utilities";
import moment from "moment";

// Habbo API types
interface HabboBadge {
    badgeIndex: number;
    code: string;
    name: string;
    description: string;
}

interface HabboApiResponse {
    uniqueId: string;
    name: string;
    figureString: string;
    motto: string;
    online: boolean;
    lastAccessTime: string;
    memberSince: string;
    profileVisible: boolean;
    currentLevel: number;
    currentLevelCompletePercent: number;
    totalExperience: number;
    starGemCount: number;
    selectedBadges: HabboBadge[];
}

const userCommand: Command = {
    data: new SlashCommandBuilder()
        .setName('kullanici')
        .setDescription('Kullanıcı bilgilerini gösterir')
        .addSubcommand(subcommand =>
            subcommand
                .setName('goruntule')
                .setDescription('Belirtilen kullanıcının detaylarını gösterir')
                .addStringOption(option =>
                    option
                        .setName('kullanici_adi')
                        .setDescription('Görüntülenecek kullanıcının adı')
                        .setRequired(true)
                )
        ),
    cooldown: 3,
    ephemeral: false,
    async exec(interaction: ChatInputCommandInteraction): Promise<void> {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'goruntule') {
            await handleUserView(interaction);
        }
    }
};

async function handleUserView(interaction: ChatInputCommandInteraction): Promise<void> {
    const username = interaction.options.getString('kullanici_adi', true);

    // Loading mesajı
    await interaction.reply({
        embeds: [LoadingEmbed(`${username} kullanıcısının bilgileri getiriliyor...`)]
    });

    try {
        discordLogger.debug(`Looking up user: ${username}`);

        // Önce Habbo API'den kullanıcı bilgilerini al
        let habboApiData: HabboApiResponse | null = null;
        try {
            const apiResponse = await fetch(`https://www.habbo.com.tr/api/public/users?name=${encodeURIComponent(username)}`);
            if (apiResponse.ok) {
                habboApiData = await apiResponse.json() as HabboApiResponse;
                discordLogger.debug(`Habbo API data for ${username}:`, habboApiData);
            }
        } catch (apiError) {
            discordLogger.warn(`Habbo API request failed for ${username}:`, apiError);
        }

        // Database'den kullanıcıyı bul
        const userData = await getUser({
            in: 'username',
            value: username,
            out: 'all'
        });

        // Habbo API'den veri varsa onu öncelik ver, yoksa database'i kullan
        if (!userData && !habboApiData) {
            await interaction.editReply({
                embeds: [ErrorEmbed("Kullanıcı Bulunamadı", `"${username}" adında bir kullanıcı ne database'de ne de Habbo'da bulunamadı.`)]
            });
            return;
        }

        // Veri kaynaklarını birleştir (Habbo API öncelikli)
        const combinedData = {
            id: userData?.id || null,
            username: habboApiData?.name || userData?.username || username,
            motto: habboApiData?.motto || userData?.motto || null,
            look: habboApiData?.figureString || userData?.look || null,
            index: userData?.index || null,
            last_seen: userData?.last_seen || null,
            // Habbo API'den ek bilgiler
            uniqueId: habboApiData?.uniqueId || null,
            online: habboApiData?.online || null,
            lastAccessTime: habboApiData?.lastAccessTime || null,
            memberSince: habboApiData?.memberSince || null,
            currentLevel: habboApiData?.currentLevel || null,
            totalExperience: habboApiData?.totalExperience || null,
            starGemCount: habboApiData?.starGemCount || null,
            selectedBadges: habboApiData?.selectedBadges || []
        };

        discordLogger.debug(`Combined user data for ${username}:`, combinedData);

        // Habbo avatar URL'i oluştur - Username-based API kullanarak
        let avatarUrl = null;
        
        if (combinedData.username) {
            // Habbo.com.tr'nin avatarimage API'si - username ile direkt çalışır
            avatarUrl = `https://www.habbo.com.tr/habbo-imaging/avatarimage?user=${encodeURIComponent(combinedData.username)}&direction=2&head_direction=2&action=&gesture=nrm&size=l`;
            
            discordLogger.debug(`Generated avatar URL for ${combinedData.username}:`, {
                username: combinedData.username,
                encodedUsername: encodeURIComponent(combinedData.username),
                avatarUrl,
                urlLength: avatarUrl.length
            });
        } else {
            discordLogger.warn(`No username available for avatar generation`, {
                combinedData: Object.keys(combinedData)
            });
        }

        // Last seen formatını düzenle (Database'den veya API'den)
        let lastSeenFormatted = 'Bilinmiyor';
        let isOnline = false;

        if (combinedData.online !== null) {
            // Habbo API'den online durumu
            isOnline = combinedData.online;
            if (combinedData.lastAccessTime) {
                lastSeenFormatted = moment(combinedData.lastAccessTime).format('DD.MM.YYYY HH:mm:ss');
            }
        } else if (combinedData.last_seen) {
            // Database'den son görülme
            lastSeenFormatted = moment(combinedData.last_seen, 'x').format('DD.MM.YYYY HH:mm:ss');
            isOnline = moment().diff(moment(combinedData.last_seen, 'x'), 'minutes') < 5;
        }

        const onlineStatus = isOnline ? '🟢 Online' : '🔴 Offline';

        // Embed fields oluştur
        const embedFields = [
            { name: "� Durum", value: onlineStatus, inline: true },
            { name: "🕐 Son Görülme", value: lastSeenFormatted, inline: true }
        ];

        // Database bilgileri varsa ekle
        if (combinedData.id) {
            embedFields.push({ name: "🆔 Database ID", value: combinedData.id.toString(), inline: true });
        }
        if (combinedData.index) {
            embedFields.push({ name: "📍 Index", value: combinedData.index.toString(), inline: true });
        }

        // Habbo API bilgileri varsa ekle
        if (combinedData.currentLevel) {
            embedFields.push({ name: "⭐ Level", value: `${combinedData.currentLevel} (XP: ${combinedData.totalExperience || 0})`, inline: true });
        }
        if (combinedData.starGemCount) {
            embedFields.push({ name: "� Star Gems", value: combinedData.starGemCount.toString(), inline: true });
        }
        if (combinedData.memberSince) {
            const memberSince = moment(combinedData.memberSince).format('DD.MM.YYYY');
            embedFields.push({ name: "📅 Üye Olma", value: memberSince, inline: true });
        }

        // Rozetler varsa ekle
        if (combinedData.selectedBadges && combinedData.selectedBadges.length > 0) {
            const badgeList = combinedData.selectedBadges
                .map((badge: HabboBadge) => `${badge.name} (${badge.code})`)
                .join('\n');
            embedFields.push({ name: "🏆 Rozetler", value: badgeList, inline: false });
        }

        // Data source bilgisi
        const dataSource = habboApiData ? '🌐 Habbo API' : '� Database';
        embedFields.push({ name: "📊 Veri Kaynağı", value: dataSource, inline: true });

        // Embed oluştur
        const userEmbed = InfoEmbed(
            `👤 ${combinedData.username}`,
            combinedData.motto || '*Motto belirtilmemiş*',
            embedFields
        );

        // Avatar varsa image olarak ekle
        if (avatarUrl) {
            userEmbed.setImage(avatarUrl);
            userEmbed.setThumbnail(avatarUrl);
            discordLogger.debug(`Avatar set on embed:`, {
                avatarUrl,
                imageSet: !!userEmbed.data.image,
                thumbnailSet: !!userEmbed.data.thumbnail
            });
        } else {
            discordLogger.warn(`No avatar URL generated for user: ${combinedData.username}`);
        }

        // Footer'a ek bilgi ekle
        userEmbed.setFooter({
            text: `${userEmbed.data.footer?.text || 'Habbo JÖH Bot'} • ${isOnline ? 'Şu anda aktif' : 'Çevrimdışı'}`,
            iconURL: userEmbed.data.footer?.icon_url
        });

        await interaction.editReply({
            embeds: [userEmbed]
        });

        // Final embed durumunu logla
        discordLogger.debug(`Final embed state:`, {
            hasImage: !!userEmbed.data.image,
            imageUrl: userEmbed.data.image?.url,
            hasThumbnail: !!userEmbed.data.thumbnail,
            thumbnailUrl: userEmbed.data.thumbnail?.url
        });

        discordLogger.info(`User profile displayed: ${combinedData.username}`, {
            userId: combinedData.id,
            isOnline,
            hasAvatar: !!avatarUrl,
            dataSource: habboApiData ? 'API' : 'Database'
        });

    } catch (error) {
        discordLogger.error(`Error looking up user ${username}:`, error);
        
        await interaction.editReply({
            embeds: [ErrorEmbed(
                "Hata", 
                `"${username}" kullanıcısının bilgilerini alırken bir hata oluştu.`
            )]
        });
    }
}

export = userCommand;