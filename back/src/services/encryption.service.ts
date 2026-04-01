import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import envLoader from "./env-loader.service";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

class EncryptionService {
  private getMasterKey(): Buffer {
    const masterKeyHex = envLoader.getEnv("ENCRYPTION_MASTER_KEY");

    if (!masterKeyHex) {
      throw new Error("ENCRYPTION_MASTER_KEY is required");
    }

    if (!/^[0-9a-fA-F]{64}$/.test(masterKeyHex)) {
      throw new Error(
        "ENCRYPTION_MASTER_KEY must be a 64-character hex string"
      );
    }

    return Buffer.from(masterKeyHex, "hex");
  }

  encrypt(plain: string): string {
    const key = this.getMasterKey();
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);

    const encrypted = Buffer.concat([
      cipher.update(plain, "utf8"),
      cipher.final(),
    ]);

    const authTag = cipher.getAuthTag();
    return `${iv.toString("base64")}:${authTag.toString(
      "base64"
    )}:${encrypted.toString("base64")}`;
  }

  decrypt(payload: string): string {
    const key = this.getMasterKey();
    const parts = payload.split(":");

    if (parts.length !== 3) {
      throw new Error(
        "Invalid encrypted payload format. Expected iv:tag:ciphertext"
      );
    }

    const [ivBase64, authTagBase64, encryptedBase64] = parts;
    const iv = Buffer.from(ivBase64, "base64");
    const authTag = Buffer.from(authTagBase64, "base64");
    const encrypted = Buffer.from(encryptedBase64, "base64");

    if (iv.length !== IV_LENGTH) {
      throw new Error("Invalid IV length");
    }

    if (authTag.length !== AUTH_TAG_LENGTH) {
      throw new Error("Invalid auth tag length");
    }

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    return decrypted.toString("utf8");
  }
}

export default new EncryptionService();
