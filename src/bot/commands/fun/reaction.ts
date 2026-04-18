import { 
    ChatInputCommandInteraction, 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle,
    ComponentType,
    ButtonInteraction
} from 'discord.js';
import { Command } from '../../../types/command';

interface ReactionGame {
    userId: string;
    gameType: string;
    startTime: number;
    gameActive: boolean;
    score: number;
    level: number;
    bestTime: number;
}

export const command: Command = {
    cooldown: 3,
    data: new SlashCommandBuilder()
        .setName('reaction')
        .setDescription('⚡ Reaksiyon hızı testi! Ne kadar hızlı tepki verebilirsin?')
        .addStringOption(option =>
            option.setName('mode')
                .setDescription('Oyun modu seç')
                .setRequired(false)
                .addChoices(
                    { name: '⚡ Klasik - Tek butona tıkla', value: 'classic' },
                    { name: '🎯 Hedef Av - Doğru butonu bul', value: 'target' },
                    { name: '🌈 Renk Uyumu - Renkleri eşleştir', value: 'color' },
                    { name: '🔥 Survival - Sürekli oyun', value: 'survival' }
                )
        ),

    async exec(interaction: ChatInputCommandInteraction) {
        const mode = interaction.options.getString('mode') || 'classic';

        const game: ReactionGame = {
            userId: interaction.user.id,
            gameType: mode,
            startTime: 0,
            gameActive: false,
            score: 0,
            level: 1,
            bestTime: Infinity
        };

        if (mode === 'classic') {
            await startClassicMode(interaction, game);
        } else if (mode === 'target') {
            await startTargetMode(interaction, game);
        } else if (mode === 'color') {
            await startColorMode(interaction, game);
        } else if (mode === 'survival') {
            await startSurvivalMode(interaction, game);
        }
    }
};

async function startClassicMode(interaction: ChatInputCommandInteraction, game: ReactionGame) {
    const startEmbed = new EmbedBuilder()
        .setTitle('⚡ Klasik Reaksiyon Testi')
        .setDescription('Butonu hazırla... Yeşil olduğunda HEMEN tıkla!')
        .setColor(0x95A5A6)
        .addFields([
            { name: '📝 Kurallar', value: '• Buton yeşil olduğunda tıkla\n• En hızlı tepki vermeye çalış\n• 5 round oynanacak', inline: false },
            { name: '🎯 Hedef', value: '< 300ms = Mükemmel!', inline: true },
            { name: '⏱️ Durum', value: 'Hazırlanıyor...', inline: true }
        ])
        .setTimestamp();

    const waitButton = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('wait_button')
                .setLabel('Bekle...')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('⏳')
                .setDisabled(true)
        );

    const response = await interaction.reply({ 
        embeds: [startEmbed], 
        components: [waitButton],
        fetchReply: true 
    });

    let round = 1;
    const maxRounds = 5;
    const times: number[] = [];

    async function playRound() {
        // Random bekleme süresi (2-6 saniye)
        const waitTime = 2000 + Math.random() * 4000;
        
        // Bekleme mesajı
        const waitEmbed = new EmbedBuilder()
            .setTitle('⏳ Bekle...')
            .setDescription(`Round ${round}/${maxRounds} - Buton yeşil olana kadar bekle!`)
            .setColor(0xE74C3C)
            .addFields([
                { name: '⚠️ Dikkat', value: 'Çok erken tıklarsan diskalifiye olursun!', inline: false },
                { name: '📊 Round', value: `${round}/${maxRounds}`, inline: true }
            ])
            .setTimestamp();

        const redButton = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('red_button')
                    .setLabel('Bekle...')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🔴')
                    .setDisabled(true)
            );

        await interaction.editReply({ embeds: [waitEmbed], components: [redButton] });

        // Erken tıklama kontrolü
        let earlyClick = false;
        const earlyCollector = response.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: waitTime
        });

        earlyCollector.on('collect', async (buttonInteraction: ButtonInteraction) => {
            if (buttonInteraction.user.id !== interaction.user.id) return;
            
            earlyClick = true;
            const failEmbed = new EmbedBuilder()
                .setTitle('❌ Çok Erken!')
                .setDescription('Buton kırmızıyken tıkladın! Diskalifiye oldun.')
                .setColor(0xE74C3C)
                .addFields([
                    { name: '💡 İpucu', value: 'Buton yeşil olana kadar beklemen gerekiyor!', inline: false }
                ])
                .setTimestamp();

            await buttonInteraction.update({ embeds: [failEmbed], components: [] });
            return;
        });

        // Bekleme süresi bitti, butonu yeşil yap
        setTimeout(async () => {
            if (earlyClick) return;

            earlyCollector.stop();
            game.startTime = Date.now();

            const goEmbed = new EmbedBuilder()
                .setTitle('🟢 ŞIMDI!')
                .setDescription('HIZLI TIKLA!')
                .setColor(0x2ECC71)
                .setTimestamp();

            const greenButton = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('green_button')
                        .setLabel('TIKLA!')
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('⚡')
                );

            await interaction.editReply({ embeds: [goEmbed], components: [greenButton] });

            // Reaksiyon süresini ölç
            const reactionCollector = response.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 3000 // 3 saniye limit
            });

            reactionCollector.on('collect', async (buttonInteraction: ButtonInteraction) => {
                if (buttonInteraction.user.id !== interaction.user.id) return;

                const reactionTime = Date.now() - game.startTime;
                times.push(reactionTime);

                if (reactionTime < game.bestTime) {
                    game.bestTime = reactionTime;
                }

                let rating = '';
                let color = 0x95A5A6;
                
                if (reactionTime < 200) {
                    rating = '🚀 İNANILMAZ!';
                    color = 0xFFD700;
                } else if (reactionTime < 300) {
                    rating = '⚡ MÜKEMMEL!';
                    color = 0x2ECC71;
                } else if (reactionTime < 500) {
                    rating = '👍 İYİ!';
                    color = 0x3498DB;
                } else if (reactionTime < 800) {
                    rating = '😐 ORTA';
                    color = 0xF39C12;
                } else {
                    rating = '🐌 YAVAŞ';
                    color = 0xE74C3C;
                }

                const resultEmbed = new EmbedBuilder()
                    .setTitle(`Round ${round} Sonucu`)
                    .setDescription(`${rating}`)
                    .setColor(color)
                    .addFields([
                        { name: '⏱️ Reaksiyon Süren', value: `${reactionTime}ms`, inline: true },
                        { name: '🏆 En İyi', value: `${Math.min(...times)}ms`, inline: true },
                        { name: '📊 Round', value: `${round}/${maxRounds}`, inline: true }
                    ])
                    .setTimestamp();

                await buttonInteraction.update({ embeds: [resultEmbed], components: [] });

                round++;
                
                if (round <= maxRounds) {
                    setTimeout(() => playRound(), 2000);
                } else {
                    setTimeout(() => showFinalResults(interaction, times), 2000);
                }
            });

            reactionCollector.on('end', async (collected) => {
                if (collected.size === 0) {
                    // Zaman aşımı
                    times.push(3000); // Max süre
                    
                    const timeoutEmbed = new EmbedBuilder()
                        .setTitle('⏰ Zaman Aşımı')
                        .setDescription('3 saniye içinde tıklamadın!')
                        .setColor(0x95A5A6);

                    await interaction.editReply({ embeds: [timeoutEmbed], components: [] });

                    round++;
                    if (round <= maxRounds) {
                        setTimeout(() => playRound(), 2000);
                    } else {
                        setTimeout(() => showFinalResults(interaction, times), 2000);
                    }
                }
            });
        }, waitTime);
    }

    // İlk round'u başlat
    setTimeout(() => playRound(), 3000);
}

async function startTargetMode(interaction: ChatInputCommandInteraction, game: ReactionGame) {
    const embed = new EmbedBuilder()
        .setTitle('🎯 Hedef Av Modu')
        .setDescription('Doğru butonu bul ve tıkla!')
        .setColor(0xF39C12)
        .addFields([
            { name: '📝 Kurallar', value: '• Sadece BELİRLİ butona tıkla\n• Yanlış butona tıklarsan kaybedersin\n• 10 hedef vur!', inline: false }
        ])
        .setTimestamp();

    const startButton = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('start_target')
                .setLabel('Başla!')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🎯')
        );

    const response = await interaction.reply({ 
        embeds: [embed], 
        components: [startButton],
        fetchReply: true 
    });

    const collector = response.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 180000 // 3 dakika
    });

    let targetCount = 0;
    let currentTarget = '';

    collector.on('collect', async (buttonInteraction: ButtonInteraction) => {
        if (buttonInteraction.user.id !== interaction.user.id) return;

        if (buttonInteraction.customId === 'start_target') {
            await startTargetRound(buttonInteraction, game);
        } else {
            // Hedef kontrolü
            const isCorrect = buttonInteraction.customId === currentTarget;
            
            if (isCorrect) {
                targetCount++;
                game.score += 10;
                
                if (targetCount >= 10) {
                    // Oyun tamamlandı
                    await showTargetComplete(buttonInteraction, game);
                } else {
                    await startTargetRound(buttonInteraction, game);
                }
            } else {
                // Yanlış hedef
                const failEmbed = new EmbedBuilder()
                    .setTitle('❌ Yanlış Hedef!')
                    .setDescription('Oyun bitti! Doğru butona tıklaman gerekiyordu.')
                    .setColor(0xE74C3C)
                    .addFields([
                        { name: '🎯 Vurulan Hedef', value: `${targetCount}/10`, inline: true },
                        { name: '🏆 Skor', value: `${game.score}`, inline: true }
                    ])
                    .setTimestamp();

                await buttonInteraction.update({ embeds: [failEmbed], components: [] });
            }
        }
    });

    async function startTargetRound(buttonInteraction: ButtonInteraction, game: ReactionGame) {
        const targets = ['🔴', '🟡', '🟢', '🔵', '🟣'];
        const targetEmoji = targets[Math.floor(Math.random() * targets.length)];
        currentTarget = `target_${targetEmoji}`;

        const roundEmbed = new EmbedBuilder()
            .setTitle('🎯 Hedefi Vur!')
            .setDescription(`**${targetEmoji}** butona tıkla!`)
            .setColor(0xF39C12)
            .addFields([
                { name: '🎯 Hedef', value: targetEmoji, inline: true },
                { name: '📊 İlerleme', value: `${targetCount}/10`, inline: true },
                { name: '🏆 Skor', value: `${game.score}`, inline: true }
            ])
            .setTimestamp();

        // Rastgele buton sırası
        const buttons = targets.map(emoji => 
            new ButtonBuilder()
                .setCustomId(`target_${emoji}`)
                .setLabel(emoji)
                .setStyle(ButtonStyle.Secondary)
        );

        // Butonları karıştır
        for (let i = buttons.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [buttons[i], buttons[j]] = [buttons[j], buttons[i]];
        }

        const buttonRow = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(buttons);

        await buttonInteraction.update({ embeds: [roundEmbed], components: [buttonRow] });
    }
}

async function showTargetComplete(interaction: ButtonInteraction, game: ReactionGame) {
    const embed = new EmbedBuilder()
        .setTitle('🏆 Hedef Av Tamamlandı!')
        .setDescription('Tüm hedefleri başarıyla vurdun!')
        .setColor(0xFFD700)
        .addFields([
            { name: '🎯 Vurulan Hedef', value: '10/10', inline: true },
            { name: '🏆 Final Skor', value: `${game.score}`, inline: true },
            { name: '🎖️ Başarı', value: 'Keskin Nişancı!', inline: true }
        ])
        .setTimestamp()
        .setFooter({ text: '🎉 Mükemmel performans!' });

    await interaction.update({ embeds: [embed], components: [] });
}

async function startColorMode(interaction: ChatInputCommandInteraction, game: ReactionGame) {
    // Renk eşleştirme modu - implement edilecek
    const embed = new EmbedBuilder()
        .setTitle('🌈 Renk Uyumu')
        .setDescription('Bu mod yakında gelecek!')
        .setColor(0x9B59B6);

    await interaction.reply({ embeds: [embed] });
}

async function startSurvivalMode(interaction: ChatInputCommandInteraction, game: ReactionGame) {
    // Survival modu - implement edilecek
    const embed = new EmbedBuilder()
        .setTitle('🔥 Survival Modu')
        .setDescription('Bu mod yakında gelecek!')
        .setColor(0xE74C3C);

    await interaction.reply({ embeds: [embed] });
}

async function showFinalResults(interaction: ChatInputCommandInteraction, times: number[]) {
    const averageTime = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
    const bestTime = Math.min(...times);

    let overallRating = '';
    let color = 0x95A5A6;
    
    if (averageTime < 250) {
        overallRating = '🚀 PROFESSIONAL GAMER';
        color = 0xFFD700;
    } else if (averageTime < 350) {
        overallRating = '⚡ LIGHTNING FAST';
        color = 0x2ECC71;
    } else if (averageTime < 500) {
        overallRating = '👍 PRETTY GOOD';
        color = 0x3498DB;
    } else if (averageTime < 700) {
        overallRating = '😐 AVERAGE';
        color = 0xF39C12;
    } else {
        overallRating = '🐌 NEEDS PRACTICE';
        color = 0xE74C3C;
    }

    const roundResults = times.map((time, index) => 
        `Round ${index + 1}: ${time}ms`
    ).join('\n');

    const finalEmbed = new EmbedBuilder()
        .setTitle('⚡ Reaksiyon Testi Tamamlandı!')
        .setDescription(`${overallRating}`)
        .setColor(color)
        .addFields([
            { name: '⏱️ Ortalama Süre', value: `${averageTime}ms`, inline: true },
            { name: '🏆 En İyi Süre', value: `${bestTime}ms`, inline: true },
            { name: '📊 Round Sayısı', value: `${times.length}`, inline: true },
            { name: '📈 Tüm Sonuçlar', value: `\`\`\`\n${roundResults}\n\`\`\``, inline: false }
        ])
        .setTimestamp()
        .setFooter({ text: '🎮 Tekrar oynamak için komutu yeniden çalıştırın!' });

    await interaction.editReply({ embeds: [finalEmbed], components: [] });
}