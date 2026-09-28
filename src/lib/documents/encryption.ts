import "server-only";
import crypto from "node:crypto";
import { env } from "../env";

const ALGO = "aes-256-gcm";

function masterKey(): Buffer {
  const key = Buffer.from(env.DOCUMENT_MASTER_KEY, "base64");
  if (key.length !== 32) throw new Error("DOCUMENT_MASTER_KEY must decode to exactly 32 bytes.");
  return key;
}

export type EncryptedFile = { ciphertext: Buffer; encryptedDataKey: string; iv: string; authTag: string };

/**
 * Envelope encryption (spec §9): a fresh random AES-256 key encrypts this one file, then that
 * key itself is wrapped by the server's master key — so a stolen database row alone never
 * yields a usable key, only the master key (held outside the database) can unwrap it.
 */
export function encryptFile(plaintext: Buffer): EncryptedFile {
  const dataKey = crypto.randomBytes(32);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, dataKey, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const keyIv = crypto.randomBytes(12);
  const keyCipher = crypto.createCipheriv(ALGO, masterKey(), keyIv);
  const wrappedKey = Buffer.concat([keyCipher.update(dataKey), keyCipher.final()]);
  const keyAuthTag = keyCipher.getAuthTag();
  const encryptedDataKey = Buffer.concat([keyIv, keyAuthTag, wrappedKey]).toString("base64");

  return { ciphertext, encryptedDataKey, iv: iv.toString("base64"), authTag: authTag.toString("base64") };
}

export function decryptFile(ciphertext: Buffer, encryptedDataKey: string, iv: string, authTag: string): Buffer {
  const wrapped = Buffer.from(encryptedDataKey, "base64");
  const keyIv = wrapped.subarray(0, 12);
  const keyAuthTag = wrapped.subarray(12, 28);
  const wrappedKey = wrapped.subarray(28);
  const keyDecipher = crypto.createDecipheriv(ALGO, masterKey(), keyIv);
  keyDecipher.setAuthTag(keyAuthTag);
  const dataKey = Buffer.concat([keyDecipher.update(wrappedKey), keyDecipher.final()]);

  const decipher = crypto.createDecipheriv(ALGO, dataKey, Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(authTag, "base64"));
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

/** SHA-256 of the plaintext — proves a document wasn't altered (spec §9), important for evidence. */
export function sha256Hex(buf: Buffer): string {
  return crypto.createHash("sha256").update(buf).digest("hex");
}
