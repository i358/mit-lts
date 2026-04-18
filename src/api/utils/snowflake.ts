import base64url from "base64url";
import moment from "moment";
import { globalStore } from "../../utils";

export type SnowflakeID = string;

export class Snowflake {
  private readonly workerId: bigint;
  private readonly epoch: bigint;
  private sequence: bigint;
  private lastTimestamp: bigint;

  constructor(workerId = BigInt(1)) {
    // Epoch config.yaml'dan alınır
    type ApiConfig = { EPOCH?: number };
    const config = globalStore.collection("config");
    const apiConfig = config.get("api") as ApiConfig | undefined;
    const epochValue = apiConfig?.EPOCH ?? 1640995200000;
    this.workerId = workerId;
    this.epoch = BigInt(epochValue);
    this.sequence = BigInt(0);
    this.lastTimestamp = BigInt(-1);
  }

  createUUID(
    config: { encoding: "base64url" | "none" },
    timestamp: bigint = BigInt(moment().valueOf())
  ): Promise<SnowflakeID> {
    return new Promise((resolve, reject) => {
      if (timestamp < this.lastTimestamp) {
        return reject(new Error("Invalid system clock"));
      }
      if (timestamp === this.lastTimestamp) {
        this.sequence = (this.sequence + BigInt(1)) & BigInt(4095);
        if (this.sequence === BigInt(0)) {
          timestamp = this.waitNextMillis(timestamp);
        }
      } else {
        this.sequence = BigInt(0);
      }
      this.lastTimestamp = timestamp;
      const snowflake =
        ((timestamp - this.epoch) << BigInt(22)) |
        (this.workerId << BigInt(12)) |
        this.sequence;
      let res =
        config.encoding === "base64url"
          ? base64url.fromBase64(
              Buffer.from(snowflake.toString(), "utf-8").toString("base64")
            )
          : snowflake.toString();
      resolve(res);
    });
  }

  currentTimestamp(): bigint {
    return BigInt(moment.utc().valueOf());
  }

  waitNextMillis(timestamp: bigint): bigint {
    while (timestamp <= this.lastTimestamp || this.sequence >= BigInt(4096)) {
      timestamp = this.currentTimestamp();
    }
    return timestamp;
  }

  parseUUID(
    uid: SnowflakeID,
    config: { encoding: "base64url" | "none" }
  ): Promise<any> {
    return new Promise<any>((resolve, reject) => {
      if (!uid) return reject(new Error("Snowflake ID is missing."));
      uid =
        config.encoding === "base64url"
          ? Buffer.from(uid, "base64url").toString("utf-8")
          : uid;
      const snowflake = BigInt(uid);
      const timestamp = (snowflake >> BigInt(22)) + this.epoch;
      resolve(timestamp);
    });
  }
}
