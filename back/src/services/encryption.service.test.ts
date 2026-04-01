import assert from "node:assert/strict";
import { randomBytes } from "crypto";
import encryptionService from "./encryption.service";

function withMasterKey(hexKey: string, fn: () => void): void {
  const previous = process.env.ENCRYPTION_MASTER_KEY;
  process.env.ENCRYPTION_MASTER_KEY = hexKey;
  try {
    fn();
  } finally {
    if (previous === undefined) {
      delete process.env.ENCRYPTION_MASTER_KEY;
    } else {
      process.env.ENCRYPTION_MASTER_KEY = previous;
    }
  }
}

function runEncryptionTests(): void {
  const validKey = randomBytes(32).toString("hex");

  // roundtrip
  withMasterKey(validKey, () => {
    const plain = "sk-test-1234";
    const encrypted = encryptionService.encrypt(plain);
    const decrypted = encryptionService.decrypt(encrypted);

    assert.notEqual(encrypted, plain, "encrypted value must differ from plain");
    assert.equal(decrypted, plain, "decrypted value must match original input");
  });

  // invalid master key
  assert.throws(
    () =>
      withMasterKey("invalid-key", () => {
        encryptionService.encrypt("test");
      }),
    /64-character hex string/,
    "must reject invalid master key format"
  );

  // corrupted payload
  withMasterKey(validKey, () => {
    const encrypted = encryptionService.encrypt("payload");
    const [iv, tag, cipher] = encrypted.split(":");
    const firstChar = tag[0] === "A" ? "B" : "A";
    const corruptedTag = `${firstChar}${tag.slice(1)}`;
    const corrupted = `${iv}:${corruptedTag}:${cipher}`;

    assert.throws(
      () => encryptionService.decrypt(corrupted),
      /authenticate data/i,
      "must reject corrupted encrypted payload"
    );
  });
}

runEncryptionTests();
console.log("encryption.service tests: ok");
