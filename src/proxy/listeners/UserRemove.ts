import { Listener } from "./listener";
import { proxyLogger } from "../../logger";
import { HDirection } from "gnode-api";
import { globalStore } from "../../utils";
import { deleteUser } from "../../db_utilities";
import { client } from "../../bot/run";
import { config } from "../../config";
import { TextChannel } from "discord.js";
import { updateUserWorkTime } from "../../db_utilities/work_time";

interface ActiveTimeData {
    userId: number;
    username: string;
    currentSession: number; // Bu session'da geçen süre (ms)
    totalTime: number; // Database'den gelen toplam süre
    enterTime: number;
    lastUpdated: number;
}

export const UserRemove: Listener = {
  event: "UserRemove",
  direction: HDirection.TOCLIENT,
  async exec(message) {
    const globalCache = globalStore.collection("globalCache");
    
    // Spotter'ın hedef odada olup olmadığını kontrol et
    const spotterInRoom = globalCache.get("spotterInRoom");
    
    if (!spotterInRoom) {
      proxyLogger.warn("Spotter hedef odada değil - UserRemove eventi işlenmiyor");
      
      // Discord'a uyarı gönder
      try {
        const logsChannelId = config().app.DISCORD_BOT.CHANNELS.LOGS;
        const logsChannel = client.channels.cache.get(logsChannelId.toString());
        
        if (logsChannel && logsChannel.isTextBased()) {
          await (logsChannel as TextChannel).send("⚠️ **Spotter farklı odada** - Kullanıcı çıkış takibi durduruldu");
        }
      } catch (error) {
        proxyLogger.error("Error sending spotter warning to Discord:", error);
      }
      
      return; // UserRemove eventini işleme
    }
    
    const cachedUsers = globalCache.get("users");
    
    if (!cachedUsers || !(cachedUsers instanceof Map)) {
      proxyLogger.warn("No users found in global cache");
      return;
    }
    
    const users: Map<number, any> = cachedUsers;

    let packet = message.getPacket();
    
    // Packet içeriğini debug et
    proxyLogger.debug(`UserRemove packet raw data:`, packet.toString());
    
    // Index'i oku - farklı yöntemler dene
    let index: number;
    try {
      // İlk önce String olarak dene
      let indexValue = packet.read("S")[0];
      proxyLogger.debug(`Index read as String: ${indexValue}`);
      
      // Number'a çevir
      index = typeof indexValue === 'number' ? indexValue : parseInt(indexValue);
      proxyLogger.debug(`UserRemove event: final index ${index} (type: ${typeof index})`);
      
      if (isNaN(index)) {
        proxyLogger.error('Invalid index value from UserRemove packet');
        return;
      }
    } catch (error) {
      proxyLogger.error('Error reading UserRemove packet:', error);
      return;
    }
    
    // Cache'deki tüm index'leri logla
    const cachedIndexes = Array.from(users.values()).map((u: any) => u.index);
    proxyLogger.debug(`Current cached indexes: [${cachedIndexes.join(', ')}]`);
    proxyLogger.debug(`Looking for index ${index} in cache of ${users.size} users`);

    // Global cache'de bu index'e sahip kullanıcıyı bul
    let userToRemove: { id: number; data: any } | null = null;
    
    for (const [userId, userData] of users) {
      if (userData.index === index) {
        userToRemove = { id: userId, data: userData };
        break;
      }
    }

    if (!userToRemove) {
      proxyLogger.warn(`User with index ${index} not found in cache`);
      proxyLogger.debug(`Available users in cache:`, Array.from(users.entries()).map(([id, data]) => 
        `ID: ${id}, Index: ${data.index}, Username: ${data.username}`
      ));
      return;
    }

    const { id: userId, data: userData } = userToRemove;
    proxyLogger.info(`Removing user: ${userData.username} (ID: ${userId}, Index: ${index})`);

    try {
      // Kullanıcının work time'ını kaydet
      const activeTimeData = globalStore.collection('activeTimeData');
      const userActiveTime = activeTimeData.get(userId.toString()) as ActiveTimeData;
      
      if (userActiveTime && typeof userActiveTime.currentSession === 'number') {
        const currentSession = userActiveTime.currentSession;
        if (currentSession > 0) {
          proxyLogger.info(`Saving work time for user ${userData.username}: ${Math.round(currentSession / 1000)}s`);
          try {
            await updateUserWorkTime(userId, currentSession);
          } catch (workTimeError) {
            proxyLogger.error(`Failed to save work time for user ${userData.username}:`, workTimeError);
          }
        }
        // Clear active time data
        activeTimeData.delete(userId.toString());
      }

      // Global cache'den kullanıcıyı çıkar
      users.delete(userId);
      globalCache.set("users", users);
      
      // Database'den kullanıcıyı sil
      const deletedCount = await deleteUser({
        by: 'index',
        value: index
      });

      if (deletedCount > 0) {
         //@ts-ignore
        client.channels.cache.get(config().app.DISCORD_BOT.CHANNELS.EVENTS)?.send(`Şu eleman odadan çıktı: ${userData.username}`);
          
        proxyLogger.info(`Successfully removed user ${userData.username} from cache and database`);
      } else {
        proxyLogger.warn(`User ${userData.username} removed from cache but not found in database`);
      }

    } catch (error) {
      proxyLogger.error(`Error removing user ${userData.username}:`, error);
      
      // Hata durumunda kullanıcıyı cache'e geri ekle
      users.set(userId, userData);
      globalCache.set("users", users);
    }
  },
};
