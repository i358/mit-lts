import { 
    ChatInputCommandInteraction, 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle,
    ComponentType,
    ButtonInteraction,
    User
} from 'discord.js';
import { Command } from '../../../types/command';

interface WordChainPlayer {
    user: User;
    score: number;
    wordsUsed: string[];
    isEliminated: boolean;
}

interface WordChainGame {
    players: Map<string, WordChainPlayer>;
    hostId: string;
    currentWord: string;
    usedWords: Set<string>;
    currentPlayerIndex: number;
    playerOrder: string[];
    round: number;
    maxRounds: number;
    gameActive: boolean;
    gameMode: string;
    timeLimit: number;
}

export const command: Command = {
    cooldown: 5,
    onlyAuthor: false,
    data: new SlashCommandBuilder()
        .setName('wordchain')
        .setDescription('🔗 Kelime Zinciri oyunu - Son harfle başlayan kelime söyle!')
        .addStringOption(option =>
            option.setName('mode')
                .setDescription('Oyun modu seç')
                .setRequired(false)
                .addChoices(
                    { name: '🎯 Klasik - Normal tempo', value: 'classic' },
                    { name: '⚡ Hızlı - 15 saniye süre', value: 'speed' }
                )
        )
        .addIntegerOption(option =>
            option.setName('rounds')
                .setDescription('Round sayısı (3-15, varsayılan: 8)')
                .setRequired(false)
                .setMinValue(3)
                .setMaxValue(15)
        ),

    async exec(interaction: ChatInputCommandInteraction) {
        const mode = interaction.options.getString('mode') || 'classic';
        const rounds = interaction.options.getInteger('rounds') || 8;

        const game: WordChainGame = {
            players: new Map(),
            hostId: interaction.user.id,
            currentWord: '',
            usedWords: new Set(),
            currentPlayerIndex: 0,
            playerOrder: [],
            round: 0,
            maxRounds: rounds,
            gameActive: false,
            gameMode: mode,
            timeLimit: mode === 'speed' ? 15000 : 45000
        };

        // Host'u oyuna ekle
        game.players.set(interaction.user.id, {
            user: interaction.user,
            score: 0,
            wordsUsed: [],
            isEliminated: false
        });

        const embed = createLobbyEmbed(game);
        const buttons = createLobbyButtons();

        const response = await interaction.reply({ 
            embeds: [embed], 
            components: [buttons],
            fetchReply: true 
        });

        const lobbyCollector = response.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 120000 // 2 dakika lobby
        });

        lobbyCollector.on('collect', async (buttonInteraction: ButtonInteraction) => {
            const userId = buttonInteraction.user.id;
            
            if (buttonInteraction.customId === 'join_wordchain') {
                if (game.players.has(userId)) {
                    await buttonInteraction.reply({
                        content: '❌ Zaten oyundasın!',
                        ephemeral: true
                    });
                    return;
                }

                if (game.players.size >= 6) {
                    await buttonInteraction.reply({
                        content: '❌ Oyun dolu! (Maksimum 6 oyuncu)',
                        ephemeral: true
                    });
                    return;
                }

                game.players.set(userId, {
                    user: buttonInteraction.user,
                    score: 0,
                    wordsUsed: [],
                    isEliminated: false
                });

                const updatedEmbed = createLobbyEmbed(game);
                await buttonInteraction.update({ embeds: [updatedEmbed], components: [buttons] });

            } else if (buttonInteraction.customId === 'start_wordchain') {
                if (userId !== game.hostId) {
                    await buttonInteraction.reply({
                        content: '❌ Sadece host oyunu başlatabilir!',
                        ephemeral: true
                    });
                    return;
                }

                if (game.players.size < 2) {
                    await buttonInteraction.reply({
                        content: '❌ En az 2 oyuncu gerekli!',
                        ephemeral: true
                    });
                    return;
                }

                lobbyCollector.stop('game_started');
                await startGame(buttonInteraction, game, response);
            }
        });

        lobbyCollector.on('end', async (collected: any, reason: string) => {
            if (reason === 'time') {
                const timeoutEmbed = new EmbedBuilder()
                    .setTitle('⏰ Oyun Zaman Aşımı')
                    .setDescription('Oyun lobisi zaman aşımına uğradı!')
                    .setColor(0x95A5A6);

                try {
                    await response.edit({ embeds: [timeoutEmbed], components: [] });
                } catch (error) {
                    console.error('Failed to edit lobby timeout message:', error);
                }
            }
        });
    }
};

function createLobbyEmbed(game: WordChainGame): EmbedBuilder {
    const playerList = Array.from(game.players.values())
        .map((player, index) => `${index + 1}. ${player.user.displayName}${player.user.id === game.hostId ? ' 👑' : ''}`)
        .join('\n') || 'Henüz oyuncu yok';

    const modeDescriptions = {
        classic: '🎯 Klasik - 45 saniye düşünme süresi',
        speed: '⚡ Hızlı - Sadece 15 saniye süren var!'
    };

    return new EmbedBuilder()
        .setTitle('🔗 Kelime Zinciri Lobisi')
        .setDescription('Oyuncular toplanıyor! Son harfle başlayan kelime söyleme oyunu.')
        .setColor(0x3498DB)
        .addFields([
            { name: '👥 Oyuncular', value: `\`\`\`\n${playerList}\n\`\`\``, inline: true },
            { name: '🎮 Mod', value: modeDescriptions[game.gameMode as keyof typeof modeDescriptions], inline: true },
            { name: '🔄 Round Sayısı', value: `${game.maxRounds}`, inline: true },
            { name: '📊 Durum', value: `${game.players.size}/6 oyuncu`, inline: true },
            { name: '📝 Kurallar', value: '• Son harfle başlayan yeni kelime\n• Kullanılan kelimeler tekrar olmaz\n• Türkçe kelimeler geçerli\n• Zaman dolunca eleme!', inline: false }
        ])
        .setTimestamp()
        .setFooter({ text: 'Host oyunu başlatabilir!' });
}

function createLobbyButtons(): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('join_wordchain')
                .setLabel('Oyuna Katıl')
                .setStyle(ButtonStyle.Success)
                .setEmoji('🔗'),
            new ButtonBuilder()
                .setCustomId('start_wordchain')
                .setLabel('Oyunu Başlat')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🎮')
        );
}

async function startGame(interaction: ButtonInteraction, game: WordChainGame, originalResponse: any) {
    game.gameActive = true;
    game.playerOrder = Array.from(game.players.keys());
    
    // Rastgele başlangıç kelimesi
    const startWords = ['elma', 'araba', 'kitap', 'masa', 'telefon', 'okul', 'deniz', 'güneş', 'kalem', 'sandalye'];
    game.currentWord = startWords[Math.floor(Math.random() * startWords.length)];
    game.usedWords.add(game.currentWord.toLowerCase());

    await playRound(game, originalResponse);
}

async function playRound(game: WordChainGame, originalResponse: any) {
    game.round++;
    
    if (game.round > game.maxRounds) {
        await showFinalResults(game, originalResponse);
        return;
    }

    // Eliminasyonları kontrol et
    const activePlayers = game.playerOrder.filter(id => !game.players.get(id)?.isEliminated);
    
    if (activePlayers.length <= 1) {
        await showFinalResults(game, originalResponse);
        return;
    }

    // Sıradaki oyuncuyu bul
    while (game.players.get(game.playerOrder[game.currentPlayerIndex])?.isEliminated) {
        game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.playerOrder.length;
    }

    const currentPlayer = game.players.get(game.playerOrder[game.currentPlayerIndex])!;
    const lastLetter = game.currentWord.slice(-1).toLowerCase();

    const roundEmbed = new EmbedBuilder()
        .setTitle('🔗 Kelime Zinciri')
        .setDescription(`**Round ${game.round}/${game.maxRounds}**`)
        .setColor(0x3498DB)
        .addFields([
            {
                name: '📝 Mevcut Kelime',
                value: `\`\`\`\n🔤 ${game.currentWord.toUpperCase()}\n📌 Son harf: "${lastLetter.toUpperCase()}"\n\`\`\``,
                inline: false
            },
            {
                name: '🎯 Sıradaki Oyuncu',
                value: `${currentPlayer.user.toString()}\n⏰ ${game.timeLimit / 1000} saniye süren var!`,
                inline: true
            },
            {
                name: '📊 Durum',
                value: createPlayerStatus(game),
                inline: true
            }
           
        ])
        .setTimestamp()
        .setFooter({ text: `Kullanılan kelime sayısı: ${game.usedWords.size}` });

    try {
        await originalResponse.edit({ embeds: [roundEmbed], components: [] });
    } catch (error) {
        console.error('Failed to edit message in playRound:', error);
        return;
    }

    // Mesaj collector ile kelime bekle
    const messageCollector = originalResponse.channel.createMessageCollector({
        filter: (msg: any) => msg.author.id === currentPlayer.user.id && !msg.author.bot,
        time: game.timeLimit,
        max: 1
    });

    messageCollector.on('collect', async (message: any) => {
        const word = message.content.trim().toLowerCase();
        
        // Kelime kontrolü
        const isValid = await isValidWord(word, lastLetter, game.usedWords);
        
        if (!isValid) {
            currentPlayer.isEliminated = true;
            
            const eliminationEmbed = new EmbedBuilder()
                .setTitle('❌ Eliminasyon!')
                .setDescription(`${currentPlayer.user.displayName} elendi!`)
                .setColor(0xE74C3C)
                .addFields([
                    {
                        name: '📝 Hatalı Kelime',
                        value: `"${word}"`,
                        inline: true
                    },
                    {
                        name: '❌ Sebep',
                        value: await getErrorReason(word, lastLetter, game.usedWords),
                        inline: true
                    }
                ]);

            try {
                await originalResponse.edit({ embeds: [eliminationEmbed], components: [] });
                try {
                    await message.delete();
                } catch (deleteError) {
                    // Mesaj silinemiyor, devam et
                }
            } catch (error) {
                console.error('Failed to edit elimination message:', error);
            }
        } else {
            // Geçerli kelime
            game.currentWord = word;
            game.usedWords.add(word);
            currentPlayer.score += word.length;
            currentPlayer.wordsUsed.push(word);
            
            try {
                await message.delete();
            } catch (deleteError) {
                // Mesaj silinemiyor, devam et
            }
        }

        // Sıradaki oyuncuya geç
        game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.playerOrder.length;
        
        // 2 saniye bekle sonra devam et
        setTimeout(() => {
            playRound(game, originalResponse);
        }, 2000);
    });

    messageCollector.on('end', async (collected: any, reason: string) => {
        if (reason === 'time' && collected.size === 0) {
            // Zaman doldu
            currentPlayer.isEliminated = true;
            
            const timeoutEmbed = new EmbedBuilder()
                .setTitle('⏰ Zaman Doldu!')
                .setDescription(`${currentPlayer.user.displayName} zamanında kelime söyleyemedi ve elendi!`)
                .setColor(0xE74C3C);

            try {
                await originalResponse.edit({ embeds: [timeoutEmbed], components: [] });
            } catch (error) {
                console.error('Failed to edit timeout message:', error);
            }

            // Sıradaki oyuncuya geç
            game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.playerOrder.length;
            
            // 2 saniye bekle sonra devam et
            setTimeout(() => {
                playRound(game, originalResponse);
            }, 2000);
        }
    });
}

async function showFinalResults(game: WordChainGame, originalResponse: any) {
    const players = Array.from(game.players.values())
        .filter(p => !p.isEliminated)
        .sort((a, b) => b.score - a.score);

    const winner = players[0];
    
    const finalEmbed = new EmbedBuilder()
        .setTitle('🏆 Kelime Zinciri Tamamlandı!')
        .setColor(0x2ECC71);

    if (winner) {
        finalEmbed.setDescription(`🎉 **${winner.user.displayName}** kazandı!`);
        
        const results = players.map((player, index) => {
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '📍';
            return `${medal} **${player.user.displayName}**\n   └ Puan: ${player.score} | Kelimeler: ${player.wordsUsed.length}`;
        }).join('\n\n');

        finalEmbed.addFields([
            {
                name: '🏆 Final Sıralaması',
                value: results,
                inline: false
            },
            {
                name: '📊 İstatistikler',
                value: `Toplam Kelime: ${game.usedWords.size}\nToplam Round: ${game.round}\nOyun Modu: ${game.gameMode === 'speed' ? '⚡ Hızlı' : '🎯 Klasik'}`,
                inline: false
            }
        ]);
    } else {
        finalEmbed.setDescription('🤷‍♂️ Tüm oyuncular elendi!');
    }

    try {
        await originalResponse.edit({ embeds: [finalEmbed], components: [] });
    } catch (error) {
        console.error('Failed to edit final results message:', error);
    }
}

function createPlayerStatus(game: WordChainGame): string {
    const activePlayers = Array.from(game.players.values())
        .filter(p => !p.isEliminated)
        .sort((a, b) => b.score - a.score);

    return activePlayers.map((player, index) => {
        const isCurrentPlayer = game.playerOrder[game.currentPlayerIndex] === player.user.id;
        const indicator = isCurrentPlayer ? '▶️' : '🔸';
        return `${indicator} ${player.user.displayName}: ${player.score}`;
    }).join('\n') || 'Hiç aktif oyuncu yok';
}

async function isValidWord(word: string, requiredFirstLetter: string, usedWords: Set<string>): Promise<boolean> {
    // Minimum uzunluk kontrolü
    if (word.length < 2) return false;
    
    // İlk harf kontrolü
    if (word[0].toLowerCase() !== requiredFirstLetter.toLowerCase()) return false;
    
    // Daha önce kullanılmış mı
    if (usedWords.has(word.toLowerCase())) return false;
    
    // Türkçe karakterler kontrolü
    const turkishPattern = /^[a-züğışöçı]+$/i;
    if (!turkishPattern.test(word)) return false;

    // API'de sözlükte var mı kontrol et
    const isInDictionary = await checkWordInAPI(word);
    return isInDictionary;
}

async function checkWordInAPI(word: string): Promise<boolean> {
    try {
        const response = await fetch(`https://sozluk.gov.tr/yazim?ara=${encodeURIComponent(word)}`);
        if (!response.ok) return false;
        
        const text = await response.text();
        // Eğer yanıt boşsa veya hata içeriyorsa false döndür
        //@ts-ignore
        return text && text.trim().length > 0;
    } catch (error) {
        console.error('API kontrol hatası:', error);
        return false;
    }
}

async function getErrorReason(word: string, requiredLetter: string, usedWords: Set<string>): Promise<string> {
    if (word.length < 2) return 'Çok kısa kelime';
    if (word[0].toLowerCase() !== requiredLetter.toLowerCase()) return `"${requiredLetter.toUpperCase()}" ile başlamalı`;
    if (usedWords.has(word.toLowerCase())) return 'Daha önce kullanılmış';
    
    // API kontrolü - sözlükte yoksa
    const isInDictionary = await checkWordInAPI(word);
    if (!isInDictionary) return 'Sözlükte bulunamadı';
    
    return 'Geçersiz kelime';
}

function getExampleWords(letter: string): string {
    const examples: { [key: string]: string[] } = {
        'a': ['araba', 'armut', 'anahtar'],
        'e': ['elma', 'ev', 'ekmek'],
        'i': ['inek', 'iğne', 'irmak'],
        'o': ['okul', 'orman', 'oyun'],
        'u': ['uçak', 'umut', 'uyku'],
        'k': ['kalem', 'kedi', 'kitap'],
        'r': ['radyo', 'renk', 'rüya'],
        't': ['telefon', 'top', 'tren'],
        'n': ['nane', 'neden', 'nasıl'],
        's': ['sandalye', 'su', 'ses'],
        'l': ['limon', 'lamba', 'liman'],
        'm': ['masa', 'meyve', 'motor'],
        'p': ['portakal', 'pano', 'park'],
        'd': ['deniz', 'defter', 'doktor'],
        'y': ['yemek', 'yatak', 'yol'],
        'b': ['balon', 'baba', 'bahçe'],
        'ç': ['çanta', 'çiçek', 'çorba'],
        'g': ['gül', 'gece', 'göz'],
        'h': ['hastane', 'harita', 'hava'],
        'j': ['jilet', 'jeton', 'jimnastik'],
        'f': ['fırın', 'fare', 'film'],
        'v': ['vazo', 'vagon', 'vitamin'],
        'z': ['zaman', 'zebra', 'zil'],
        'ş': ['şeker', 'şapka', 'şarkı'],
        'ğ': ['ğğğ', 'ğorilla', 'ğrrrr'], // Bu harf zor :)
        'ı': ['ırçık', 'ıslak', 'ırmak'],
        'ö': ['öğretmen', 'ödev', 'ördek'],
        'ü': ['üzüm', 'ülke', 'üniversite']
    };
    
    const words = examples[letter.toLowerCase()] || ['???'];
    return words.slice(0, 2).join(', ');
}