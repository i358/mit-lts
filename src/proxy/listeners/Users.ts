import { Listener } from "./listener";
import { proxyLogger } from "../../logger";
import {
  HDirection,
  HEntity,
  HEntityType,
} from "gnode-api";
import { globalStore } from "../../utils";
import moment from "moment";
import { createUser } from "../../db_utilities";
import { toUTF8 } from "../../utils/buffer";
import { client } from "../../bot/run";
import { config } from "../../config";
import { TextChannel } from "discord.js";

let users: Map<number, object> = new Map();

export const UsersListener: Listener = {
  event: "Users",
  direction: HDirection.TOCLIENT,
  async exec(message) {
    const globalCache = globalStore.collection("globalCache");
    
    // Spotter'ın hedef odada olup olmadığını kontrol et
    const spotterInRoom = globalCache.get("spotterInRoom");
    
    if (!spotterInRoom) {
      proxyLogger.warn("Spotter hedef odada değil - Users eventi işlenmiyor");
      
      // Discord'a uyarı gönder
      try {
        const logsChannelId = config().app.DISCORD_BOT.CHANNELS.LOGS;
        const logsChannel = client.channels.cache.get(logsChannelId.toString());
        
        if (logsChannel && logsChannel.isTextBased()) {
          await (logsChannel as TextChannel).send("⚠️ **Spotter farklı odada** - Kullanıcı takibi durduruldu");
        }
      } catch (error) {
        proxyLogger.error("Error sending spotter warning to Discord:", error);
      }
      
      return; // Users eventini işleme
    }

    let packet = message.getPacket();
    let userEntity = HEntity.parse(packet);
    
    // Eğer user reload flag'i varsa, cache'i temizle ve tüm kullanıcıları yeniden yükle
    const shouldReloadUsers = globalCache.get("shouldReloadUsers");
    if (shouldReloadUsers) {
      proxyLogger.info("Reloading all users in room...");
      users.clear(); // Local cache'i temizle
      globalCache.set("shouldReloadUsers", false); // Flag'i kapat
    }
    
    let newUsers: Array<{ id: number, data: any }> = []; // Yeni eklenen kullanıcıları takip et
    
    for (let user of userEntity) {
      if (HEntityType.HABBO !== user.entityType) continue;
      if (users.has(user.id)) continue; // Zaten varsa atla
      
      const userData = {
        index: user.index,
        username: toUTF8(user.name),
        look: user.figureId,
        motto: toUTF8(user.motto),
        last_seen: moment().valueOf(),
      };
      
      users.set(user.id, userData);
      newUsers.push({ id: user.id, data: userData }); // Yeni kullanıcıyı kaydet
      
      proxyLogger.debug(`Added user to cache: ID=${user.id}, Index=${user.index}, Username=${toUTF8(user.name)}`);
    }

    // Users ve Stack collection'larını güncelle
    globalCache.set("users", users);
    
    // Stack collection'ını güncelle
    const stackCollection = globalStore.collection("stack");
    users.forEach((userData: any) => {
      stackCollection.set(userData.username.toLowerCase(), userData);
    });
    
    if (shouldReloadUsers) {
      proxyLogger.info(`Reloaded ${users.size} users after spotter re-entered room, ${newUsers.length} new users from Users packet.`);
    } else {
      proxyLogger.info(`Cached ${users.size} total users, ${newUsers.length} new users from Users packet.`);
    }
    
    // Stack durumunu logla
    proxyLogger.debug("Stack Collection Status:", {
      size: stackCollection.size,
      users: Array.from(stackCollection.keys())
    });

    // Cache'deki tüm index'leri logla
    const cachedIndexes = Array.from(users.values()).map((u: any) => u.index);
    proxyLogger.debug(`Current cached indexes: [${cachedIndexes.join(', ')}]`);

    // Sadece yeni kullanıcıları database'e ekle
    if (newUsers.length > 0) {
      let successCount = 0;
      for (const { id, data } of newUsers) {
      if(newUsers.length===1) {
          //@ts-ignore
           client.channels.cache.get(config().app.DISCORD_BOT.CHANNELS.EVENTS)?.send(`Şu eleman odaya girdi: ${data.username}`)
      }
        try {
          await createUser({
            data: {
              id,
              ...data,
            },
          });
        
          successCount++;
        } catch (err) {
          proxyLogger.error(`Error creating new user ${id} in database:`, err);
        }
      }
      
      proxyLogger.info(`Successfully added ${successCount}/${newUsers.length} new users to database`);
     
    } else {
      proxyLogger.debug('No new users to add to database');
    }
  },
};
