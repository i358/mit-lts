import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { Command } from "../../../types/command";
import { checkDatabaseHealth } from "../../../db_utilities";

const dbCheckCommand: Command = {
    data: new SlashCommandBuilder()
        .setName('dbcheck')
        .setDescription('Veritabanı bağlantılarının durumunu kontrol eder (Admin only)'),
    
    cooldown: 10,
    onlyAuthor: true,
    ephemeral: false, // Database durumu herkese görünür olabilir

    async exec(interaction: ChatInputCommandInteraction): Promise<void> {
        await interaction.deferReply();

        try {
            const health = await checkDatabaseHealth();
            
            const healthEmbed = new EmbedBuilder()
                .setTitle("🏥 Database Health Check")
                .setDescription("Veritabanı bağlantılarının durumu")
                .addFields([
                    {
                        name: "🐘 PostgreSQL",
                        value: health.postgres ? "🟢 Bağlı" : "🔴 Bağlantı Hatası",
                        inline: true
                    },
                    {
                        name: "🔴 Redis",
                        value: health.redis ? "🟢 Bağlı" : "🔴 Bağlantı Hatası",
                        inline: true
                    },
                    {
                        name: "📊 Genel Durum",
                        value: health.overall ? "🟢 Tüm Sistemler Normal" : "🔴 Sistem Hatası",
                        inline: false
                    },
                    {
                        name: "⏱️ Kontrol Zamanı",
                        value: new Date().toLocaleString('tr-TR'),
                        inline: false
                    }
                ])
                .setColor(health.overall ? 0x2ECC71 : 0xE74C3C)
                .setTimestamp()
                .setFooter({ 
                    text: `Habbo JÖH Bot • Database Monitor`,
                    iconURL: interaction.client.user?.displayAvatarURL()
                });

            await interaction.editReply({ embeds: [healthEmbed] });

        } catch (error) {
            console.error("Database check komutu yürütülürken hata:", error);
            
            const errorEmbed = new EmbedBuilder()
                .setTitle("❌ Hata")
                .setDescription("Database durumu kontrol edilirken bir hata oluştu.")
                .addFields([
                    { name: "🔴 Hata Detayı", value: error instanceof Error ? error.message : 'Bilinmeyen hata', inline: false }
                ])
                .setColor(0xE74C3C)
                .setTimestamp()
                .setFooter({ text: 'Habbo JÖH Bot' });

            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
};

export = dbCheckCommand;
