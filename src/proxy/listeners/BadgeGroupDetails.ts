import { Listener } from "./listener";
import { proxyLogger } from "../../logger";
import { HDirection, HPacket } from "gnode-api";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { globalStore } from "../../utils";
import { toUTF8 } from "../../utils/buffer";

const CACHE_DIR = join(__dirname, "../../../cache");
const badgesPath = join(CACHE_DIR, "badges.json");

export const BadgeGroupDetailsListener: Listener = {
  event: "HabboGroupDetails",
  direction: HDirection.TOCLIENT,
  async exec(message: { getPacket: () => HPacket }) {
    const globalCache = globalStore.collection("globalCache");
    const isBadgeListenMode = globalCache.get("badgeListenMode");
    const isSalaryListenMode = globalCache.get("salaryListenMode");

    // Salary modunda ise çık
    if (isSalaryListenMode || !isBadgeListenMode) return;

    const packet = message.getPacket();
    let [groupId,,,groupName] = packet.read("ibiS");
    groupName = toUTF8(groupName);

    try {
      // badges.json dosyasını oku veya oluştur
      let badges: { [key: string]: any } = {};
      
      if (existsSync(badgesPath)) {
        try {
          const content = readFileSync(badgesPath, 'utf8');
          badges = JSON.parse(content);
        } catch (error) {
          proxyLogger.error("badges.json okuma hatası:", error);
          badges = {};
        }
      }

      // Yeni grup bilgisini ekle veya güncelle
      if (!badges[groupName] || badges[groupName].id !== groupId) {
        badges[groupName] = {
          id: groupId,
          ranks: [],
          duration: 0,
          lastUpdated: new Date().toISOString()
        };

        // JSON dosyasını güncelle
        writeFileSync(badgesPath, JSON.stringify(badges, null, 2));
        proxyLogger.info(`Rozet grubu güncellendi: ${groupName} (ID: ${groupId})`);
      }

    } catch (error) {
      proxyLogger.error("Rozet grubu işlenirken hata oluştu:", error);
    }
  },
};