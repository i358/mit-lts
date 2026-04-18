import { config } from '../config';
import { EmbedBuilder, ColorResolvable } from 'discord.js';
import { globalStore } from './globalStore';
import { sanitizeDiscordInput } from './index';

interface ManagementLogOptions {
  action: string;
  adminUsername: string;
  targetUsername?: string;
  details?: string;
  success: boolean;
}

export async function logManagementAction(options: ManagementLogOptions) {
  try {
    const clientStore = globalStore.collection<string, any>("system");
    const client = clientStore.get('discordClient');
    
    if (!client) {
      console.error('Discord client not found in global store');
      return;
    }

    const channelId = config().app.DISCORD_BOT.CHANNELS.SITE_LOG;
    const channel = client.channels.cache.get(channelId);

    if (!channel || !channel.isTextBased()) {
      console.error('Site log channel not found or is not a text channel');
      return;
    }

    const color: ColorResolvable = options.success ? '#2ecc71' : '#e74c3c';
    
    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle('Yönetim İşlemi')
      .addFields([
        { name: 'İşlem', value: sanitizeDiscordInput(options.action) },
        { name: 'Yönetici', value: sanitizeDiscordInput(options.adminUsername) }
      ])
      .setTimestamp();

    if (options.targetUsername) {
      embed.addFields({ name: 'Hedef Kullanıcı', value: sanitizeDiscordInput(options.targetUsername) });
    }

    if (options.details) {
      embed.addFields({ name: 'Detaylar', value: sanitizeDiscordInput(options.details) });
    }

    await channel.send({ embeds: [embed] });
  } catch (error) {
    console.error('Management log error:', error);
  }
}

export async function logDemotion(options: {
  username: string;
  oldBadge: string;
  oldRank: string;
  newBadge: string;
  newRank: string;
  codename: string;
}) {
  try {
    const clientStore = globalStore.collection<string, any>("system");
    const client = clientStore.get('discordClient');
    
    if (!client) {
      console.error('Discord client not found in global store');
      return;
    }

    const channelId = config().app.DISCORD_BOT.CHANNELS.DEMOTE_LOG;
    const channel = client.channels.cache.get(channelId);

    if (!channel || !channel.isTextBased()) {
      console.error('Demotion log channel not found or is not a text channel');
      return;
    }

    const { createPromotionImage } = await import('./promotionImage');
    const imageBuffer = await createPromotionImage({
      ...options,
      type: 'demotion',
      timestamp: new Date().toLocaleString('tr-TR')
    });

    await channel.send({
      files: [{
        attachment: imageBuffer,
        name: 'demotion.png'
      }]
    });
  } catch (error) {
    console.error('Demotion log error:', error);
  }
}

export async function logPromotion(options: {
  username: string;
  oldBadge: string;
  oldRank: string;
  newBadge: string;
  newRank: string;
  codename: string;
  workTime?: {
    hours: number;
    minutes: number;
  };
}) {
  try {
    const clientStore = globalStore.collection<string, any>("system");
    const client = clientStore.get('discordClient');
    
    if (!client) {
      console.error('Discord client not found in global store');
      return;
    }

    const channelId = config().app.DISCORD_BOT.CHANNELS.BADGE_LOG;

    const channel = client.channels.cache.get(channelId);

    if (!channel || !channel.isTextBased()) {
      console.error('Promotion log channel not found or is not a text channel');
      return;
    }

    // Resmi oluştur
    const { createPromotionImage } = await import('./promotionImage');
    const imageBuffer = await createPromotionImage({
      ...options,
      timestamp: new Date().toLocaleString('tr-TR')
    });

    // Embed oluştur (yedek olarak)
    const embed = new EmbedBuilder()
      .setColor('#3B82F6')
      .setTitle('Terfi İşlemi')
      .addFields([
        { name: 'Kullanıcı', value: sanitizeDiscordInput(options.username) },
        { name: 'Eski Rozet/Rütbe', value: sanitizeDiscordInput(`${options.oldBadge}/${options.oldRank}`) },
        { name: 'Yeni Rozet/Rütbe', value: sanitizeDiscordInput(`${options.newBadge}/${options.newRank}`) },
        { name: 'Terfi Görevlisi', value: sanitizeDiscordInput(options.codename) }
      ]);

    if (options.workTime) {
      embed.addFields({
        name: 'Terfi Süresi',
        value: `${options.workTime.hours} saat ${options.workTime.minutes} dakika`
      });
    }

    embed.setTimestamp();

    // Sadece resim gönder
    await channel.send({
      files: [{
        attachment: imageBuffer,
        name: 'promotion.png'
      }]
    });
  } catch (error) {
    console.error('Promotion log error:', error);
  }
}

export async function logSiteLogin(username: string) {
  try {
    const clientStore = globalStore.collection<string, any>("system");
    const client = clientStore.get('discordClient');
    
    if (!client) {
      console.error('Discord client not found in global store');
      return;
    }

    const channelId = config().app.DISCORD_BOT.CHANNELS.SITE_LOG;
    const channel = client.channels.cache.get(channelId);

    if (!channel || !channel.isTextBased()) {
      console.error('Site log channel not found or is not a text channel');
      return;
    }

    const embed = new EmbedBuilder()
      .setColor('#2ecc71')
      .setTitle('Kullanıcı Aktivitesi')
      .setDescription(sanitizeDiscordInput(username))
      .setTimestamp();

    await channel.send({ embeds: [embed] });
  } catch (error) {
    console.error('Site log error:', error);
  }
}

export async function logTraining(options: {
  traineeUsername: string;
  trainerUsername: string;
  discordVerified: boolean;
}) {
  try {
    const clientStore = globalStore.collection<string, any>("system");
    const client = clientStore.get('discordClient');

    if (!client) {
      console.error('Discord client not found in global store');
      return;
    }

    const channelId = config().app.DISCORD_BOT.CHANNELS.TRAINING_LOG;
    const channel = client.channels.cache.get(channelId);

    if (!channel || !channel.isTextBased()) {
      console.error('Training log channel not found or is not a text channel');
      return;
    }

    const { createTrainingImage } = await import('./trainingImage');
    const imageBuffer = await createTrainingImage({
      traineeUsername: options.traineeUsername,
      trainerUsername: options.trainerUsername,
      discordVerified: options.discordVerified,
      timestamp: new Date().toLocaleString('tr-TR')
    });

    await channel.send({
      files: [
        {
          attachment: imageBuffer,
          name: 'training.png'
        }
      ]
    });
  } catch (error) {
    console.error('Training log error:', error);
  }
}