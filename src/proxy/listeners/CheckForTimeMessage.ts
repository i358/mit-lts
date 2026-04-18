
import { Listener } from "./listener";
import { proxyLogger } from "../../logger";
import { HDirection, HPacket } from "gnode-api";
import { globalStore } from "../../utils";

export const WhisperListener: Listener = {
  event: "Whisper",
  direction: HDirection.TOCLIENT,
  async exec(message) {
    
const globalCache = globalStore.collection("globalCache");
   let packet = message.getPacket();
  // message format: habbo_id:time_in_ms
   let [,msg] = packet.read("iS");
    let [habboId, time] = msg.split(":");
    if (habboId && time) {
      globalCache.set("time:" + habboId, {
        habboId: parseInt(habboId),
        time: parseInt(time),
      });

      // gelen süre verisi globalcache iiçinde habboTime olarak kaydedilir. 
      // buradaki veriyi api route'u üzerinden talep eden kullanıcıya gönderebilisiniz.
     proxyLogger.info(`Received time data for habboId ${habboId}: ${time} ms`);
    }
  },
};
