import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { Command } from "../../../types/command";
import { timerWorker } from "../../../workers/timer";

const timerCommand: Command = {
    data: new SlashCommandBuilder()
        .setName('timer')
        .setDescription('Timer worker durumunu görüntüler ve yönetir (Admin only)')
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('Timer worker durumunu gösterir'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('inspect')
                .setDescription('Detaylı timer worker bilgilerini gösterir')),
    
    cooldown: 5,
    onlyAuthor: true,
    ephemeral: false,

    async exec(interaction: ChatInputCommandInteraction): Promise<void> {
        await interaction.deferReply({ ephemeral: false });

        const subcommand = interaction.options.getSubcommand();

        try {
            switch (subcommand) {
                case 'status':
                    await handleTimerStatus(interaction);
                    break;
                case 'inspect':
                    await handleTimerInspect(interaction);
                    break;
                default:
                    await interaction.editReply({ content: "❌ Geçersiz alt komut!" });
            }
        } catch (error) {
            console.error("Timer komutu yürütülürken hata:", error);
            
            const errorEmbed = new EmbedBuilder()
                .setTitle("❌ Hata")
                .setDescription("Timer işlemi sırasında bir hata oluştu.")
                .setColor(0xE74C3C)
                .setTimestamp()
                .setFooter({ text: 'Habbo JÖH Bot' });

            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
};

async function handleTimerStatus(interaction: ChatInputCommandInteraction) {
    const status = timerWorker.getStatus();
    
    const timeUntilResetHours = Math.floor(status.timeUntilReset / (1000 * 60 * 60));
    const timeUntilResetMinutes = Math.floor((status.timeUntilReset % (1000 * 60 * 60)) / (1000 * 60));
    
    const statusEmbed = new EmbedBuilder()
        .setTitle("⏰ Timer Worker Durumu")
        .setDescription("24 saatlik kullanıcı takip timer'ının durumu")
        .addFields([
            {
                name: "🔄 Durum",
                value: status.isActive ? "🟢 Aktif" : "🔴 Pasif",
                inline: true
            },
            {
                name: "👥 Aktif Kullanıcı",
                value: status.activeUserCount.toString(),
                inline: true
            },
            {
                name: "⏳ Sonraki Reset",
                value: new Date(status.nextResetTime).toLocaleString('tr-TR'),
                inline: false
            },
            {
                name: "⏱️ Kalan Süre",
                value: `${timeUntilResetHours} saat ${timeUntilResetMinutes} dakika`,
                inline: true
            },
            {
                name: "📅 Reset Saati",
                value: "Her gün 09:00",
                inline: true
            }
        ])
        .setColor(status.isActive ? 0x2ECC71 : 0xE74C3C)
        .setTimestamp()
        .setFooter({ 
            text: `Habbo JÖH Bot • Timer Worker`,
            iconURL: interaction.client.user?.displayAvatarURL()
        });

    await interaction.editReply({ embeds: [statusEmbed] });
}

async function handleTimerInspect(interaction: ChatInputCommandInteraction) {
    // Detaylı bilgileri logla
    timerWorker.inspect();
    
    const status = timerWorker.getStatus();
    
    const inspectEmbed = new EmbedBuilder()
        .setTitle("🔍 Timer Worker Detaylı İnceleme")
        .setDescription("Timer worker'ın detaylı durumu konsol loglarına yazıldı")
        .addFields([
            {
                name: "📊 Temel Bilgiler",
                value: `Durum: ${status.isActive ? 'Aktif' : 'Pasif'}\nAktif Kullanıcı: ${status.activeUserCount}\nSonraki Reset: ${new Date(status.nextResetTime).toLocaleString('tr-TR')}`,
                inline: false
            },
            {
                name: "⏰ Zaman Bilgileri",
                value: `Kalan Süre: ${Math.round(status.timeUntilReset / (1000 * 60 * 60))} saat\nReset Periyodu: 24 saat\nReset Saati: 09:00`,
                inline: false
            },
            {
                name: "📝 Log Dosyası",
                value: "`./logs/timer.log` dosyasında detaylı loglar bulunur",
                inline: false
            }
        ])
        .setColor(0x3498DB)
        .setTimestamp()
        .setFooter({ text: 'Habbo JÖH Bot • Timer Inspect' });

    await interaction.editReply({ embeds: [inspectEmbed] });
}

export = timerCommand;