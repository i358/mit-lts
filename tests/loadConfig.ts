import { config } from "../src/config";
import { LogLevel, systemLogger } from "../src/logger";

let conf = config();
systemLogger.setLogLevel(LogLevel.DEBUG)
systemLogger.debug("Configuration loaded", conf);