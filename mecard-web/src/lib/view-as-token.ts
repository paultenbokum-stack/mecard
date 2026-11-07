import { createHmac, timingSafeEqual } from "node:crypto";

// The view-as cookie's value: which staff member is viewing which customer, until
// when. Signed so it can't be edited to skip the log entry or outlive its hour.

export interface ViewAsToken {
  actorId: number;
  targetId: number;
  expiresAt: number; // seconds since 1970
}

const sign = (body: string, secret: string) => createHmac("sha256", secret).update(body).digest("base64url");

export function signViewAsToken(t: ViewAsToken, secret: string): string {
  if (!secret) throw new Error("AUTH_SECRET is not set");
  const body = `${t.actorId}.${t.targetId}.${t.expiresAt}`;
  return `${body}.${sign(body, secret)}`;
}

export function readViewAsToken(raw: string, secret: string, nowSeconds = Math.floor(Date.now() / 1000)): ViewAsToken | null {
  if (!secret) return null;
  const parts = raw.split(".");
  if (parts.length !== 4) return null;
  const [actor, target, expires, signature] = parts;
  const expected = Buffer.from(sign(`${actor}.${target}.${expires}`, secret));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  const token = { actorId: Number(actor), targetId: Number(target), expiresAt: Number(expires) };
  if (!token.actorId || !token.targetId || !(token.expiresAt > nowSeconds)) return null;
  return token;
}
