import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * AES-256-GCM symmetric encryption for OAuth refresh tokens
 * (ADR-0017 §"Token Storage Security").
 *
 * Layout: IV(12) || ciphertext || authTag(16). Stored as bytea.
 * Key source: env GMAIL_ENC_KEY (base64-encoded 32 bytes).
 *
 * Optional AAD (additional authenticated data) binds the ciphertext to a
 * row identity (e.g. "lungnote_gmail_connections:<row_id>") so a stolen
 * ciphertext can't be replayed against a different row.
 */

const ALG = "aes-256-gcm";
const IV_LEN = 12; // GCM standard
const AUTH_TAG_LEN = 16;
const KEY_LEN = 32; // 256-bit

let cachedKey: Buffer | null = null;

function loadKey(): Buffer {
  if (cachedKey) return cachedKey;
  const raw = process.env.GMAIL_ENC_KEY;
  if (!raw) throw new Error("GMAIL_ENC_KEY missing");
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== KEY_LEN) {
    throw new Error(
      `GMAIL_ENC_KEY must decode to ${KEY_LEN} bytes (got ${buf.length})`,
    );
  }
  cachedKey = buf;
  return buf;
}

export function encryptToken(plaintext: string, aad?: string): Buffer {
  const key = loadKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALG, key, iv);
  if (aad) cipher.setAAD(Buffer.from(aad, "utf8"));
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, ct, tag]);
}

export function decryptToken(blob: Buffer, aad?: string): string {
  const key = loadKey();
  if (blob.length < IV_LEN + AUTH_TAG_LEN) {
    throw new Error("encrypted token blob too short");
  }
  const iv = blob.subarray(0, IV_LEN);
  const tag = blob.subarray(blob.length - AUTH_TAG_LEN);
  const ct = blob.subarray(IV_LEN, blob.length - AUTH_TAG_LEN);
  const decipher = createDecipheriv(ALG, key, iv);
  decipher.setAuthTag(tag);
  if (aad) decipher.setAAD(Buffer.from(aad, "utf8"));
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString("utf8");
}

/** Generate a 32-byte base64 key for GMAIL_ENC_KEY env. CLI helper. */
export function generateEncKey(): string {
  return randomBytes(KEY_LEN).toString("base64");
}
