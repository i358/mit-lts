import { Listener } from "./listener";
import { proxyLogger } from "../../logger";
import { HDirection } from "gnode-api";
import { globalStore } from "../../utils";

export const UsersListener: Listener = {
  event: "Users",
  direction: HDirection.TOCLIENT,
  async exec(message) {
    try{
        const globalCache = globalStore.collection("globalCache");
    const listenForUserSet = globalCache.get("listenForUserSet") as {
      b?: boolean;
      s?: string;
    } | undefined;

    if (!listenForUserSet) {
      return;
    }

    const { b, s } = listenForUserSet;
    if (b) {
      let packet = message.getPacket();
      let size = packet.read("i")[0];
      if (size === 1) {
        let [userId, userName] = packet.read("iS");
        if(userName === s) {
        globalCache.emit("_SET", { i: 2 }, { i: userId });
        }
      }
    }
    } catch(error) {
      proxyLogger.error('Error in UsersListener:', error);
    }
  },
};
