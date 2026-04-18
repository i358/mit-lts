import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { Command } from "../../../types/command";
import { globalStore } from "../../../utils/globalStore";

const configCommand: Command = {
    data: new SlashCommandBuilder()
        .setName('config')
        .setDescription('Global config değerlerini görüntüler ve yönetir (Admin only)')
        .addSubcommand(subcommand =>
            subcommand
                .setName('show')
                .setDescription('Tüm config değerlerini gösterir'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('get')
                .setDescription('Belirli bir config değerini gösterir')
                .addStringOption(option =>
                    option.setName('key')
                        .setDescription('Config anahtarı (örn: app.LOG_LEVEL)')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('reload')
                .setDescription('Config dosyasını yeniden yükler')),
    
    cooldown: 5,
    onlyAuthor: true,
    ephemeral: false, // Admin komutları için ephemeral opsiyonel

    async exec(interaction: ChatInputCommandInteraction): Promise<void> {
        await interaction.deferReply({ ephemeral: false }); // ephemeral: false olarak ayarlandı

        const subcommand = interaction.options.getSubcommand();

        try {
            switch (subcommand) {
                case 'show':
                    await handleShowConfig(interaction);
                    break;
                case 'get':
                    await handleGetConfig(interaction);
                    break;
                case 'reload':
                    await handleReloadConfig(interaction);
                    break;
                default:
                    await interaction.editReply({ content: "❌ Geçersiz alt komut!" });
            }
        } catch (error) {
            console.error("Config komutu yürütülürken hata:", error);
            
            const errorEmbed = new EmbedBuilder()
                .setTitle("❌ Hata")
                .setDescription("Config işlemi sırasında bir hata oluştu.")
                .setColor(0xE74C3C)
                .setTimestamp()
                .setFooter({ text: 'HabboJÖH Bot' });

            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
};

async function handleShowConfig(interaction: ChatInputCommandInteraction) {
    const configStore = globalStore.collection("config");
    const appConfig = configStore.get("app") as any;

    if (!appConfig) {
        const errorEmbed = new EmbedBuilder()
            .setTitle("❌ Config Bulunamadı")
            .setDescription("Global config store'da app konfigürasyonu bulunamadı.")
            .setColor(0xE74C3C)
            .setTimestamp()
            .setFooter({ text: 'HabboJÖH Bot' });

        await interaction.editReply({ embeds: [errorEmbed] });
        return;
    }

    // Config'i güvenli bir şekilde göster (hassas bilgileri gizle)
    const safeConfig = sanitizeConfig(appConfig);
    
    const configEmbed = new EmbedBuilder()
        .setTitle("⚙️ Global Configuration")
        .setDescription("Mevcut sistem konfigürasyonu")
        .addFields([
            {
                name: "🔧 Genel Ayarlar",
                value: `Ortam: \`${safeConfig.ENVIRONMENT || 'N/A'}\`\nLog Seviyesi: \`${safeConfig.LOG_LEVEL || 'N/A'}\`\nBaşlatılmış: \`${safeConfig.INITIALIZED ? 'Evet' : 'Hayır'}\`\nProje Adı: \`${safeConfig.PRODUCTION_NAME || 'N/A'}\``,
                inline: false
            },
            {
                name: "🤖 Discord Bot",
                value: `Aktif: \`${safeConfig.DISCORD_BOT?.ACTIVE ? 'Evet' : 'Hayır'}\`\nGuild ID: \`${safeConfig.DISCORD_BOT?.GUILD_ID || 'N/A'}\`\nClient ID: \`${safeConfig.DISCORD_BOT?.CLIENT_ID || 'N/A'}\`\nLog Seviyesi: \`${safeConfig.DISCORD_BOT?.LOG_LEVEL || 'N/A'}\``,
                inline: false
            },
            {
                name: "🔗 Proxy & API",
                value: `Proxy Aktif: \`${safeConfig.proxy?.ACTIVE ? 'Evet' : 'Hayır'}\`\nAPI Aktif: \`${safeConfig.api?.ACTIVE ? 'Evet' : 'Hayır'}\`\nAPI Port: \`${safeConfig.api?.PORT || 'N/A'}\``,
                inline: false
            },
            {
                name: "📁 Kanallar",
                value: `Logs: \`${safeConfig.DISCORD_BOT?.CHANNELS?.LOGS || 'N/A'}\`\nEvents: \`${safeConfig.DISCORD_BOT?.CHANNELS?.EVENTS || 'N/A'}\`\nCommands: \`${safeConfig.DISCORD_BOT?.CHANNELS?.COMMANDS || 'N/A'}\``,
                inline: false
            }
        ])
        .setColor(0x3498DB)
        .setTimestamp()
        .setFooter({ 
            text: `Config Store Size: ${configStore.size} | Habbo JOH Bot`,
            iconURL: interaction.client.user?.displayAvatarURL()
        });

    await interaction.editReply({ embeds: [configEmbed] });
}

async function handleGetConfig(interaction: ChatInputCommandInteraction) {
    const key = interaction.options.getString('key', true);
    const configStore = globalStore.collection("config");
    
    try {
        // Key'i parse et (örn: "app.LOG_LEVEL" -> ["app", "LOG_LEVEL"])
        const keyParts = key.split('.');
        let configValue: any = configStore.get(keyParts[0]);
        
        // Nested key'leri işle
        for (let i = 1; i < keyParts.length && configValue !== undefined; i++) {
            configValue = configValue[keyParts[i]];
        }

        if (configValue === undefined) {
            const errorEmbed = new EmbedBuilder()
                .setTitle("❌ Config Anahtarı Bulunamadı")
                .setDescription(`\`${key}\` anahtarı config'de bulunamadı.`)
                .addFields([
                    { 
                        name: "💡 Örnek Kullanım", 
                        value: "`app.LOG_LEVEL`\n`app.DISCORD_BOT.ACTIVE`\n`app.api.PORT`",
                        inline: false 
                    }
                ])
                .setColor(0xE74C3C)
                .setTimestamp()
                .setFooter({ text: 'HabboJÖH Bot' });

            await interaction.editReply({ embeds: [errorEmbed] });
            return;
        }

        // Değeri güvenli bir şekilde göster
        const safeValue = sanitizeValue(configValue, key);
        const valueType = Array.isArray(configValue) ? 'Array' : typeof configValue;
        
        const valueEmbed = new EmbedBuilder()
            .setTitle("🔍 Config Değeri")
            .setDescription(`\`${key}\` anahtarının değeri`)
            .addFields([
                { name: "📊 Tür", value: `\`${valueType}\``, inline: true },
                { name: "📝 Değer", value: `\`\`\`json\n${JSON.stringify(safeValue, null, 2)}\n\`\`\``, inline: false }
            ])
            .setColor(0x2ECC71)
            .setTimestamp()
            .setFooter({ text: 'HabboJÖH Bot' });

        await interaction.editReply({ embeds: [valueEmbed] });

    } catch (error) {
        const errorEmbed = new EmbedBuilder()
            .setTitle("❌ Parsing Hatası")
            .setDescription(`Config anahtarı işlenirken hata: \`${key}\``)
            .addFields([
                { name: "🔴 Hata", value: error instanceof Error ? error.message : 'Bilinmeyen hata', inline: false }
            ])
            .setColor(0xE74C3C)
            .setTimestamp()
            .setFooter({ text: 'HabboJÖH Bot' });

        await interaction.editReply({ embeds: [errorEmbed] });
    }
}

async function handleReloadConfig(interaction: ChatInputCommandInteraction) {
    try {
        // Config dosyasını yeniden yükle
        const { config } = await import("../../../config");
        const newConfig = config();
        
        // Global store'u güncelle
        const configStore = globalStore.collection("config");
        configStore.clear();
        configStore.set("app", newConfig.app);

        const successEmbed = new EmbedBuilder()
            .setTitle("✅ Config Yenilendi")
            .setDescription("Konfigürasyon dosyası başarıyla yeniden yüklendi.")
            .addFields([
                { name: "📊 Durum", value: "Config store güncellendi", inline: true },
                { name: "🕒 Zaman", value: new Date().toLocaleString('tr-TR'), inline: true }
            ])
            .setColor(0x2ECC71)
            .setTimestamp()
            .setFooter({ text: 'HabboJÖH Bot' });

        await interaction.editReply({ embeds: [successEmbed] });

    } catch (error) {
        const errorEmbed = new EmbedBuilder()
            .setTitle("❌ Yenileme Hatası")
            .setDescription("Config dosyası yenilenirken hata oluştu.")
            .addFields([
                { name: "🔴 Hata Detayı", value: error instanceof Error ? error.message : 'Bilinmeyen hata', inline: false }
            ])
            .setColor(0xE74C3C)
            .setTimestamp()
            .setFooter({ text: 'HabboJÖH Bot' });

        await interaction.editReply({ embeds: [errorEmbed] });
    }
}

// Hassas bilgileri temizle
function sanitizeConfig(config: any): any {
    const sensitive = ['TOKEN', 'PASSWORD', 'SECRET', 'KEY', 'PRIVATE'];
    
    const sanitize = (obj: any): any => {
        if (typeof obj !== 'object' || obj === null) return obj;
        
        const result: any = Array.isArray(obj) ? [] : {};
        
        for (const key in obj) {
            const upperKey = key.toUpperCase();
            const isSensitive = sensitive.some(s => upperKey.includes(s));
            
            if (isSensitive && typeof obj[key] === 'string') {
                result[key] = '***HIDDEN***';
            } else if (typeof obj[key] === 'object') {
                result[key] = sanitize(obj[key]);
            } else {
                result[key] = obj[key];
            }
        }
        
        return result;
    };
    
    return sanitize(config);
}

// Tek değer için güvenlik kontrolü
function sanitizeValue(value: any, key: string): any {
    const sensitive = ['TOKEN', 'PASSWORD', 'SECRET', 'KEY', 'PRIVATE'];
    const upperKey = key.toUpperCase();
    
    if (sensitive.some(s => upperKey.includes(s)) && typeof value === 'string') {
        return '***HIDDEN***';
    }
    
    if (typeof value === 'object') {
        return sanitizeConfig(value);
    }
    
    return value;
}

export = configCommand;
