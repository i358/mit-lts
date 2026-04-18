import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { Command } from "../../../types/command";
import { discordLogger as logger } from "../../../logger";
import { InfoEmbed, ErrorEmbed } from "../../utils/embeds";
import { createUserRow, getUserRow } from "../../../db_utilities/postgres";
import { randomBytes, createHash } from "crypto";
import { Snowflake } from "../../../api/utils/snowflake";
import { Timestamp } from "../../../api/utils/timestamp";
import { Crypter } from "../../../api/utils/crypter";
import { config } from "../../../config";
import base64url from "base64url";
import { DEFAULT_BITFLAGS } from "../../../utils/bitflagsManager";
import { getAdminMask, ROLES } from "../../../types/permissions";
import * as path from "path";
import fs from "fs";

const createRootUserCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("create_root_user")
    .setDescription("Creates a new root user with maximum permissions"),

  cooldown: 10,
  onlyAuthor: true, // Sadece adminler kullanabilir
  ephemeral: true, // Mesajlar gizli olacak

  async exec(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });
 
    try {
      // Rastgele şifre oluştur (32 karakter)
      const password = randomBytes(76).toString("hex");

        // Rastgele bir root username hash'i oluştur
        const usernameHash = `root_${randomBytes(8).toString("hex")}`;

      // Önce root kullanıcının var olup olmadığını kontrol et
      const existingRoot = await getUserRow({
        in: "id",
        value: 11111111111,
        out: "id",
      });

      if (existingRoot) {
        await interaction.editReply({
          embeds: [
            ErrorEmbed(
              "Error Creating Root User",
              "A root user already exists in the database."
            ),
          ],
        });
        return;
      }

      const user_id = 11111111111

      // JWT Secret kontrolü
      const jwtSecret = config().api.SECURITY?.JWT_SECRET;
      if (!jwtSecret) {
        throw new Error("JWT_SECRET not configured");
      }

      // JWT Secret'dan 32-byte key oluştur
      const keyHash = createHash("sha256").update(jwtSecret).digest();

      // Metadata oluştur
      const metadata = {
        user_id: user_id.toString(),
        password: password,
      };

      // HMAC oluştur
      const hmacInstance = new Crypter.HMAC();
      const md5Instance = new Crypter.MD5();
      const hmacKey = await md5Instance.create(jwtSecret, { encoding: "none" });
      const hmac = await hmacInstance.create(
        JSON.stringify(metadata),
        hmacKey,
        { encoding: "base64url" }
      );

      // IV ve HMAC şifreleme
      const iv = randomBytes(16);
      const encryptedHmac = await new Crypter.AES256CBC().encrypt(hmac, {
        key: keyHash,
        iv: iv,
      });

      // IV ve encrypted data'yı birleştir
      const combinedSecret = iv.toString("hex") + (encryptedHmac as any).hash;

      // Calculate maximum user_flags (all permissions)
      let maxUserFlags = ROLES.ADMIN;


      // Root user'ı oluştur
      const userId = await createUserRow({
        id: user_id.toString(),
        habbo_id: Number(config().app.SPOTTER.ID),
        username: usernameHash,
        badge:0,
        rank:0,
        salary:BigInt(0),
        ip_addr: "0.0.0.0",
        secret: combinedSecret, // Encrypted secret with IV
        coins: 1000000, // 1M coins
        bitflags: DEFAULT_BITFLAGS, // Badge-based permissions - default
        user_flags: maxUserFlags, // All system permissions
        avatar:
          "https://www.habbo.com.tr/habbo-imaging/avatarimage?figure=hr-155-31.hd-180-1.ch-215-66.lg-275-82.sh-295-1408&direction=2&head_direction=2&gesture=nrm&size=l", // Default root avatar
      });

      if (!userId) {
        await interaction.editReply({
          embeds: [
            ErrorEmbed(
              "Error Creating Root User",
              "Failed to create root user in database."
            ),
          ],
        });
        return;
      }

      // Başarılı olduğunda şifreyi DM olarak gönder
      try {
        await interaction.user.send({
          embeds: [
            InfoEmbed(
              "Root User Created",
              `Root user has been created successfully.\nUsername: \`${usernameHash}\`\nPassword: \`${password}\``
            ),
          ],
        });

        await interaction.editReply({
          embeds: [
            InfoEmbed(
              "Root User Created",
              "Root user has been created successfully. Check your DMs for the password."
            ),
          ],
        });
      } catch (dmError) {
        // DM gönderilemezse şifreyi ephemeral mesaj olarak gönder
        await interaction.editReply({
          embeds: [
            InfoEmbed(
              "Root User Created",
              `Root user has been created successfully.\nUsername: \`${usernameHash}\`\nPassword: \`${password}\`\n\n⚠️ Could not send DM - displaying password here instead.`
            ),
          ],
        });
      }

      logger.info("Root user created successfully", {
        userId: userId,
        createdBy: interaction.user.id,
      });
    } catch (error: any) {
      logger.error("Error creating root user:", error);

      // Handle specific error types
      let errorMessage =
        "An unexpected error occurred while creating the root user.";

      if (error.code === "22003") {
        errorMessage =
          "Database error: Value out of range. The bitflags value exceeded database limits.";
      } else if (error.code === "23505") {
        errorMessage = "A root user already exists with the same username.";
      } else if (error.constraint) {
        errorMessage = `Database constraint violation: ${error.constraint}`;
      }

      await interaction.editReply({
        embeds: [ErrorEmbed("Error Creating Root User", errorMessage)],
      });
    }
  },
};

export = createRootUserCommand;
