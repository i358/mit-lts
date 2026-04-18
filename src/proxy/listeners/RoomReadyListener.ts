import { Listener } from './listener';
import { proxyLogger } from '../../logger';
import { HDirection } from 'gnode-api';
import { globalStore } from '../../utils';
import { config } from '../../config';
import { client } from '../../bot/run';
import { TextChannel } from 'discord.js';
import * as dbUtils from '../../db_utilities';

export const RoomReadyListener: Listener = {
    event: "RoomReady",
    direction: HDirection.TOCLIENT,
    
    async exec(message) {
        let packet = message.getPacket();
    
        let roomData = packet.read("Si"); 
        let currentRoomId = parseInt(roomData[1]);
        
        // Config'den main room ID'yi al
        const mainRoomId = config().app.MAIN_ROOM_ID;
        const globalCache = globalStore.collection("globalCache");
        
        // Önceki spotter durumunu al
        const previousSpotterInRoom = globalCache.get("spotterInRoom") || false;
        
        // Spotter'ın hedef odada olup olmadığını kontrol et
        const spotterInTargetRoom = currentRoomId === mainRoomId;
        
        // Eğer spotter hedef odadan çıktıysa database'i ve cache'i temizle
        if (previousSpotterInRoom && !spotterInTargetRoom) {
            try {
                proxyLogger.info("Spotter left target room, clearing database and cache...");
                
                // Database'i temizle
                await dbUtils.clearAllUsers();
                
                // Cache'i temizle
                const usersCache = globalStore.collection("users");
                usersCache.clear();
                
                proxyLogger.info("Database and cache cleared successfully after spotter left room");
            } catch (error) {
                proxyLogger.error("Failed to clear database and cache after spotter left room:", error);
            }
        }
        
        // Global cache'e spotter durumunu kaydet
        globalCache.set("spotterInRoom", spotterInTargetRoom);
        
        // Eğer spotter hedef odaya giriyorsa, odadaki mevcut kullanıcıları yüklemek için flag set et
        if (!previousSpotterInRoom && spotterInTargetRoom) {
            proxyLogger.info("Spotter entered target room, preparing to reload users...");
            globalCache.set("shouldReloadUsers", true);
        }
        
        proxyLogger.info(`Room changed - Current: ${currentRoomId}, Target: ${mainRoomId}, Spotter in target room: ${spotterInTargetRoom}`);
        
        try {
            // Discord'a bilgilendirme gönder
            const logsChannelId = config().app.DISCORD_BOT.CHANNELS.LOGS;
            const logsChannel = client.channels.cache.get(logsChannelId.toString());
            
            if (logsChannel && logsChannel.isTextBased()) {
                if (spotterInTargetRoom) {
                    if (!previousSpotterInRoom) {
                        await (logsChannel as TextChannel).send(`✅ **Spotter hedef odaya girdi - Kullanıcılar yeniden yüklenecek** - Room ID: ${currentRoomId}`);
                    } else {
                        await (logsChannel as TextChannel).send(`✅ **Spotter hedef odaya girdi** - Room ID: ${currentRoomId}`);
                    }
                } else {
                    if (previousSpotterInRoom) {
                        await (logsChannel as TextChannel).send(`🧹 **Spotter hedef odadan çıktı - Database ve Cache temizlendi** - Room ID: ${currentRoomId} (Hedef: ${mainRoomId})`);
                    } else {
                        await (logsChannel as TextChannel).send(`⚠️ **Spotter farklı odaya geçti** - Room ID: ${currentRoomId} (Hedef: ${mainRoomId})`);
                    }
                }
            }
        } catch (error) {
            proxyLogger.error("Error sending room change notification to Discord:", error);
        }
    }
}
