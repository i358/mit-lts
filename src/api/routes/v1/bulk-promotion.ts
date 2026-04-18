//@ts-nocheck
import { FastifyInstance, FastifyRequest } from "fastify";
import { apiLogger as logger, LogLevel } from "../../../logger";
import {
  getUserRow,
  getCodename,
  createArchiveRow,
  updateUserRow,
  createUserRow,
  createBulkPromotionArchiveRow,
  getBulkPromotionArchive,
  getBulkPromotionArchiveByDateRange,
  getBulkPromotionArchiveByPromoter,
  getUser,
  getBulkPromotionSchedule,
  setBulkPromotionScheduleSlot,
  unclaimBulkPromotionScheduleSlot,
  getWordleWeekStart,
  getHighRankChatMessages,
  insertHighRankChatMessage,
} from "../../../db_utilities/postgres";
import { createWsToken } from "../../ws/wsTokenStore";
import { getBanInfo } from "../../../db_utilities/ban";
import { bitflagsManager } from "../../../utils/bitflagsManager";
import { globalStore } from "../../../utils/globalStore";
import { getBadgeDetails } from "../../../db_utilities/badge_util";
import base64url from "base64url";
import { authenticateRequest } from '../../utils/authMiddleware';
import { Crypter } from "../../utils/crypter";
import crypto from "crypto";
import { config } from "../../../config";
import * as fs from "fs";
import * as path from "path";
import { Snowflake } from "../../../api/utils/snowflake";
import axios from "axios";

logger.setLogLevel(LogLevel.DEBUG);

// Badge cache'ini yükle
function loadBadgeCache() {
  try {
    const badgePath = path.join(__dirname, "../../../cache/badges.json");
    const badgeData = fs.readFileSync(badgePath, "utf-8");
    return JSON.parse(badgeData);
  } catch (error) {
    logger.error("Failed to load badge cache:", error);
    return {};
  }
}

const BADGES = loadBadgeCache();

async function authenticateAndGetUser(request: FastifyRequest) {
  try {
    logger.debug('authenticateAndGetUser called');
    
    const authResult = await authenticateRequest(request as any);
    if (!authResult?.user) {
      logger.error('No user in auth result');
      throw new Error("Unauthorized");
    }
    
    const user = authResult.user;
    logger.debug('User authenticated:', {
      username: user.username,
      badge: user.badge,
      bitflags: user.bitflags
    });

    // GIVE_MULTIBADGES izni kontrolü - Eş Sahip ve üzeri için
    const hasPermission = bitflagsManager.hasPermission(user.bitflags, "GIVE_MULTIBADGES");
    logger.debug('GIVE_MULTIBADGES permission check:', {
      bitflags: user.bitflags,
      hasPermission
    });
    
    if (!hasPermission) {
      logger.error('Permission denied for GIVE_MULTIBADGES');
      throw new Error(
        "Bu işlemi gerçekleştiren kullanıcı yeterli izinlere sahip değil (GIVE_MULTIBADGES gerekli)"
      );
    }

    return user;
  } catch (error) {
    logger.error('authenticateAndGetUser error:', error);
    throw error;
  }
}

function getIstihbaratBadgeIndex(): number {
  const badgeNames = Object.keys(BADGES);
  const idx = badgeNames.indexOf("İstihbarat");
  return idx === -1 ? 0 : idx + 1;
}

function isAboveIstihbarat(badgeIndex: number): boolean {
  const istihbaratBadgeIndex = getIstihbaratBadgeIndex();
  if (!istihbaratBadgeIndex) return false;
  return badgeIndex > istihbaratBadgeIndex;
}

async function detectMitBadgeForUsername(username: string): Promise<{ success: 1; badge: number } | { success: 0; error?: string; hasHigherRank?: boolean }> {
  try {
    const { data: userData } = await axios.get(
      `https://habbo.com.tr/api/public/users?name=${encodeURIComponent(username)}`
    );
    const uid = userData?.uniqueId;
    if (!uid) {
      return { success: 0, error: "Habbo profil bilgisi alınamadı" };
    }

    const response = await axios.get(
      `https://habbo.com.tr/api/public/users/${encodeURIComponent(uid)}/groups`
    );
    const groupData = response.data;

    if (!Array.isArray(groupData) || groupData.length === 0) {
      return { success: 0, error: "Hedef kullanıcı hiçbir gruba dahil değil" };
    }

    const normalizeName = (value: string) => {
      return value
        .toLocaleLowerCase("tr-TR")
        .replace(/i̇/g, "i")
        .replace(/\[\s*m[iı]t\s*\]/gi, "mit")
        .replace(/ğ/g, "g")
        .replace(/ü/g, "u")
        .replace(/ş/g, "s")
        .replace(/ı/g, "i")
        .replace(/ö/g, "o")
        .replace(/ç/g, "c")
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
    };

    const diceCoefficient = (a: string, b: string) => {
      if (!a || !b) return 0;
      if (a === b) return 1;
      if (a.length < 2 || b.length < 2) return 0;

      const bigrams = new Map<string, number>();
      for (let i = 0; i < a.length - 1; i++) {
        const gram = a.substring(i, i + 2);
        bigrams.set(gram, (bigrams.get(gram) || 0) + 1);
      }

      let matches = 0;
      for (let i = 0; i < b.length - 1; i++) {
        const gram = b.substring(i, i + 2);
        const count = bigrams.get(gram) || 0;
        if (count > 0) {
          bigrams.set(gram, count - 1);
          matches++;
        }
      }

      return (2 * matches) / (a.length + b.length - 2);
    };

    const badgeKeys = Object.keys(BADGES || {});
    const normalizedBadgeKeys = badgeKeys.map((key) => ({
      key,
      normalized: normalizeName(key),
    }));

    const badgeOrder = new Map<string, number>();
    for (let i = 0; i < badgeKeys.length; i++) {
      badgeOrder.set(badgeKeys[i], i);
    }

    let currentBadge: { name: string; badgeLevel: number } | null = null;
    const added = new Set<string>();

    for (const group of groupData) {
      const originalName = group?.name;
      if (!originalName || typeof originalName !== "string") continue;

      const normalizedGroupName = normalizeName(originalName);
      if (!normalizedGroupName) continue;

      let best: { key: string; score: number } | null = null;
      for (const candidate of normalizedBadgeKeys) {
        const score =
          candidate.normalized.includes(normalizedGroupName) ||
          normalizedGroupName.includes(candidate.normalized)
            ? 1
            : diceCoefficient(
                normalizedGroupName.replace(/\s+/g, ""),
                candidate.normalized.replace(/\s+/g, "")
              );

        if (!best || score > best.score) {
          best = { key: candidate.key, score };
        }
      }

      if (!best || best.score < 0.6) continue;
      if (added.has(best.key)) continue;
      added.add(best.key);

      const orderIndex = badgeOrder.get(best.key);
      if (typeof orderIndex === "number") {
        if (!currentBadge || orderIndex > currentBadge.badgeLevel - 1) {
          currentBadge = { name: best.key, badgeLevel: orderIndex + 1 };
        }
      }
    }

    if (!currentBadge) {
      return { success: 0, error: "Kullanıcının MIT'e ait hiçbir rozeti yok." };
    }

    if (isAboveIstihbarat(currentBadge.badgeLevel)) {
      return { success: 0, hasHigherRank: true };
    }

    return { success: 1, badge: currentBadge.badgeLevel };
  } catch (error) {
    return {
      success: 0,
      error:
        "Kullanıcının profili gizli olduğu için rozet verileri alınamadı.",
    };
  }
}

export default async function bulkPromotionRoute(fastify: FastifyInstance) {
  // Badge ve rank listesini döndür endpoint'i
  fastify.get("/bulk-promotion/badges", async (request, reply) => {
    try {
      const badgeNames = Object.keys(BADGES);
      const badges = badgeNames.map((name, index) => ({
        index: index + 1, // 1-based
        name: name,
        ranks: BADGES[name].ranks || [],
        maxRank: (BADGES[name].ranks || []).length - 1,
      }));

      return reply.send({
        success: 1,
        data: badges,
      });
    } catch (error) {
      logger.error("Get badges error:", error);
      return reply.status(500).send({
        success: 0,
        error: "Internal server error",
      });
    }
  });

  // Haftalık toplu terfi takvimi - listele (eş sahip ve üstleri)
  fastify.get("/bulk-promotion/schedule", async (request, reply) => {
    try {
      const user = await authenticateAndGetUser(request);
      const query = request.query as { week?: string };
      const weekStart = query.week && /^\d{4}-\d{2}-\d{2}$/.test(query.week)
        ? query.week
        : getWordleWeekStart(new Date());
      const slots = await getBulkPromotionSchedule(weekStart);
      return reply.send({ success: 1, weekStart, slots });
    } catch (error: any) {
      if (error?.message === "Unauthorized" || error?.message?.includes("token")) {
        return reply.status(401).send({ success: 0, error: error.message });
      }
      if (error?.message?.includes("yeterli izin")) {
        return reply.status(403).send({ success: 0, error: error.message });
      }
      logger.error("Get bulk promotion schedule error:", error);
      return reply.status(500).send({ success: 0, error: "Internal server error" });
    }
  });

  // Haftalık takvim - slot için "Müsaitim" (claim)
  fastify.post("/bulk-promotion/schedule/claim", async (request, reply) => {
    try {
      const user = await authenticateAndGetUser(request);
      const body = request.body as { week?: string; day_of_week?: number; time_slot?: string };
      const week = body.week;
      const dayOfWeek = body.day_of_week;
      const timeSlot = body.time_slot;
      const validSlots = ["12:00", "15:00", "16:00", "18:00", "20:00", "22:00"];
      if (!week || !/^\d{4}-\d{2}-\d{2}$/.test(week) || typeof dayOfWeek !== "number" || dayOfWeek < 1 || dayOfWeek > 7 || !timeSlot || !validSlots.includes(timeSlot)) {
        return reply.status(400).send({ success: 0, error: "Geçersiz week, day_of_week veya time_slot" });
      }
      if ((timeSlot === "12:00" || timeSlot === "15:00") && dayOfWeek >= 1 && dayOfWeek <= 5) {
        return reply.status(400).send({ success: 0, error: "12:00 ve 15:00 sadece hafta sonu (Cumartesi, Pazar) için geçerlidir" });
      }
      if (timeSlot === "16:00" && (dayOfWeek === 6 || dayOfWeek === 7)) {
        return reply.status(400).send({ success: 0, error: "16:00 sadece hafta içi için geçerlidir" });
      }
      const userId = String(user.id);
      await setBulkPromotionScheduleSlot(week, dayOfWeek, timeSlot, userId);
      return reply.send({ success: 1 });
    } catch (error: any) {
      if (error?.message === "Unauthorized" || error?.message?.includes("token")) {
        return reply.status(401).send({ success: 0, error: error.message });
      }
      if (error?.message?.includes("yeterli izin")) {
        return reply.status(403).send({ success: 0, error: error.message });
      }
      logger.error("Claim bulk promotion schedule error:", error);
      return reply.status(500).send({ success: 0, error: "Internal server error" });
    }
  });

  // Haftalık takvim - atanmayı kaldır (unclaim)
  fastify.post("/bulk-promotion/schedule/unclaim", async (request, reply) => {
    try {
      const user = await authenticateAndGetUser(request);
      const body = request.body as { week?: string; day_of_week?: number; time_slot?: string };
      const week = body.week;
      const dayOfWeek = body.day_of_week;
      const timeSlot = body.time_slot;
      const validSlots = ["12:00", "15:00", "16:00", "18:00", "20:00", "22:00"];
      if (!week || !/^\d{4}-\d{2}-\d{2}$/.test(week) || typeof dayOfWeek !== "number" || dayOfWeek < 1 || dayOfWeek > 7 || !timeSlot || !validSlots.includes(timeSlot)) {
        return reply.status(400).send({ success: 0, error: "Geçersiz week, day_of_week veya time_slot" });
      }
      const userId = String(user.id);
      const removed = await unclaimBulkPromotionScheduleSlot(week, dayOfWeek, timeSlot, userId);
      return reply.send({ success: 1, removed: !!removed });
    } catch (error: any) {
      if (error?.message === "Unauthorized" || error?.message?.includes("token")) {
        return reply.status(401).send({ success: 0, error: error.message });
      }
      if (error?.message?.includes("yeterli izin")) {
        return reply.status(403).send({ success: 0, error: error.message });
      }
      logger.error("Unclaim bulk promotion schedule error:", error);
      return reply.status(500).send({ success: 0, error: "Internal server error" });
    }
  });

  // Yüksek rütbe sohbet - WebSocket için tek kullanımlık token (cookie HttpOnly olduğu için)
  fastify.get("/bulk-promotion/chat/ws-token", async (request, reply) => {
    try {
      const user = await authenticateAndGetUser(request);
      const token = createWsToken(String(user.id), user.username || '');
      return reply.send({ success: 1, token });
    } catch (error: any) {
      if (error?.message === "Unauthorized" || error?.message?.includes("token")) {
        return reply.status(401).send({ success: 0, error: error.message });
      }
      if (error?.message?.includes("yeterli izin")) {
        return reply.status(403).send({ success: 0, error: error.message });
      }
      logger.error("Get chat ws-token error:", error);
      return reply.status(500).send({ success: 0, error: "Internal server error" });
    }
  });

  // Yüksek rütbe sohbet - mesaj listesi (REST fallback / ilk yükleme için kullanılabilir)
  fastify.get("/bulk-promotion/chat/messages", async (request, reply) => {
    try {
      await authenticateAndGetUser(request);
      const query = request.query as { limit?: string; before_id?: string };
      const limit = Math.min(Math.max(parseInt(query.limit || "100", 10) || 100, 1), 200);
      const beforeId = query.before_id ? parseInt(query.before_id, 10) : undefined;
      if (beforeId !== undefined && (isNaN(beforeId) || beforeId < 1)) {
        return reply.status(400).send({ success: 0, error: "Invalid before_id" });
      }
      const messages = await getHighRankChatMessages(limit, beforeId);
      return reply.send({ success: 1, messages });
    } catch (error: any) {
      if (error?.message === "Unauthorized" || error?.message?.includes("token")) {
        return reply.status(401).send({ success: 0, error: error.message });
      }
      if (error?.message?.includes("yeterli izin")) {
        return reply.status(403).send({ success: 0, error: error.message });
      }
      logger.error("Get high rank chat messages error:", error);
      return reply.status(500).send({ success: 0, error: "Internal server error" });
    }
  });

  // Yüksek rütbe sohbet - yeni mesaj gönder
  fastify.post("/bulk-promotion/chat", async (request, reply) => {
    try {
      const user = await authenticateAndGetUser(request);
      const body = request.body as { message?: string };
      const message = body.message;
      if (typeof message !== "string") {
        return reply.status(400).send({ success: 0, error: "message gerekli" });
      }
      const created = await insertHighRankChatMessage(String(user.id), message);
      return reply.send({ success: 1, message: created });
    } catch (error: any) {
      if (error?.message === "Message cannot be empty" || error?.message === "Message too long") {
        return reply.status(400).send({ success: 0, error: error.message });
      }
      if (error?.message === "Unauthorized" || error?.message?.includes("token")) {
        return reply.status(401).send({ success: 0, error: error.message });
      }
      if (error?.message?.includes("yeterli izin")) {
        return reply.status(403).send({ success: 0, error: error.message });
      }
      logger.error("Post high rank chat error:", error);
      return reply.status(500).send({ success: 0, error: "Internal server error" });
    }
  });

  // Kullanıcı bilgisini database'den kontrol et endpoint'i
  fastify.post("/bulk-promotion/check-user", async (request, reply) => {
    try {
      await authenticateAndGetUser(request);

      const { username, hid } = request.body as { username?: string; hid?: number };
      if (!username && hid === undefined) {
        return reply.status(400).send({
          success: 0,
          error: "Username required",
        });
      }

      // Kullanıcıyı database'den bul
      let user = null as any;
      const habboId = hid !== undefined ? Number(hid) : NaN;
      if (Number.isInteger(habboId) && habboId > 0) {
        user = await getUserRow({
          in: "habbo_id",
          value: habboId,
          out: "all",
        });
      }
      if (!user && username) {
        user = await getUserRow({
          in: "username",
          value: username,
          out: "all",
        });
      }

      if (!user) {
        // Veritabanında yok - dropdown seçtir
        return reply.send({
          success: 1,
          found: false,
          message: "Kullanıcı veritabanında bulunamadı",
        });
      }

      if (isAboveIstihbarat(user.badge)) {
        return reply.send({
          success: 1,
          found: true,
          eligible: false,
          message:
            "Bu kullanıcı İstihbarat üstü rozete sahip olduğu için toplu terfiye eklenemez",
        });
      }

      // Kullanıcı var - badge ve rank bilgisini döndür
      const { badgeName, rankName } = getBadgeDetails(user.badge, user.rank);

      return reply.send({
        success: 1,
        found: true,
        eligible: true,
        data: {
          username: user.username,
          avatar: `https://www.habbo.com.tr/habbo-imaging/avatarimage?user=${encodeURIComponent(
            user.username
          )}&direction=2&head_direction=2&gesture=nrm&size=l`,
          badge: badgeName,
          badgeIndex: user.badge,
          rank: rankName,
          rankIndex: user.rank,
        },
      });
    } catch (error) {
      logger.error("Check user error:", error);
      const err: any = error;

      if (err?.banned) {
        return reply.status(403).send({
          success: 0,
          banned: true,
          ban_info: err.ban_info,
          error: err.message || "Bu hesap yasaklanmış",
        });
      }

      if (
        err?.message === "Unauthorized" ||
        err?.message === "Invalid token" ||
        err?.message === "Invalid token signature"
      ) {
        return reply.status(401).send({
          success: 0,
          error: err.message,
        });
      }

      if (
        err?.message ===
        "Bu işlemi gerçekleştiren kullanıcı yeterli izinlere sahip değil"
      ) {
        return reply.status(403).send({
          success: 0,
          error: err.message,
        });
      }

      return reply.status(500).send({
        success: 0,
        error: "Internal server error",
      });
    }
  });
  fastify.post("/bulk-promotion/search", async (request, reply) => {
    try {
      // Token doğrulaması
      const promoter = await authenticateAndGetUser(request);

      // Yetki kontrolü - GIVE_MULTIBADGES gerekiyor (toplu terfi)
      if (
        !bitflagsManager.hasPermission(promoter.bitflags, "GIVE_MULTIBADGES")
      ) {
        return reply.status(403).send({
          success: 0,
          error:
            "Bu işlemi gerçekleştiren kullanıcı yeterli izinlere sahip değil (GIVE_MULTIBADGES gerekli)",
        });
      }

      // Global store'dan aktif odayı ve oradaki kullanıcıları al
      const { searchQuery } = request.body as { searchQuery?: string };

      if (!searchQuery || searchQuery.trim().length === 0) {
        return reply.send({
          success: 1,
          data: [],
        });
      }

      // Global cache'den kullanıcı haritasını al
      const globalCache = globalStore.collection("globalCache");
      const usersMap = globalCache.get("users") as Map<number, any>;

      if (!usersMap || !(usersMap instanceof Map) || usersMap.size === 0) {
        return reply.send({
          success: 1,
          data: [],
        });
      }

      // Arama sorgusuna göre filtreleme (username içinde arama yaparken case-insensitive)
      const searchLower = searchQuery.toLowerCase();
      const results = Array.from(usersMap.entries())
        .filter(
          ([_, user]) =>
            user.username && user.username.toLowerCase().includes(searchLower)
        )
        .slice(0, 10) // En fazla 10 sonuç döndür
        .map(([index, user]) => ({
          id: user.id,
          habbo_id: index,
          username: user.username,
          look: user.look,
          nextBadge: user.badge_id || 0,
          nextRank: user.rank || 0,
        }));

      return reply.send({
        success: 1,
        data: results,
      });
    } catch (error) {
      logger.error("Bulk promotion search error:", error);
      return reply.status(500).send({
        success: 0,
        error: "Internal server error",
      });
    }
  });

  fastify.post("/bulk-promotion/badge-check", async (request, reply) => {
    try {
      await authenticateAndGetUser(request);

      const { hid } = request.body as { hid?: number };
      const habboId = Number(hid);
      if (!habboId || !Number.isInteger(habboId)) {
        return reply.status(400).send({
          success: 0,
          error: "Habbo ID is required",
        });
      }

      const stackUser = await getUser({
        in: "id",
        value: habboId,
        out: "all",
      });

      if (!stackUser) {
        return reply.status(404).send({
          success: 0,
          error: "Hedef kullanıcı odada bulunamadı",
        });
      }

      const detect = await detectMitBadgeForUsername(stackUser.username);
      if (detect.success === 1) {
        return reply.send({
          success: 1,
          user: {
            username: stackUser.username,
            badge: detect.badge,
          },
        });
      }

      if ((detect as any).hasHigherRank) {
        return reply.send({
          success: 0,
          hasHigherRank: true,
        });
      }

      return reply.send({
        success: 0,
        error: (detect as any).error || "Kullanıcının MIT rozeti tespit edilemedi",
      });
    } catch (error) {
      logger.error("Bulk promotion badge check error:", error);
      return reply.status(500).send({
        success: 0,
        error: "Internal server error",
      });
    }
  });

  // Toplu terfi işlemi endpoint'i
  fastify.post("/bulk-promotion/promote", async (request, reply) => {
    try {
      const user = await authenticateAndGetUser(request);

      const promoterCode = await getCodename({
        in: "id",
        value: user.id,
        out: "all",
      });
      if (!promoterCode) {
        return reply
          .status(400)
          .send({
            success: 0,
            error: "Terfi verebilmek için önce bir kod ayarlamanız gerekiyor",
          });
      }

      const { users } = request.body as {
        users?: Array<{
          username: string;
          multiplier: number;
          badge?: number;
          rank?: number;
        }>;
      };

      if (!users || !Array.isArray(users) || users.length === 0) {
        return reply
          .status(400)
          .send({ success: 0, error: "En az bir kullanıcı gerekli" });
      }

      const promotedUsersForArchive = [];
      const processedUsers: Array<{
        username: string;
        oldBadge: string;
        oldRank: string;
        newBadge: string;
        newRank: string;
        badgeSkipped?: boolean;
        error?: string;
        action?: "promoted" | "registered" | "skipped";
      }> = [];
      const badgeNames = Object.keys(BADGES);
      const istihbaratIndex = badgeNames.indexOf("İstihbarat");
      const istihbaratBadgeIndex = istihbaratIndex === -1 ? 0 : istihbaratIndex + 1;

      for (const userRequest of users) {
        try {
          let targetUser = await getUserRow({
            in: "username",
            value: userRequest.username.toLowerCase(),
            out: "all",
          });

          let stackUser = await getUser({
            in: "username",
            value: userRequest.username.toLowerCase(),
            out: "all",
          });

          if (!targetUser && stackUser?.id) {
            targetUser = await getUserRow({
              in: "habbo_id",
              value: stackUser.id,
              out: "all",
            });
          }

          if (!stackUser) {
            processedUsers.push({
              username: userRequest.username,
              oldBadge: "-",
              oldRank: "-",
              newBadge: "-",
              newRank: "-",
              error: "Hedef kullanıcı odada bulunamadı",
              action: "skipped",
            });
            continue;
          }

          if (!targetUser) {
            const requestedRank = typeof userRequest.rank === "number" ? Number(userRequest.rank) : NaN;
            if (!Number.isInteger(requestedRank) || requestedRank <= 0) {
              processedUsers.push({
                username: userRequest.username,
                oldBadge: "Kayıtsız",
                oldRank: "-",
                newBadge: "-",
                newRank: "-",
                error: "Kayıtsız kullanıcı için rütbe seçimi gerekli",
                action: "skipped",
              });
              continue;
            }

            const detect = await detectMitBadgeForUsername(stackUser.username);
            if (detect.success !== 1) {
              processedUsers.push({
                username: userRequest.username,
                oldBadge: "Kayıtsız",
                oldRank: "-",
                newBadge: "-",
                newRank: "-",
                error: detect.hasHigherRank
                  ? "İstihbarat üzeri kullanıcılar toplu terfiye eklenemez"
                  : detect.error || "Kullanıcının MIT rozeti tespit edilemedi",
                action: "skipped",
              });
              continue;
            }

            const detectedBadgeIndex = detect.badge;
            if (
              istihbaratBadgeIndex &&
              typeof detectedBadgeIndex === "number" &&
              detectedBadgeIndex > istihbaratBadgeIndex
            ) {
              processedUsers.push({
                username: userRequest.username,
                oldBadge: "Kayıtsız",
                oldRank: "-",
                newBadge: "-",
                newRank: "-",
                error: "İstihbarat üzeri kullanıcılar toplu terfiye eklenemez",
                action: "skipped",
              });
              continue;
            }

            const sf = new Snowflake();
            const uid_ = await sf.createUUID({ encoding: "none" });
            const calculatedBitflags = bitflagsManager.calculateBitflags(
              detectedBadgeIndex,
              0
            );

            const newUserId = await createUserRow({
              id: uid_,
              habbo_id: stackUser.id,
              username: userRequest.username,
              secret: "0",
              avatar: `https://www.habbo.com.tr/habbo-imaging/avatarimage?user=${encodeURIComponent(
                userRequest.username
              )}&direction=2&head_direction=2&gesture=nrm&size=l`,
              badge: detectedBadgeIndex,
              rank: requestedRank,
              bitflags: calculatedBitflags,
              salary: 0,
              user_flags: 0,
              ip_addr: "0.0.0.0",
              coins: 100,
            });

            if (!newUserId) {
              processedUsers.push({
                username: userRequest.username,
                oldBadge: "Kayıtsız",
                oldRank: "-",
                newBadge: "-",
                newRank: "-",
                error: "Kullanıcı oluşturulamadı",
                action: "skipped",
              });
              continue;
            }

            targetUser = await getUserRow({
              in: "id",
              value: newUserId,
              out: "all",
            });

            if (!targetUser) {
              processedUsers.push({
                username: userRequest.username,
                oldBadge: "Kayıtsız",
                oldRank: "-",
                newBadge: "-",
                newRank: "-",
                error: "Oluşturulan kullanıcı getirilemedi",
                action: "skipped",
              });
              continue;
            }

            // Kayıt yapıldıktan sonra seçilen multiplier kadar terfi uygula
            const oldBadgeIndex = detectedBadgeIndex;
            const oldRankIndex = requestedRank;
            const multiplier = userRequest.multiplier;
            let newBadgeIndex = oldBadgeIndex;
            let newRankIndex = oldRankIndex;

            for (let i = 0; i < multiplier; i++) {
              const currentBadgeName = badgeNames[newBadgeIndex - 1];
              const currentBadgeRanks = BADGES[currentBadgeName]?.ranks || [];
              const isLastRank = newRankIndex >= currentBadgeRanks.length;

              if (isLastRank) {
                if (newBadgeIndex < badgeNames.length) {
                  if (newBadgeIndex - 1 === istihbaratIndex) {
                    newBadgeIndex = newBadgeIndex + 1;
                    newRankIndex = 1;
                  } else {
                    newBadgeIndex++;
                    newRankIndex = 1;
                  }

                  // İstihbarat üstü rozete çıkıyorsa, o rozetin 1. rütbesinde sabitle ve daha ileri gitme
                  if (istihbaratBadgeIndex && newBadgeIndex > istihbaratBadgeIndex) {
                    newBadgeIndex = istihbaratBadgeIndex + 1;
                    newRankIndex = 1;
                    break;
                  }
                } else {
                  break;
                }
              } else {
                newRankIndex++;
              }
            }

            const oldBadgeName = badgeNames[oldBadgeIndex - 1] || "Bilinmeyen";
            const newBadgeName = badgeNames[newBadgeIndex - 1] || "Bilinmeyen";
            const oldRankName =
              oldRankIndex > 0
                ? BADGES[oldBadgeName]?.ranks?.[oldRankIndex - 1] || "Bilinmeyen"
                : "Bilinmeyen";
            const newRankName =
              newRankIndex > 0
                ? BADGES[newBadgeName]?.ranks?.[newRankIndex - 1] || "Bilinmeyen"
                : "Bilinmeyen";

            const badgeSkipped = newBadgeIndex > oldBadgeIndex + multiplier;

            // Kullanıcıyı yeni terfi sonucu ile güncelle
            const calculatedFlagsAfter = bitflagsManager.calculateBitflags(
              newBadgeIndex,
              targetUser.bitflags || calculatedBitflags
            );
            await updateUserRow(targetUser.id, {
              badge: newBadgeIndex,
              rank: newRankIndex,
              bitflags: calculatedFlagsAfter,
            });

            processedUsers.push({
              username: userRequest.username,
              oldBadge: oldBadgeName,
              oldRank: oldRankName,
              newBadge: newBadgeName,
              newRank: newRankName,
              badgeSkipped,
              action: "registered",
            });

            promotedUsersForArchive.push({
              username: userRequest.username,
              old_badge: oldBadgeIndex,
              old_rank: oldRankIndex,
              new_badge: newBadgeIndex,
              new_rank: newRankIndex,
              habbo_id: targetUser.habbo_id || 0,
            });

            continue;
          }

          if (istihbaratBadgeIndex && isAboveIstihbarat(targetUser.badge)) {
            logger.info(
              `Skipping user (badge above İstihbarat): ${userRequest.username}`
            );
            continue;
          }

          const oldBadgeIndex = targetUser.badge;
          const oldRankIndex = targetUser.rank;
          const multiplier = userRequest.multiplier;
          let newBadgeIndex = oldBadgeIndex;
          let newRankIndex = oldRankIndex;

          for (let i = 0; i < multiplier; i++) {
            const currentBadgeName = badgeNames[newBadgeIndex - 1];
            const currentBadgeRanks = BADGES[currentBadgeName]?.ranks || [];
            const isLastRank = newRankIndex >= currentBadgeRanks.length;

            if (isLastRank) {
              if (newBadgeIndex < badgeNames.length) {
                if (newBadgeIndex - 1 === istihbaratIndex) {
                  newBadgeIndex = newBadgeIndex + 1;
                  newRankIndex = 1;
                } else {
                  newBadgeIndex++;
                  newRankIndex = 1;
                }

                // İstihbarat üstü rozete çıkıyorsa, o rozetin 1. rütbesinde sabitle ve daha ileri gitme
                if (istihbaratBadgeIndex && newBadgeIndex > istihbaratBadgeIndex) {
                  newBadgeIndex = istihbaratBadgeIndex + 1;
                  newRankIndex = 1;
                  break;
                }
              } else {
                break;
              }
            } else {
              newRankIndex++;
            }
          }

          const oldBadgeName = badgeNames[oldBadgeIndex - 1];
          const newBadgeName = badgeNames[newBadgeIndex - 1];
          const oldRankName =
            oldRankIndex > 0
              ? BADGES[oldBadgeName]?.ranks?.[oldRankIndex - 1] || "Bilinmeyen"
              : "Bilinmeyen";
          const newRankName =
            newRankIndex > 0
              ? BADGES[newBadgeName]?.ranks?.[newRankIndex - 1] || "Bilinmeyen"
              : "Bilinmeyen";
          const badgeSkipped = newBadgeIndex > oldBadgeIndex + multiplier;

          processedUsers.push({
            username: userRequest.username,
            oldBadge: oldBadgeName,
            oldRank: oldRankName,
            newBadge: newBadgeName,
            newRank: newRankName,
            badgeSkipped,
            action: "promoted",
          });

          // Archive kaydı için hazırla - targetUser'ın id'si number mi string mi kontrol et
          const userId = targetUser.id;
          promotedUsersForArchive.push({
            username: userRequest.username,
            old_badge: oldBadgeIndex,
            old_rank: oldRankIndex,
            new_badge: newBadgeIndex,
            new_rank: newRankIndex,
            habbo_id: targetUser.habbo_id || 0,
          });

          // Users tablosunda güncelle
          if (userId) {
            try {
              const calculatedFlags = bitflagsManager.calculateBitflags(
                newBadgeIndex,
                targetUser.bitflags || 0
              );
              const updated = await updateUserRow(userId, {
                badge: newBadgeIndex,
                rank: newRankIndex,
                bitflags: calculatedFlags,
              });
              if (updated) {
                logger.info(
                  `Updated user ${userRequest.username}: badge ${oldBadgeIndex} → ${newBadgeIndex}, rank ${oldRankIndex} → ${newRankIndex}`
                );
              } else {
                logger.warn(
                  `Failed to update user ${
                    userRequest.username
                  } - no rows affected : ${userId}, ${JSON.stringify(
                    targetUser
                  )}`
                );
              }
            } catch (updateError) {
              logger.error(
                `Failed to update user ${userRequest.username}:`,
                updateError
              );
              // Continue anyway - archive should still record the promotion
            }
          }
        } catch (userError) {
          logger.error(`Error processing user ${userRequest.username}:`, {
            error:
              userError instanceof Error
                ? userError.message
                : String(userError),
            stack: userError instanceof Error ? userError.stack : undefined,
          });
        }
      }

      if (promotedUsersForArchive.length > 0) {
        try {
          await createBulkPromotionArchiveRow({
            promoter_id: user.id,
            promoter_codename: promoterCode.codename,
            promoter_username: user.username,
            promoted_users: promotedUsersForArchive,
            action_timestamp: Math.floor(Date.now() / 1000),
            action_date: new Date(),
            action_time: new Date().toTimeString().split(" ")[0],
          });
          logger.info(
            `Bulk promotion archive created with ${promotedUsersForArchive.length} users`
          );
        } catch (archiveError) {
          logger.error(
            "Failed to create bulk promotion archive:",
            archiveError
          );
        }
      }

      const system = globalStore.collection("system");
      const discordClient = system.get("discordClient") as any;
      const bulkLogChannelId = config().app.DISCORD_BOT?.CHANNELS?.MULTIBADGE_LOG;

      if (discordClient && bulkLogChannelId) {
        try {
          const channel = await discordClient.channels.fetch(bulkLogChannelId);

          if (!channel) {
            logger.warn("Discord channel fetch returned null", {
              channelId: bulkLogChannelId,
            });
          } else if (!channel.send || typeof channel.send !== "function") {
            logger.warn("Discord channel send method not available", {
              channelId: bulkLogChannelId,
              channelType: channel.type,
            });
          } else {
            const time = new Date().toLocaleTimeString("tr-TR");
            const multiplier = request.body?.users?.[0]?.multiplier || 1;

            const { createBulkPromotionImage } = await import(
              "../../../utils/promotionImage"
            );
            const imageBuffer = await createBulkPromotionImage({
              promoter: `${user.username} (${promoterCode.codename})`,
              timestamp: new Date().toLocaleString("tr-TR"),
              multiplier,
              total: processedUsers.length,
              users: processedUsers.slice(0, 5).map((u) => ({
                username: u.username,
                newRank: u.newRank,
                error: u.error,
                action: u.action,
              })),
            });

            const content = `# TOPLU TERFİ İŞLEMİ\n\n- **Terfi Görevlisi:** ${user.username} (${promoterCode.codename})\n- **Saat:** ${time}\n- **Toplam Kullanıcı:** ${processedUsers.length}\n- **Terfi Değeri:** ${multiplier}x\n\nDevamı için sitedeki arşive bakın.`;

            await channel.send({
              content,
              files: [
                {
                  attachment: imageBuffer,
                  name: "bulk-promotion.png",
                },
              ],
            });
            logger.info("Discord log sent successfully", {
              userCount: processedUsers.length,
              channelId: bulkLogChannelId,
            });
          }
        } catch (discordError: any) {
          logger.error("Discord log error:", {
            message: discordError?.message || "Unknown error",
            code: discordError?.code || "NO_CODE",
            stack: discordError?.stack,
            channelId: bulkLogChannelId,
            hasClient: !!discordClient,
            errorType: discordError?.constructor?.name,
          });
        }
      } else {
        if (!discordClient) {
          logger.warn("Discord client not available for logging");
        }
        if (!bulkLogChannelId) {
          logger.warn("Discord bulk log channel ID not configured");
        }
      }

      return reply.send({
        success: 1,
        message: "Toplu terfi işlemi başarıyla tamamlandı",
        processedUsers: processedUsers,
        codename: promoterCode.codename,
      });
    } catch (error) {
      logger.error("Bulk promotion error:", error);
      return reply
        .status(500)
        .send({ success: 0, error: "Internal server error" });
    }
  });

  // Toplu terfi arşivini getir
  fastify.get("/bulk-promotion/archive", async (request, reply) => {
    try {
      const { limit = 50, offset = 0, date, promoterId } = request.query as any;

      let archiveData;

      if (date) {
        // Belirli bir tarihte yapılan toplu terfiler
        const targetDate = new Date(date);
        const nextDate = new Date(targetDate);
        nextDate.setDate(nextDate.getDate() + 1);

        archiveData = await getBulkPromotionArchiveByDateRange(
          targetDate,
          nextDate
        );
      } else if (promoterId) {
        // Belirli bir promoter'ın toplu terfyleri
        archiveData = await getBulkPromotionArchiveByPromoter(
          parseInt(promoterId)
        );
      } else {
        // Tüm toplu terfiler (pagination ile)
        archiveData = await getBulkPromotionArchive(
          parseInt(limit),
          parseInt(offset)
        );
      }

      return reply.send({
        success: 1,
        data: archiveData,
        total: archiveData.length,
      });
    } catch (error) {
      logger.error("Get bulk promotion archive error:", error);
      return reply.status(500).send({
        success: 0,
        error: "Internal server error",
      });
    }
  });
}
