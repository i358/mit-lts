import { EmbedBuilder, ColorResolvable } from "discord.js";

/**
 * Başarı durumlarında kullanılacak embed oluşturucu
 * @param title - Başlık
 * @param description - Açıklama
 * @param fields - Alanlar (opsiyonel)
 * @returns Discord Embed
 */
export const SuccessEmbed = (
  title: string,
  description?: string,
  fields?: { name: string; value: string; inline?: boolean }[]
) => {
  const embed = new EmbedBuilder()
    .setTitle(`✅ ${title}`)
    .setColor(0x2ECC71)
    .setTimestamp()
    .setFooter({ text: 'HabboMIT Bot' });

  if (description) {
    embed.setDescription(description);
  }

  if (fields && fields.length > 0) {
    embed.addFields(fields);
  }

  return embed;
};

/**
 * Hata durumlarında kullanılacak embed oluşturucu
 * @param title - Başlık 
 * @param description - Açıklama
 * @param fields - Alanlar (opsiyonel)
 * @returns Discord Embed
 */
export const ErrorEmbed = (
  title: string,
  description?: string,
  fields?: { name: string; value: string; inline?: boolean }[]
) => {
  const embed = new EmbedBuilder()
    .setTitle(`❌ ${title}`)
    .setColor(0xE74C3C)
    .setTimestamp()
    .setFooter({ text: 'HabboMIT Bot' });

  if (description) {
    embed.setDescription(description);
  }

  if (fields && fields.length > 0) {
    embed.addFields(fields);
  }

  return embed;
};

/**
 * Bilgi verme durumlarında kullanılacak embed oluşturucu
 * @param title - Başlık
 * @param description - Açıklama 
 * @param fields - Alanlar (opsiyonel)
 * @returns Discord Embed
 */
export const InfoEmbed = (
  title: string,
  description?: string,
  fields?: { name: string; value: string; inline?: boolean }[]
) => {
  const embed = new EmbedBuilder()
    .setTitle(`ℹ️ ${title}`)
    .setColor(0x3498DB)
    .setTimestamp()
    .setFooter({ text: 'HabboMIT Bot' });

  if (description) {
    embed.setDescription(description);
  }

  if (fields && fields.length > 0) {
    embed.addFields(fields);
  }

  return embed;
};

/**
 * Yükleme/Bekleme durumlarında kullanılacak embed oluşturucu
 * @param title - Başlık
 * @param description - Açıklama
 * @param fields - Alanlar (opsiyonel)
 * @returns Discord Embed 
 */
export const LoadingEmbed = (
  title: string, 
  description?: string,
  fields?: { name: string; value: string; inline?: boolean }[]
) => {
  const embed = new EmbedBuilder()
    .setTitle(`⏳ ${title}`)
    .setColor(0xF39C12)
    .setTimestamp()
    .setFooter({ text: 'HabboMIT Bot' });

  if (description) {
    embed.setDescription(description);
  }

  if (fields && fields.length > 0) {
    embed.addFields(fields);
  }

  return embed;
};

/**
 * Özel embed oluşturucu
 * @param title - Başlık
 * @param description - Açıklama
 * @param color - Renk kodu
 * @param fields - Alanlar (opsiyonel)
 * @param footer - Alt bilgi (opsiyonel)
 * @returns Discord Embed
 */
export const CustomEmbed = (
  title: string,
  description?: string,
  color?: ColorResolvable,
  fields?: { name: string; value: string; inline?: boolean }[],
  footer?: string
) => {
  const embed = new EmbedBuilder()
    .setTitle(title)
    .setColor(color || 0x95A5A6)
    .setTimestamp()
    .setFooter({ text: footer || 'HabboMIT Bot' });

  if (description) {
    embed.setDescription(description);
  }

  if (fields && fields.length > 0) {
    embed.addFields(fields);
  }

  return embed;
};
