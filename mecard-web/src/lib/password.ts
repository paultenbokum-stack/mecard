import { createHash, createHmac } from "node:crypto";
import bcrypt from "bcryptjs";

// Verifies passwords imported from WordPress so nobody has to reset:
//   $wp$2y$…  WordPress 6.8+ (bcrypt of base64(HMAC-SHA384(password)))
//   $2y$…     plain bcrypt (plugins / older custom hashes)
//   $P$…/$H$… phpass portable hashes (WordPress before 6.8)
// New and upgraded hashes are plain bcrypt.

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

/** True when a stored hash should be replaced with plain bcrypt after login. */
export function needsRehash(hash: string): boolean {
  return !/^\$2[aby]\$/.test(hash);
}

export async function verifyPassword(password: string, hash: string | null): Promise<boolean> {
  if (!hash) return false;
  if (hash.startsWith("$wp")) {
    const pre = createHmac("sha384", "wp-sha384").update(password).digest("base64");
    return bcrypt.compare(pre, normalizeBcrypt(hash.slice(3)));
  }
  if (/^\$2[aby]\$/.test(hash)) return bcrypt.compare(password, normalizeBcrypt(hash));
  if (hash.startsWith("$P$") || hash.startsWith("$H$")) return phpassCheck(password, hash);
  // Very old WordPress installs stored plain MD5.
  if (/^[a-f0-9]{32}$/i.test(hash)) return createHash("md5").update(password).digest("hex") === hash.toLowerCase();
  return false;
}

function normalizeBcrypt(h: string) {
  return h.replace(/^\$2y\$/, "$2a$");
}

const ITOA64 = "./0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

function encode64(input: Buffer, count: number): string {
  let output = "";
  let i = 0;
  do {
    let value = input[i++];
    output += ITOA64[value & 0x3f];
    if (i < count) value |= input[i] << 8;
    output += ITOA64[(value >> 6) & 0x3f];
    if (i++ >= count) break;
    if (i < count) value |= input[i] << 16;
    output += ITOA64[(value >> 12) & 0x3f];
    if (i++ >= count) break;
    output += ITOA64[(value >> 18) & 0x3f];
  } while (i < count);
  return output;
}

function phpassCheck(password: string, setting: string): boolean {
  const countLog2 = ITOA64.indexOf(setting[3]);
  if (countLog2 < 7 || countLog2 > 30) return false;
  let count = 1 << countLog2;
  const salt = setting.slice(4, 12);
  if (salt.length !== 8) return false;
  const pw = Buffer.from(password, "utf8");
  let hash = createHash("md5").update(Buffer.concat([Buffer.from(salt, "binary"), pw])).digest();
  do {
    hash = createHash("md5").update(Buffer.concat([hash, pw])).digest();
  } while (--count);
  const out = setting.slice(0, 12) + encode64(hash, 16);
  return out === setting;
}
