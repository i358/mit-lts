import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { Command } from "../../../types/command";
import { discordLogger } from "../../../logger";
import { InfoEmbed, ErrorEmbed, LoadingEmbed } from "../../utils/embeds";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from "discord.js";
import { getUserTime, getPostgresInstance, getUser } from "../../../db_utilities";
import { getUserWorkTime } from "../../../db_utilities/work_time";
import { globalStore } from "../../../utils/globalStore";
import { getOAuthLink, getUserRow } from "../../../db_utilities/postgres";

const command = new SlashCommandBuilder()
    .setName('sure')
    .setDescription('Kullanıcının toplam odada kalma süresini gösterir')
    .addBooleanOption(option =>
        option
            .setName('listele')
            .setDescription('Süre sıralamasını gösterir')
            .setRequired(false))
    .addStringOption(option =>
        option
            .setName('kullanici')
            .setDescription('Süresini görmek istediğiniz kullanıcının adı')
            .setRequired(false))
    .addIntegerOption(option =>
        option
            .setName('limit')
            .setDescription('Liste için: Kaç kullanıcı gösterilsin (varsayılan: 10)')
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(50));

const timeCommand: Command = {
    data: command,
    cooldown: 3,
    ephemeral: false,
    async exec(interaction: ChatInputCommandInteraction): Promise<void> {
        const shouldList = interaction.options.getBoolean('listele') || false;
        
        try {
            if (shouldList) {
                const limit = interaction.options.getInteger('limit') || 10;
                await handleTimeTop(interaction);
            } else {
                let username:any = interaction.options.getString('kullanici');
                
                if (!username) {
                    try {
                        const oauthData = await getOAuthLink(interaction.user.id);
                        if (!oauthData) {
                            await interaction.reply({
                                embeds: [ErrorEmbed("OAuth Hatası", "Discord hesabınız ile Habbo hesabınız bağlantılı değil. Lütfen önce /link komutunu kullanın veya bir kullanıcı adı belirtin.")]
                            });
                            return;
                        }
                        let usr = await getUserRow({
                            in: "id",
                            value: oauthData.user_id,
                            out: "username"
                        })

                        if (!usr) {
                            await interaction.reply({
                                embeds: [ErrorEmbed("OAuth Hatası", "OAuth bağlantınız var ancak kullanıcı bilgileri bulunamadı. Lütfen bir kullanıcı adı belirtin.")]
                            });
                            return;
                        }

                        username = usr;
                    } catch (error) {
                        await interaction.reply({
                            embeds: [ErrorEmbed("OAuth Hatası", "OAuth bilgileri alınırken bir hata oluştu. Lütfen bir kullanıcı adı belirtin.")]
                        });
                        return;
                    }
                }
                
                await handleTimeView(interaction, username);
            }
        } catch (error) {
            discordLogger.error(`Error in time command:`, error);
            
            try {
                const errorMessage = { embeds: [ErrorEmbed("Hata", "Komut işlenirken bir hata oluştu.")] };
                
                if (interaction.replied) {
                    await interaction.followUp({ ...errorMessage, ephemeral: true });
                } else if (interaction.deferred) {
                    await interaction.editReply(errorMessage);
                } else {
                    await interaction.reply(errorMessage);
                }
            } catch (replyError) {
                discordLogger.error('Failed to send error message:', replyError);
            }
        }
    }
};

async function handleTimeView(interaction: ChatInputCommandInteraction, username: string): Promise<void> {

    try {
        // Loading mesajı
        await interaction.reply({
            embeds: [LoadingEmbed(`${username} kullanıcısının süre bilgileri getiriliyor...`)]
        });
    } catch (replyError) {
        // Eğer reply zaten gönderilmişse, editReply kullan
        try {
            await interaction.editReply({
                embeds: [LoadingEmbed(`${username} kullanıcısının süre bilgileri getiriliyor...`)]
            });
        } catch (editError) {
            discordLogger.error('Failed to send loading message:', editError);
            return;
        }
    }

    try {
        discordLogger.debug(`Looking up time for user: ${username}`);

        // Önce kullanıcıyı stack tablosundan bul
        const userData = await getUser({
            in: 'username',
            value: username,
            out: 'all'
        });

        let timeData;
        let userId = null;
        
        if (userData) {
            // Kullanıcı stack tablosunda var, ID'si ile time bilgisini al
            userId = userData.id;
            timeData = await getUserTime(userData.id);
        } else {
            // Kullanıcı stack tablosunda yok, time tablosundan username ile ara
            discordLogger.debug(`User not found in stack table, searching in time table: ${username}`);
            
            try {
                const pool = getPostgresInstance();
                const timeResult = await pool.query('SELECT user_id, total, username FROM time WHERE username = $1', [username]);
                
                if (timeResult.rows.length > 0) {
                    const timeRecord = timeResult.rows[0];
                    userId = timeRecord.user_id;
                    
                    // Time tablosundan bulunan veri için manuel timeData oluştur
                    timeData = {
                        storedTotal: parseInt(timeRecord.total),
                        currentSessionTime: 0, // Offline olduğu için 0
                        realTimeTotal: parseInt(timeRecord.total),
                        isActive: false, // Offline
                        lastSeen: null // Stack tablosunda olmadığı için bilinmiyor
                    };
                    
                    discordLogger.debug(`Found user in time table: ${username}`, {
                        userId: timeRecord.user_id,
                        total: timeRecord.total
                    });
                } else {
                    // Ne stack'te ne de time tablosunda bulunamadı
                    await interaction.editReply({
                        embeds: [ErrorEmbed("Kullanıcı Bulunamadı", `"${username}" adında bir kullanıcı hiçbir tabloda bulunamadı.`)]
                    });
                    return;
                }
            } catch (dbError) {
                discordLogger.error(`Error searching time table for user ${username}:`, dbError);
                await interaction.editReply({
                    embeds: [ErrorEmbed("Database Hatası", `"${username}" kullanıcısının time verilerini ararken hata oluştu.`)]
                });
                return;
            }
        }

        // Süreleri formatla
        const storedTimeSeconds = Math.floor(timeData.storedTotal / 1000);
        const currentSessionSeconds = Math.floor(timeData.currentSessionTime / 1000);
        // realTimeTotal yerine sadece storedTotal kullan, çünkü veritabanındaki değer zaten toplam süreyi içeriyor
        const totalSeconds = storedTimeSeconds;
        
        const formatTime = (seconds: number) => {
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            const secs = seconds % 60;
            return `${hours}s ${minutes}d ${secs}sn`;
        };
        
        const totalTimeFormatted = formatTime(totalSeconds);
        const currentSessionFormatted = formatTime(currentSessionSeconds);
        
        // Son görülme zamanını formatla (milisaniye cinsinden geldiği için düzelt)
        let lastSeenFormatted = 'Bilinmiyor';
        if (timeData.lastSeen) {
            try {
                // lastSeen milisaniye cinsinden geldiği için direkt kullan
                const lastSeenDate = new Date(timeData.lastSeen);
                lastSeenFormatted = lastSeenDate.toLocaleString('tr-TR');
            } catch (error) {
                discordLogger.warn('Error formatting last seen date:', error);
                lastSeenFormatted = 'Format hatası';
            }
        } else if (userData && userData.last_seen) {
            try {
                // userData.last_seen de milisaniye cinsinden
                const lastSeenMs = typeof userData.last_seen === 'number' 
                    ? userData.last_seen 
                    : parseInt(userData.last_seen.toString());
                const lastSeenDate = new Date(lastSeenMs);
                lastSeenFormatted = lastSeenDate.toLocaleString('tr-TR');
            } catch (error) {
                discordLogger.warn('Error formatting userData last seen:', error);
                lastSeenFormatted = 'Format hatası';
            }
        }

        // Durum belirleme
        const statusIcon = timeData.isActive ? '🟢' : '🔴';
        const statusText = timeData.isActive ? 'Şu anda aktif' : 'Çevrimdışı';

        // Çalışma süresini al
        const workTimeMs = await getUserWorkTime(userId);
        const workTimeFormatted = formatTime(Math.floor(workTimeMs / 1000));

        const embedFields: { name: string; value: string; inline: boolean }[] = [
            { name: `${statusIcon} Durum`, value: statusText, inline: true },
            { name: "🆔 Kullanıcı ID", value: userId?.toString() || 'Bilinmiyor', inline: true },
            { name: "📍 Son Index", value: userData?.index?.toString() || 'Bilinmiyor', inline: true },
            { name: "⏱️ Toplam Süre", value: totalTimeFormatted, inline: true },
            { name: "⚒️ Terfi Süresi", value: workTimeFormatted, inline: true },
            { name: "🔄 Mevcut Session", value: currentSessionFormatted, inline: true },
            { name: "🕐 Son Görülme", value: lastSeenFormatted, inline: false },
            { name: "💬 Motto", value: userData?.motto || '*Motto belirtilmemiş*', inline: false }
        ];

        // Özel durumlar için bilgilendirme mesajları  
        if (timeData.isActive && timeData.storedTotal === 0 && timeData.currentSessionTime > 0) {
            embedFields.unshift({
                name: "ℹ️ Bilgi",
                value: "Kullanıcı şu anda aktif ancak henüz kaydedilmiş süre verisi yok. Gerçek zamanlı session süresi hesaplanıyor.",
                inline: false
            });
        } else if (!timeData.isActive && timeData.realTimeTotal === 0) {
            embedFields.unshift({
                name: "ℹ️ Bilgi",
                value: "Bu kullanıcının henüz kaydedilmiş süre verisi bulunmuyor.",
                inline: false
            });
        } else if (!userData) {
            embedFields.unshift({
                name: "ℹ️ Bilgi",
                value: "Kullanıcı şu anda odada değil. Gösterilen veriler son kayıtlı süre bilgileridir.",
                inline: false
            });
        } else if (timeData.isActive && timeData.currentSessionTime > 0) {
            embedFields.unshift({
                name: "ℹ️ Bilgi", 
                value: "Kullanıcı şu anda aktif. Gösterilen süre gerçek zamanlı hesaplanmıştır.",
                inline: false
            });
        }

        const timeEmbed = InfoEmbed(
            `⏰ ${username} - Süre Raporu`,
            `24 saatlik dönem içindeki odada kalma süresi (gerçek zamanlı)`,
            embedFields
        );

        // Avatar varsa ekle
        const avatarUrl = `https://www.habbo.com.tr/habbo-imaging/avatarimage?user=${encodeURIComponent(username)}&direction=2&head_direction=2&action=&gesture=nrm&size=l`;
        timeEmbed.setThumbnail(avatarUrl);

        await interaction.editReply({
            embeds: [timeEmbed]
        });

        discordLogger.info(`Time info displayed for user: ${username}`, {
            userId: userId,
            storedTotal: timeData.storedTotal,
            currentSession: timeData.currentSessionTime,
            realTimeTotal: timeData.realTimeTotal,
            isActive: timeData.isActive,
            foundInStack: !!userData
        });

    } catch (error) {
        discordLogger.error(`Error looking up time for user ${username}:`, error);
        
        try {
            await interaction.editReply({
                embeds: [ErrorEmbed(
                    "Hata", 
                    `"${username}" kullanıcısının süre bilgilerini alırken bir hata oluştu.`
                )]
            });
        } catch (editError) {
            discordLogger.error('Failed to send error message to user:', editError);
        }
    }
}

async function handleTimeSet(interaction: ChatInputCommandInteraction): Promise<void> {
    const user = interaction.options.getString('kullanici', true);
    const hours = interaction.options.getInteger('saat') || 0;
    const minutes = interaction.options.getInteger('dakika') || 0;
    const seconds = interaction.options.getInteger('saniye') || 0;
    const timeType = interaction.options.getString('tip', true) as 'total' | 'work' | 'both';

    try {
        await interaction.reply({
            embeds: [LoadingEmbed(`${user} kullanıcısının ${timeType === 'total' ? 'toplam' : timeType === 'work' ? 'çalışma' : 'her iki'} süresi ayarlanıyor...`)]
        });
    } catch (replyError) {
        try {
            await interaction.editReply({
                embeds: [LoadingEmbed(`${user} kullanıcısının ${timeType === 'total' ? 'toplam' : timeType === 'work' ? 'çalışma' : 'her iki'} süresi ayarlanıyor...`)]
            });
        } catch (editError) {
            discordLogger.error('Failed to send loading message:', editError);
            return;
        }
    }
    
    try {
        // Toplam süreyi milisaniye cinsinden hesapla
        const totalMs = (hours * 3600 + minutes * 60 + seconds) * 1000;
        
        // Kullanıcıyı bul
        const { userId, username } = await findUserByIdOrUsername(user);
        
        // Timer worker'dan manuel güncelleme yap
        const { timerWorker } = await import("../../../workers/timer");
        const { setUserWorkTime } = await import("../../../db_utilities/work_time");

        // Seçilen türe göre süreleri güncelle
        let success = true;
        try {
            switch(timeType) {
                case 'total':
                    success = await timerWorker.updateUserTimeManually(userId, totalMs, username);
                    if (!success) {
                        throw new Error(`Failed to update total time for user ${username}`);
                    }
                    break;
                case 'work':
                    try {
                        await setUserWorkTime(userId, totalMs);
                    } catch (error: unknown) {
                        const workError = error instanceof Error ? error : new Error(String(error));
                        throw new Error(`Failed to set work time: ${workError.message}`);
                    }
                    break;
                case 'both':
                    success = await timerWorker.updateUserTimeManually(userId, totalMs, username);
                    if (!success) {
                        throw new Error(`Failed to update total time for user ${username}`);
                    }
                    try {
                        await setUserWorkTime(userId, totalMs);
                    } catch (error: unknown) {
                        const workError = error instanceof Error ? error : new Error(String(error));
                        throw new Error(`Total time updated but work time failed: ${workError.message}`);
                    }
                    break;
            }
            
            const timeFormatted = formatTime(Math.floor(totalMs / 1000));
            const typeText = timeType === 'total' ? 'toplam' : timeType === 'work' ? 'çalışma' : 'her iki';
            
            await interaction.editReply({
                embeds: [InfoEmbed(
                    "✅ Süre Ayarlandı",
                    `**${username}** kullanıcısının ${typeText} süresi **${timeFormatted}** olarak ayarlandı.`,
                    [
                        { name: "👤 Kullanıcı", value: username, inline: true },
                        { name: "🆔 ID", value: userId.toString(), inline: true },
                        { name: "⏰ Yeni Süre", value: timeFormatted, inline: true },
                        { name: "📊 Süre Tipi", value: typeText, inline: true }
                    ]
                )]
            });
            
            discordLogger.info(`Admin ${interaction.user.tag} set ${timeType} time for user ${username} to ${totalMs}ms`);
            
        } catch (error) {
            success = false;
            throw error;
        }
        
    } catch (error) {
        discordLogger.error(`Error setting time for user ${user}:`, error);
        try {
            await interaction.editReply({
                embeds: [ErrorEmbed("Hata", error instanceof Error ? error.message : "Bilinmeyen hata")]
            });
        } catch (editError) {
            discordLogger.error('Failed to send error message:', editError);
        }
    }
}

async function handleTimeAdd(interaction: ChatInputCommandInteraction): Promise<void> {
    const user = interaction.options.getString('kullanici', true);
    const hours = interaction.options.getInteger('saat') || 0;
    const minutes = interaction.options.getInteger('dakika') || 0;
    const seconds = interaction.options.getInteger('saniye') || 0;
    const timeType = interaction.options.getString('tip', true) as 'total' | 'work' | 'both';

    try {
        await interaction.reply({
            embeds: [LoadingEmbed(`${user} kullanıcısının ${timeType === 'total' ? 'toplam' : timeType === 'work' ? 'çalışma' : 'her iki'} süresine ekleniyor...`)]
        });
    } catch (replyError) {
        try {
            await interaction.editReply({
                embeds: [LoadingEmbed(`${user} kullanıcısının ${timeType === 'total' ? 'toplam' : timeType === 'work' ? 'çalışma' : 'her iki'} süresine ekleniyor...`)]
            });
        } catch (editError) {
            discordLogger.error('Failed to send loading message:', editError);
            return;
        }
    }
    
    try {
        // Eklenecek süreyi milisaniye cinsinden hesapla
        const addMs = (hours * 3600 + minutes * 60 + seconds) * 1000;
        
        // Kullanıcıyı bul
        const { userId, username } = await findUserByIdOrUsername(user);
        
        // Timer worker ve work time fonksiyonlarını import et
        const { timerWorker } = await import("../../../workers/timer");
        const { updateUserWorkTime } = await import("../../../db_utilities/work_time");

        // Seçilen türe göre süreleri güncelle
        let success = true;
        let newTotalMs = addMs;

        try {
            switch(timeType) {
                case 'total':
                    // Mevcut toplam süreyi al
                    const currentTimeData = await getUserTime(userId);
                    newTotalMs = currentTimeData.storedTotal + addMs;
                    success = await timerWorker.updateUserTimeManually(userId, newTotalMs, username);
                    if (!success) {
                        throw new Error(`Failed to update total time for user ${username}`);
                    }
                    break;
                case 'work':
                    try {
                        await updateUserWorkTime(userId, addMs);
                    } catch (error: unknown) {
                        const workError = error instanceof Error ? error : new Error(String(error));
                        throw new Error(`Failed to add work time: ${workError.message}`);
                    }
                    break;
                case 'both':
                    const bothTimeData = await getUserTime(userId);
                    newTotalMs = bothTimeData.storedTotal + addMs;
                    success = await timerWorker.updateUserTimeManually(userId, newTotalMs, username);
                    if (!success) {
                        throw new Error(`Failed to update total time for user ${username}`);
                    }
                    try {
                        await updateUserWorkTime(userId, addMs);
                    } catch (error: unknown) {
                        const workError = error instanceof Error ? error : new Error(String(error));
                        throw new Error(`Total time updated but work time failed: ${workError.message}`);
                    }
                    break;
            }
            
            const addedFormatted = formatTime(Math.floor(addMs / 1000));
            const newTotalFormatted = formatTime(Math.floor(newTotalMs / 1000));
            const typeText = timeType === 'total' ? 'toplam' : timeType === 'work' ? 'çalışma' : 'her iki';
            
            await interaction.editReply({
                embeds: [InfoEmbed(
                    "✅ Süre Eklendi",
                    `**${username}** kullanıcısının ${typeText} süresine **${addedFormatted}** eklendi.`,
                    [
                        { name: "👤 Kullanıcı", value: username, inline: true },
                        { name: "➕ Eklenen", value: addedFormatted, inline: true },
                        { name: "📊 Yeni Toplam", value: newTotalFormatted, inline: true },
                        { name: "📊 Süre Tipi", value: typeText, inline: true }
                    ]
                )]
            });
            
            discordLogger.info(`Admin ${interaction.user.tag} added ${addMs}ms to user ${username}'s ${timeType} time`);
        } catch (error) {
            success = false;
            throw error;
        }
        
    } catch (error) {
        discordLogger.error(`Error adding time for user ${user}:`, error);
        try {
            await interaction.editReply({
                embeds: [ErrorEmbed("Hata", error instanceof Error ? error.message : "Bilinmeyen hata")]
            });
        } catch (editError) {
            discordLogger.error('Failed to send error message:', editError);
        }
    }
}

async function handleTimeReset(interaction: ChatInputCommandInteraction): Promise<void> {
    const user = interaction.options.getString('kullanici', true);
    const timeType = interaction.options.getString('tip', true) as 'total' | 'work' | 'both';
    
    try {
        await interaction.reply({
            embeds: [LoadingEmbed(`${user} kullanıcısının ${timeType === 'total' ? 'toplam' : timeType === 'work' ? 'çalışma' : 'her iki'} süresi sıfırlanıyor...`)]
        });
    } catch (replyError) {
        try {
            await interaction.editReply({
                embeds: [LoadingEmbed(`${user} kullanıcısının ${timeType === 'total' ? 'toplam' : timeType === 'work' ? 'çalışma' : 'her iki'} süresi sıfırlanıyor...`)]
            });
        } catch (editError) {
            discordLogger.error('Failed to send loading message:', editError);
            return;
        }
    }
    
    try {
        // Kullanıcıyı bul
        const { userId, username } = await findUserByIdOrUsername(user);
        
        // Timer worker'dan manuel güncelleme yap (0 olarak ayarla)
        const { timerWorker } = await import("../../../workers/timer");
        const { resetUserWorkTime } = await import("../../../db_utilities/work_time");

        // Seçilen türe göre süreleri sıfırla
        let success = true;
        try {
            switch(timeType) {
                case 'total':
                    success = await timerWorker.updateUserTimeManually(userId, 0, username);
                    if (!success) {
                        throw new Error(`Failed to reset total time for user ${username}`);
                    }
                    break;
                case 'work':
                    try {
                        await resetUserWorkTime(userId);
                    } catch (error: unknown) {
                        const workError = error instanceof Error ? error : new Error(String(error));
                        throw new Error(`Failed to reset work time: ${workError.message}`);
                    }
                    break;
                case 'both':
                    success = await timerWorker.updateUserTimeManually(userId, 0, username);
                    if (!success) {
                        throw new Error(`Failed to reset total time for user ${username}`);
                    }
                    try {
                        await resetUserWorkTime(userId);
                    } catch (error: unknown) {
                        const workError = error instanceof Error ? error : new Error(String(error));
                        throw new Error(`Total time reset but work time failed: ${workError.message}`);
                    }
                    break;
            }
            
            const typeText = timeType === 'total' ? 'toplam' : timeType === 'work' ? 'çalışma' : 'her iki';
            
            await interaction.editReply({
                embeds: [InfoEmbed(
                    "✅ Süre Sıfırlandı",
                    `**${username}** kullanıcısının ${typeText} süresi sıfırlandı.`,
                    [
                        { name: "👤 Kullanıcı", value: username, inline: true },
                        { name: "🆔 ID", value: userId.toString(), inline: true },
                        { name: "⏰ Yeni Süre", value: "0s 0d 0sn", inline: true },
                        { name: "📊 Süre Tipi", value: typeText, inline: true }
                    ]
                )]
            });
            
            discordLogger.info(`Admin ${interaction.user.tag} reset ${timeType} time for user ${username}`);
        } catch (error) {
            success = false;
            throw error;
        }
        
    } catch (error) {
        discordLogger.error(`Error resetting time for user ${user}:`, error);
        try {
            await interaction.editReply({
                embeds: [ErrorEmbed("Hata", error instanceof Error ? error.message : "Bilinmeyen hata")]
            });
        } catch (editError) {
            discordLogger.error('Failed to send error message:', editError);
        }
    }
}

async function handleTimeTop(interaction: ChatInputCommandInteraction): Promise<void> {
    const limit = interaction.options.getInteger('limit') || 10;
    
    try {
        await interaction.reply({
            embeds: [LoadingEmbed("Tüm kullanıcıların süreleri hesaplanıyor...")]
        });
    } catch (replyError) {
        try {
            await interaction.editReply({
                embeds: [LoadingEmbed("Tüm kullanıcıların süreleri hesaplanıyor...")]
            });
        } catch (editError) {
            discordLogger.error('Failed to send loading message:', editError);
            return;
        }
    }
    
    try {
        // Hem stack tablosundaki (aktif) hem de time tablosundaki (tüm) kullanıcıları al
        const { getAllUsers, getAllUserTimes } = await import("../../../db_utilities");
        const [stackUsers, allTimeUsers] = await Promise.all([
            getAllUsers(),
            getAllUserTimes()
        ]);
        
        // Stack kullanıcılarını Map'e çevir (hızlı arama için)
        const stackUsersMap = new Map();
        stackUsers.forEach((user:any) => {
            stackUsersMap.set(user.id, user);
        });
        
        // Tüm kullanıcıların süre verilerini hesapla
        const allUserTimes = [];
        
        for (const timeUser of allTimeUsers) {
            if (!timeUser.user_id) continue;
            
            try {
                const timeData = await getUserTime(timeUser.user_id);
                const stackUser = stackUsersMap.get(timeUser.user_id);
                
                allUserTimes.push({
                    userId: timeUser.user_id,
                    username: timeUser.username || stackUser?.username || 'Bilinmeyen',
                    ...timeData,
                    lastUpdated: Date.now(),
                    isInStack: !!stackUser
                });
            } catch (error) {
                discordLogger.warn(`Error getting time for user ${timeUser.user_id}:`, error);
            }
        }
        
        if (allUserTimes.length === 0) {
            await interaction.editReply({
                embeds: [InfoEmbed("📊 Süre Sıralaması", "Henüz süre verisi bulunan kullanıcı yok.")]
            });
            return;
        }
        
        // Süreye göre sırala (gerçek zamanlı toplam süreye göre)
        const sortedUsers = allUserTimes
            .sort((a, b) => b.realTimeTotal - a.realTimeTotal)
            .filter(user => user.realTimeTotal > 0); // Süresi 0 olanları filtrele
        
        if (sortedUsers.length === 0) {
            await interaction.editReply({
                embeds: [InfoEmbed("📊 Süre Sıralaması", "Henüz süre verisi bulunan kullanıcı yok.")]
            });
            return;
        }
        
        // Sayfalama ayarları
        const usersPerPage = Math.min(limit, 10); // Maksimum 10 kullanıcı per sayfa
        const totalPages = Math.ceil(sortedUsers.length / usersPerPage);
        let currentPage = 1;
        
        // Sayfa oluşturma fonksiyonu
        const createTopUsersPage = (page: number) => {
            const startIndex = (page - 1) * usersPerPage;
            const endIndex = startIndex + usersPerPage;
            const pageUsers = sortedUsers.slice(startIndex, endIndex);
            
            const userList = pageUsers
                .map((userData, index) => {
                    const rank = startIndex + index + 1;
                    const timeFormatted = formatTime(Math.floor(userData.realTimeTotal / 1000));
                    
                    // Durum ikonunu belirle
                    let statusIcon = '🔴'; // Varsayılan: çevrimdışı
                    if (userData.isActive || userData.isInStack) {
                        statusIcon = '🟢'; // Aktif veya odada
                    }
                    
                    // Süre detayları
                    const storedTime = Math.floor(userData.storedTotal / 1000);
                    const sessionTime = Math.floor(userData.currentSessionTime / 1000);
                    
                    let details = '';
                    if (userData.isActive && sessionTime > 0) {
                        details = ` (Aktif: +${formatTime(sessionTime)})`;
                    } else if (storedTime > 0) {
                        details = ` (Kayıtlı: ${formatTime(storedTime)})`;
                    }
                    
                    // Kullanıcı durumu bilgisi
                    let statusInfo = '';
                 
                    
                    return `${rank}. ${statusIcon} **${userData.username}** - ${timeFormatted}${details}${statusInfo}`;
                })
                .join('\n');
            
            const fields = [
                { name: "📈 Toplam Kullanıcı", value: sortedUsers.length.toString(), inline: true },
                { name: "🟢 Odada", value: sortedUsers.filter(u => u.isActive || u.isInStack).length.toString(), inline: true },
                { name: "🔴 Çevrimdışı", value: sortedUsers.filter(u => !u.isActive && !u.isInStack).length.toString(), inline: true }
            ];
            
            if (totalPages > 1) {
                fields.push({ name: "📄 Sayfa", value: `${page}/${totalPages}`, inline: true });
            }
            
            return InfoEmbed(
                `📊 En Çok Süre Geçiren ${Math.min(limit, sortedUsers.length)} Kullanıcı`,
                userList,
                fields
            );
        };
        
        // Navigation butonları oluşturma fonksiyonu
        const createNavigationButtons = (page: number) => {
            const row = new ActionRowBuilder<ButtonBuilder>();

            // İlk sayfa butonu
            row.addComponents(

                new ButtonBuilder()
                    .setCustomId('time_top_first')
                    .setLabel('⏪')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(page === 1)
            );

            // Önceki sayfa butonu
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId('time_top_prev')
                    .setLabel('◀️')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(page === 1)
            );

            // Sayfa bilgisi butonu (disabled)
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId('time_top_info')
                    .setLabel(`${page}/${totalPages}`)
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true)
            );

            // Sonraki sayfa butonu
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId('time_top_next')
                    .setLabel('▶️')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(page === totalPages)
            );

            // Son sayfa butonu
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId('time_top_last')
                    .setLabel('⏩')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(page === totalPages)
            );

            return row;
        };
        
        // İlk sayfayı göster
        const initialMessage: any = {
            embeds: [createTopUsersPage(currentPage)]
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
            filter: (i) => i.user.id === interaction.user.id && i.customId.startsWith('time_top_')
        });

        collector?.on('collect', async (buttonInteraction) => {
            try {
                switch (buttonInteraction.customId) {
                    case 'time_top_first':
                        currentPage = 1;
                        break;
                    case 'time_top_prev':
                        if (currentPage > 1) currentPage--;
                        break;
                    case 'time_top_next':
                        if (currentPage < totalPages) currentPage++;
                        break;
                    case 'time_top_last':
                        currentPage = totalPages;
                        break;
                    default:
                        return;
                }

                await buttonInteraction.update({
                    embeds: [createTopUsersPage(currentPage)],
                    components: [createNavigationButtons(currentPage)]
                });
            } catch (error) {
                discordLogger.error('Error handling time top button interaction:', error);
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
                        .setCustomId('time_top_first_disabled')
                        .setLabel('⏪')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId('time_top_prev_disabled')
                        .setLabel('◀️')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId('time_top_info_disabled')
                        .setLabel(`${currentPage}/${totalPages}`)
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId('time_top_next_disabled')
                        .setLabel('▶️')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId('time_top_last_disabled')
                        .setLabel('⏩')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true)
                );

                await interaction.editReply({
                    embeds: [createTopUsersPage(currentPage)],
                    components: [disabledRow]
                });
            } catch (error) {
                discordLogger.error('Error disabling time top buttons:', error);
            }
        });
        
        discordLogger.info(`Top ${Math.min(limit, sortedUsers.length)} users displayed by ${interaction.user.tag}`, {
            totalUsers: sortedUsers.length,
            totalPages,
            onlineUsers: sortedUsers.filter(u => u.isActive || u.isInStack).length
        });
        
    } catch (error) {
        discordLogger.error("Error getting top users:", error);
        try {
            await interaction.editReply({
                embeds: [ErrorEmbed("Hata", "Kullanıcı sıralaması alınırken bir hata oluştu.")]
            });
        } catch (editError) {
            discordLogger.error('Failed to send error message:', editError);
        }
    }
}

// Yardımcı fonksiyonlar
async function findUserByIdOrUsername(userInput: string): Promise<{ userId: number; username: string }> {
    // Önce ID olarak dene
    const possibleId = parseInt(userInput);
    if (!isNaN(possibleId)) {
        const userData = await getUser({
            in: 'id',
            value: possibleId,
            out: 'all'
        });
        
        if (userData) {
            return { userId: userData.id, username: userData.username };
        }
    }
    
    // Username olarak dene
    const userData = await getUser({
        in: 'username',
        value: userInput,
        out: 'all'
    });
    
    if (userData) {
        return { userId: userData.id, username: userData.username };
    }
    
    // Time tablosundan dene
    const pool = getPostgresInstance();
    const timeResult = await pool.query('SELECT user_id, username FROM time WHERE username = $1', [userInput]);
    
    if (timeResult.rows.length > 0) {
        const timeRecord = timeResult.rows[0];
        return { userId: timeRecord.user_id, username: timeRecord.username };
    }
    
    throw new Error(`Kullanıcı bulunamadı: ${userInput}`);
}

function formatTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours}s ${minutes}d ${secs}sn`;
}

export = timeCommand;