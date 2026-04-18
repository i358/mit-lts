import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";

export interface Command {
  data: SlashCommandBuilder | any;
  cooldown?: Number;
  onlyAuthor?: boolean;
  ephemeral?: boolean; // Admin komutları için ephemeral seçeneği
  exec(interaction: ChatInputCommandInteraction): Promise<void>;
}
