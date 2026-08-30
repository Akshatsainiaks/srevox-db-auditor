import crypto from "crypto";

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "srevox-default-secret-key-32-chars-long"; // Must be 32 bytes
const IV_LENGTH = 16; // For AES-CBC, IV is 16 bytes

export function encrypt(text: string): string {
  if (!text || text === "REMOVE") return text;
  // Pad or slice key to exactly 32 bytes to avoid key length errors
  const key = Buffer.concat([Buffer.from(ENCRYPTION_KEY)], 32);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

export function decrypt(text: string): string {
  if (!text) return "";
  try {
    // If text does not contain ":", it is stored in plain text. Return it directly.
    if (!text.includes(":")) {
      return text;
    }
    const textParts = text.split(":");
    const ivHex = textParts.shift();
    if (!ivHex) return text;
    const iv = Buffer.from(ivHex, "hex");
    const encryptedText = Buffer.from(textParts.join(":"), "hex");
    const key = Buffer.concat([Buffer.from(ENCRYPTION_KEY)], 32);
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (err) {
    console.error("Decryption failed:", err);
    return text;
  }
}
