import * as crypto from "crypto";
import base64url from "base64url";

export namespace Crypter {
  export class AES256CBC {
    async encrypt(payload: any, secret?: { iv: any; key: any }): Promise<Object> {
      const initVector: Buffer = secret?.iv || crypto.randomBytes(16);
      const Securitykey: Buffer = secret?.key || crypto.randomBytes(32);
      const cipher = crypto.createCipheriv("aes-256-cbc", Securitykey, initVector);
      let encryptedData: string = cipher.update(payload, "utf-8", "hex");
      encryptedData += cipher.final("hex");
      const ivHex = Buffer.from(initVector).toString("base64");
      const keyHex = Buffer.from(Securitykey).toString("base64");
      return {
        hash: encryptedData,
        secret: {
          iv: Buffer.from(ivHex).toString("hex"),
          key: Buffer.from(keyHex).toString("hex"),
        },
      };
    }
    async decrypt(
      encryptedPayload: any,
      secret: { iv: Buffer; key: Buffer } | any
    ): Promise<Object> {
      const encryptedData = Buffer.from(encryptedPayload, "hex");
        const iv = Buffer.from(secret.iv, "hex");
    const key = secret.key;
      
      if (key.length !== 32) {
        throw new Error(`Invalid key length: ${key.length}. Expected 32 bytes`);
      }
      if (iv.length !== 16) {
        throw new Error(`Invalid IV length: ${iv.length}. Expected 16 bytes`);
      }

      const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
      let decryptedData: Buffer = decipher.update(encryptedData);
      decryptedData = Buffer.concat([decryptedData, decipher.final()]);
      return decryptedData.toString("utf-8");
    }
  }
  export class HMAC {
    async create(
      payload: any,
      secret: any,
      config: { encoding: "hex" | "base64url" }
    ): Promise<any> {
      // Convert payload to string if it's an object
      const payloadString = typeof payload === "object" ? JSON.stringify(payload) : payload;
     

      const hmac = crypto.createHmac("sha256", secret);
      hmac.update(payloadString);
      
      let result;
      if (config.encoding === "base64url") {
        const base64 = hmac.digest("base64");
        result = base64url.fromBase64(base64);
      } else {
        result = hmac.digest(config.encoding);
      }

      
      return result;
    }
    async validate(
      hash: any,
      secret: any,
      validator: any,
      config: { encoding: "hex" | "base64url" }
    ): Promise<boolean> {
      // Create new HMAC with same parameters
      const expected = await this.create(validator, secret, config);
      return hash === expected;
    }
  }
  export class MD5 {
    async create(
      payload: any,
      config: { encoding: "none" | "base64url" }
    ): Promise<any> {
      let hash = crypto.createHash("md5");
      payload = typeof payload === "object" ? JSON.stringify(payload) : payload;
      hash.update(payload);
      let res = hash.digest("hex");
      res =
        config.encoding === "base64url"
          ? base64url.fromBase64(Buffer.from(res, "hex").toString("base64"))
          : res;
      return res;
    }
  }
}
