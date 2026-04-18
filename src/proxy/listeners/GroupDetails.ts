import { Listener } from "./listener";
import { proxyLogger } from "../../logger";
import { HDirection, HPacket } from "gnode-api";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { globalStore } from "../../utils";
import { toUTF8 } from "../../utils/buffer";

const badgesPath = join(__dirname, "../../../cache/badges.json");

export const BadgeGroupDetailsListener: Listener = {
  event: "HabboGroupDetails",
  direction: HDirection.TOCLIENT,
  async exec(message: { getPacket: () => HPacket }) {
    const globalCache = globalStore.collection("globalCache");
    const isBadgeListenMode = globalCache.get("badgeListenMode");

    if (!isBadgeListenMode) return;

    const packet = message.getPacket();
    let [groupId,,,groupName] = packet.read("ibiS");
    groupName = toUTF8(groupName);

    try {
      // Mevcut badges.json içeriğini oku
      let badges: { [key: string]: any } = {};
      try {
        const content = readFileSync(badgesPath, 'utf8');
        badges = JSON.parse(content);
      } catch {
        badges = {};
      }

      // Yeni grup bilgisini ekle
      if (!badges[groupName]) {
        badges[groupName] = {
          id: groupId,
          ranks: [],
          duration: 0
        };

        // JSON dosyasını güncelle
        writeFileSync(badgesPath, JSON.stringify(badges, null, 2));
        proxyLogger.info(`Yeni rozet grubu eklendi: ${groupName} (ID: ${groupId})`);
      }

    } catch (error) {
      proxyLogger.error("Rozet grubu kaydedilirken hata oluştu:", error);
    }
  },
};