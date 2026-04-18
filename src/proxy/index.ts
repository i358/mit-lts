import moment from "moment";
import { LogLevel, proxyLogger } from "../logger";
import { Extension, HDirection, HMessage, HPacket } from "gnode-api";
import {
  configChecker,
  GlobalCollection,
  globalStore,
  GlobalStore,
} from "../utils";
import { listenerLoader } from "./listeners/listenerLoader";
import * as dbUtils from "../db_utilities";

proxyLogger.setLogLevel(LogLevel.DEBUG);
const globalCache = globalStore.collection("globalCache");

  proxyLogger.info("Proxy module initializing...");
  export const ext = new Extension({
    name: "Habbo MIT",
    description: "Habbo MIT Proxy Module",
    version: "1.0.0",
    author: "i358",
  });
  
  ext.run();
  ext.on('end', async () => {
    proxyLogger.info("Connection ended, cleaning up...");
    
    try {
      // Database ve cache'i temizle
      await dbUtils.clearAllUsers();
      
      // Cache'i temizle
      const usersCache = globalStore.collection("users");
      usersCache.clear();
      
      // Timer'ı durdur
      const { timerWorker } = await import("../workers/timer");
      await timerWorker.stop();
      
      proxyLogger.info("Cleanup completed successfully");
    } catch (error) {
      proxyLogger.error("Error during cleanup:", error);
    }
    
    proxyLogger.info("Connection to G-Earth ended");
  });

  // Listener'ları yükle ve kaydet
  ext.on("start", async () => {
    proxyLogger.info("Proxy module initialized and running.", {
      initDate: moment().format("LTS"),
    });

    // Script başladığında database'i ve cache'i temizle
    try {
      proxyLogger.info("Clearing database and cache on startup...");
      
      // Database'i temizle
      await dbUtils.clearAllUsers();
      
      // Cache'i temizle
      const usersCache = globalStore.collection("users");
      usersCache.clear();
       
      proxyLogger.info("Database and cache cleared successfully on startup");
      
    } catch (error) {
      proxyLogger.error("Failed to clear database and cache on startup", error);
    }

    // Listener'ları yükle
    try {
      proxyLogger.info("Loading event listeners...");
      const listeners = await listenerLoader.loadListeners();

      // Her listener için interceptor kaydet
      listeners.forEach((listener) => {
        proxyLogger.debug("Registering interceptor", {
          event: listener.event,
          direction: listener.direction,
        });
        ext.interceptByNameOrHash(
          listener.direction,
          listener.event,
          listener.exec
        );
      });

      proxyLogger.info("All listeners registered", {
        count: listeners.length,
        events: listeners.map((l) => l.event),
      });
    } catch (error) {
      proxyLogger.error("Failed to load listeners", error);
    }

    if (configChecker.isSystemReady()) {

    try {
      proxyLogger.info("Starting Timer Worker..."); 
      const { timerWorker } = await import("../workers/timer");
      await timerWorker.start(); 
<<<<<<< HEAD
      let pkg = new HPacket(`{out:GetGuestRoom}{i:12530483}{i:0}{i:1}`)
=======
      let pkg = new HPacket(`{out:GetGuestRoom}{i:12447139}{i:0}{i:1}`)
>>>>>>> cd4ec7b1066b3857accabc3a6118b333f2e44bf4
      let pkg2 = new HPacket(`{out:MoveAvatar}{i:4}{i:48}`)
    
     setTimeout(()=>{
        ext.sendToServer(pkg);
      setTimeout(()=>{
         ext.sendToServer(pkg2);
      }, 2000)
     }, 2000)
      proxyLogger.info("Timer Worker started successfully");
    } catch (error) {
      proxyLogger.error("Failed to start Timer Worker:", error);
    }

      proxyLogger.info("System is ready. Proxy module operational.");
      globalCache.set("ext", ext);
    } else { 
      proxyLogger.warn( 
        "System is not fully ready. Please type your username and press enter then get target room. Will config auto set after that. Then restart the script."
      );

      // Kullanıcıdan girdi al
      process.stdout.write("Username: ");
      process.stdin.once("data", (data) => {
        const username = data.toString().trim();
        proxyLogger.debug("Username setted, waiting for room ready event...", {
          username,
        });
        globalCache.set("listenForRoomReady", { b: true });
        globalCache.set("listenForUserSet", { b: true, s: username });
        let roomSetted: boolean,
          userSetted: boolean = false;
        globalCache.on("_SET", ({ i: eventId }, { i }) => {
          if (eventId === 1) {
            globalCache.set("listenForRoomReady", { b: false });
            configChecker.updateConfig("app.MAIN_ROOM_ID", i);
            roomSetted = true;
          }
          if (eventId === 2) {
            globalCache.set("listenForUserSet", { b: false });
            configChecker.updateConfig("app.SPOTTER.ID", i);
            userSetted = true;
          }

          if (roomSetted && userSetted) {
            configChecker.updateConfig("app.INITIALIZED", true);
            proxyLogger.info("Configuration updated successfully. Restart the script.", {
              MAIN_ROOM_ID: configChecker.getConfigValue("app.MAIN_ROOM_ID"),
              SPOTTER_ID: configChecker.getConfigValue("app.SPOTTER.ID"),
            });
            globalCache.off("_SET", ()=>{});
            process.exit(0);
                    }
        });
      });
    }
  });
