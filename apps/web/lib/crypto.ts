import crypto from "crypto";

// Server-only: never import this in client components.
// ENCRYPTION_KEY must be a 32-byte hex string (64 hex chars), e.g. `openssl rand -hex 32`.
// Mirrored in apps/bot-server/src/crypto.ts — keep both in sync, same algorithm + key.

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex) throw new Error("ENCRYPTION_KEY env var is not set");
  const key = Buffer.from(hex, "hex");
  if (key.length !== 32) {
    throw new Error("ENCRYPTION_KEY must be a 32-byte hex string (64 hex chars)");
  }
  return key;
}

// Output format: "iv:tag:ciphertext" (all hex-encoded).
export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${ciphertext.toString("hex")}`;
}

export function decryptSecret(blob: string): string {
  const [ivHex, tagHex, ciphertextHex] = blob.split(":");
  if (!ivHex || !tagHex || !ciphertextHex) {
    throw new Error("Malformed encrypted blob");
  }
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const plain = Buffer.concat([
    decipher.update(Buffer.from(ciphertextHex, "hex")),
    decipher.final(),
  ]);
  return plain.toString("utf8");
}
