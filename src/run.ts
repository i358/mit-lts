import { config } from "./config";
import { LogLevel, systemLogger } from "./logger";
import { configChecker, globalStore } from "./utils";
import { initializeDatabases } from "./db_utilities";
import * as dotenv from "dotenv"; 
import * as path from "path";
  
dotenv.config({path: path.join(__dirname, '.env')});

// Global error handlers
process.on('uncaughtException', (error) => {
    systemLogger.error('Uncaught Exception:', error);
    // Hata stacktrace'ini logla
    if (error.stack) {
        systemLogger.error('Stack trace:', error.stack);
    }
});

process.on('unhandledRejection', (reason, promise) => {
    systemLogger.error('Unhandled Rejection at:', promise);
    systemLogger.error('Reason:', reason);
});

// Uygulama çıkış sinyalleri
process.on('SIGTERM', () => {
    systemLogger.info('SIGTERM signal received. Graceful shutdown starting...');
    gracefulShutdown();
});

process.on('SIGINT', () => {
    systemLogger.info('SIGINT signal received. Graceful shutdown starting...');
    gracefulShutdown();
});

// Graceful shutdown fonksiyonu
async function gracefulShutdown() {
    systemLogger.info('Starting graceful shutdown...');
    try {
        // Aktif bağlantıları ve işlemleri temizle
        // Database bağlantılarını kapat vs.
        systemLogger.info('Cleanup completed. Exiting...');
        process.exit(0);
    } catch (error) {
        systemLogger.error('Error during shutdown:', error);
        process.exit(1);
    }
}

systemLogger.setLogLevel(LogLevel.DEBUG);
systemLogger.info("Application starting... Config and modules loading..");

// Initialize databases first
async function initializeApp() {
  try {
    // * Database bağlantılarını başlat
    systemLogger.info("Initializing database connections...");
    await initializeDatabases();
    systemLogger.info("Database connections initialized successfully");
    
    const globalConfig = globalStore.collection("config");
    // * Servis değişkenlerini global store'a yükle
    globalConfig.set("proxy", config().proxy);
    globalConfig.set("api", config().api);
    globalConfig.set("app", config().app);

    // * Path değişkenlerini global store'a yükle.
    globalConfig.set("paths", config().paths);
    
    // Start services after database initialization
    await startServices();
    systemLogger.info("Application initialization completed successfully");
    
  } catch (error) {
    systemLogger.error("Error during application initialization:", error);
    systemLogger.warn("Application will continue running with available services");
    // Remove process.exit to keep the application running
  }
}

async function startServices() {
  let serviceStates = {
    proxy: false,
    api: false,
    discord: false
  };

  if (configChecker.checkService("proxy").active) {
    try {
      // * Proxy servisini başlat
      if (configChecker.isSystemReady()) {
        await import(path.join(__dirname, `${config().paths.PROXY_DIR}/index`));
        systemLogger.info("Proxy service started successfully");
        serviceStates.proxy = true;
      } else {
        systemLogger.warn(
          "System is not ready. Please initialize the system first (set username and enter target room)."
        );
        // Proxy servisini başlat ama kullanıcıdan gerekli bilgileri alacak
        await import(path.join(__dirname, `${config().paths.PROXY_DIR}/index`));
        serviceStates.proxy = true;
      }
    } catch (error) {
      systemLogger.error("Failed to start Proxy service:", error);
      // Continue running other services
    }
  } else {
    systemLogger.warn(
      "Proxy service is not active. Please check your configuration."
    );
  }

  if (configChecker.checkService("api").active) {
    try {
      // * API servisini başlat
      const module = await import(path.join(__dirname, `${config().paths.API_DIR}/index`));
      await module.start();
      systemLogger.info("API service started successfully");
      serviceStates.api = true;
    } catch (error) {
      systemLogger.error("Failed to start API service:", error);
      // Continue running other services
    }
  } else {
    systemLogger.warn(
      "API service is not active. Please check your configuration."
    );
  }

  if (configChecker.checkService("discord").active) {
    try {
      // * Discord bot servisini başlat
      if (process.env.TOKEN) {
        await import(path.join(__dirname, `${config().paths.BOT_DIR}/run`));
        serviceStates.discord = true;
      } else {
        systemLogger.warn(
          "Discord bot token is not set. Please check your configuration."
        );
      }
    } catch (error) {
      systemLogger.error("Failed to start Discord service:", error);
      // Continue running other services
    }
  } else {
    systemLogger.warn(
      "Discord service is not active. Please check your configuration."
    );
  }

  // Log final service states
  systemLogger.info("Service initialization complete. Service states:", serviceStates);
}

// Start the application
initializeApp();
