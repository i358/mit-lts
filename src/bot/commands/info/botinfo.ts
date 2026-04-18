import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, version as discordVersion } from "discord.js";
import { Command } from "../../../types/command";
import { globalStore } from "../../../utils/globalStore";

const botInfoCommand: Command = {
    data: new SlashCommandBuilder()
        .setName('botinfo')
        .setDescription('Bot hakkında detaylı bilgi gösterir'),
    ephemeral: false, // Bot info herkese görünür olacak
    onlyAuthor:true,
    async exec(interaction: ChatInputCommandInteraction): Promise<void> {
        await interaction.deferReply();

        try {
            const commandsStore = globalStore.collection("commands");
            const configStore = globalStore.collection("config");
            const config = configStore.get("app") as any;
            
            // Uptime hesaplama
            const uptime = process.uptime();
            const days = Math.floor(uptime / 86400);
            const hours = Math.floor((uptime % 86400) / 3600);
            const minutes = Math.floor((uptime % 3600) / 60);
            const seconds = Math.floor(uptime % 60);
            const uptimeStr = `${days}g ${hours}s ${minutes}d ${seconds}s`;

            // Bellek kullanımı
            const memoryUsage = process.memoryUsage();
            const memoryMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
            const totalMemoryMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);

            // Bot durumu
            const totalGuilds = interaction.client.guilds.cache.size;
            const totalUsers = interaction.client.users.cache.size;
            const totalChannels = interaction.client.channels.cache.size;
            
            const botInfoEmbed = new EmbedBuilder()
                .setTitle("🤖 Bot Bilgileri")
                .setDescription("Habbo JÖH Discord Bot'u hakkında detaylı sistem bilgileri")
                .setThumbnail(interaction.client.user?.displayAvatarURL() || null)
                .addFields([
                    {
                        name: "📊 Bot İstatistikleri",
                        value: `Sunucular: ${totalGuilds}\nKullanıcılar: ${totalUsers}\nKanallar: ${totalChannels}\nKomutlar: ${commandsStore.size}`,
                        inline: true
                    },
                    {
                        name: "💾 Sistem Kaynakları", 
                        value: `RAM: ${memoryMB}MB / ${totalMemoryMB}MB\nUptime: ${uptimeStr}\nPID: ${process.pid}`,
                        inline: true
                    },
                    {
                        name: "🔧 Teknik Detaylar",
                        value: `Discord.js: v${discordVersion}\nNode.js: ${process.version}\nPlatform: ${process.platform}`,
                        inline: true
                    },
                    {
                        name: "⚙️ Bot Yapılandırması",
                        value: `Ortam: ${config?.ENVIRONMENT || 'Bilinmiyor'}\nLoglama: ${config?.LOG_LEVEL || 'info'}\nGuild ID: ${config?.DISCORD_BOT?.GUILD_ID || 'Global'}`,
                        inline: false
                    },
                    {
                        name: "📡 Bağlantı Durumu",
                        value: `WebSocket: ${Math.round(interaction.client.ws.ping)}ms\nProxy: ${config?.proxy?.ACTIVE ? '🟢 Aktif' : '🔴 Pasif'}\nAPI: ${config?.api?.ACTIVE ? '🟢 Aktif' : '🔴 Pasif'}`,
                        inline: false
                    }
                ])
                .setColor(0x3498DB)
                .setTimestamp()
                .setFooter({ 
                    text: `Habbo JÖH Bot v2.0 • ${new Date().toLocaleString('tr-TR')}`,
                    iconURL: interaction.client.user?.displayAvatarURL()
                });

            await interaction.editReply({ embeds: [botInfoEmbed] });

        } catch (error) {
            console.error("Botinfo komutu yürütülürken hata:", error);
            
            const errorEmbed = new EmbedBuilder()
                .setTitle("❌ Hata")
                .setDescription("Bot bilgileri alınırken bir hata oluştu.")
                .setColor(0xE74C3C)
                .setTimestamp()
                .setFooter({ text: 'Habbo JÖH Bot' });

            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
};

export = botInfoCommand;
