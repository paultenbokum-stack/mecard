import { createHmac, timingSafeEqual } from "node:crypto";

// The secret part of an invite link (/invite/<id>/<token>/): an HMAC of the
// invite and the address it went to, so links can't be guessed from the id and
// no extra column is needed. Re-inviting creates a new id, so old links die.

const secret = () => process.env.AUTH_SECRET || "dev-secret";

export function inviteToken(inviteId: number, email: string): string {
  return createHmac("sha256", secret()).update(`invite:${inviteId}:${email.toLowerCase()}`).digest("base64url").slice(0, 32);
}

export function verifyInviteToken(inviteId: number, email: string, token: string): boolean {
  const expected = Buffer.from(inviteToken(inviteId, email));
  const given = Buffer.from(token);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
