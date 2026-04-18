import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, version as discordVersion } from "discord.js";
import { Command } from "../../../types/command";
import { globalStore } from "../../../utils/globalStore";

const pingCommand: Command = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Bot ve bağlantı durumunu gösterir'),
    cooldown: 5,
    ephemeral: false, // Ping komutu herkese görünür olacak
    async exec(interaction: ChatInputCommandInteraction): Promise<void> {
        await interaction.deferReply();

        try {
            // API gecikmeleri
            const wsHeartbeat = Math.round(interaction.client.ws.ping);
            const msgLatency = Date.now() - interaction.createdTimestamp;

            // Sistem bilgileri
            const uptime = process.uptime();
            const days = Math.floor(uptime / 86400);
            const hours = Math.floor((uptime % 86400) / 3600);
            const minutes = Math.floor((uptime % 3600) / 60);
            const seconds = Math.floor(uptime % 60);
            const uptimeStr = `${days}g ${hours}s ${minutes}d ${seconds}s`;

            // Global store durumu
            const commandsStore = globalStore.collection("commands");
            const configStore = globalStore.collection("config");
            
            // Renk belirleme (ping'e göre)
            let embedColor: number;
            if (wsHeartbeat < 200) {
                embedColor = 0x2ECC71; // Yeşil - İyi
            } else if (wsHeartbeat < 400) {
                embedColor = 0xE67E22; // Turuncu - Orta
            } else {
                embedColor = 0xE74C3C; // Kırmızı - Kötü
            }

            const pingEmbed = new EmbedBuilder()
                .setTitle("🏓 Pong!")
                .setDescription("Bot sistemlerinin durum raporu")
                .addFields([
                    { 
                        name: "⚡ Discord API",
                        value: `WebSocket: ${wsHeartbeat}ms\nMesaj: ${msgLatency}ms`,
                        inline: true
                    },
                    {
                        name: "� Sistem",
                        value: `RAM: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB\nUptime: ${uptimeStr}`,
                        inline: true
                    },
                    {
                        name: "🎮 Bot Durumu", 
                        value: `Komutlar: ${commandsStore.size}\nSunucular: ${interaction.client.guilds.cache.size}\nKullanıcılar: ${interaction.client.users.cache.size}`,
                        inline: true
                    },
                    {
                        name: "🔧 Sürümler",
                        value: `Discord.js: v${discordVersion}\nNode.js: ${process.version}`,
                        inline: false
                    }
                ])
                .setColor(embedColor)
                .setTimestamp()
                .setFooter({ 
                    text: `HabboJÖH Bot • ${new Date().toLocaleString('tr-TR')}` 
                });

            await interaction.editReply({ embeds: [pingEmbed] });

        } catch (error) {
            console.error("Ping komutu yürütülürken hata:", error);
            
            const errorEmbed = new EmbedBuilder()
                .setTitle("❌ Hata")
                .setDescription("Durum bilgisi alınırken bir hata oluştu.")
                .setColor(0xE74C3C)
                .setTimestamp()
                .setFooter({ text: 'HabboJÖH Bot' });

            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
};

export = pingCommand;
