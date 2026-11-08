import { createHmac, timingSafeEqual } from "node:crypto";

// Adding people to a team: reading a pasted list, and the secret part of the
// team's join link (/join/<company>/<token>/). An HMAC of the company id, so no
// extra column is needed and links can't be guessed.

export interface ListedPerson {
  firstName: string;
  lastName: string;
  jobTitle: string;
  email: string;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** One person per line: name, job title, email, separated by tabs or commas. A spreadsheet paste works as it is. */
export function parseTeamList(raw: string, max = 500): ListedPerson[] {
  const people: ListedPerson[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const parts = line.split(line.includes("\t") ? "\t" : ",").map((p) => p.trim());
    const name = parts[0] ?? "";
    if (!name || /^(first\s*)?name$/i.test(name)) continue;
    const emailAt = parts.findIndex((p, i) => i > 0 && EMAIL.test(p));
    const email = emailAt > 0 ? parts[emailAt] : "";
    const jobTitle = parts.slice(1).find((p) => p && p !== email) ?? "";
    const [first, ...rest] = name.split(/\s+/);
    people.push({ firstName: first.slice(0, 100), lastName: rest.join(" ").slice(0, 100), jobTitle: jobTitle.slice(0, 200), email: email.slice(0, 255) });
    if (people.length >= max) break;
  }
  return people;
}

const secret = () => process.env.AUTH_SECRET || "dev-secret";

export function joinToken(companyId: number): string {
  return createHmac("sha256", secret()).update(`team-join:${companyId}`).digest("base64url").slice(0, 32);
}

export function verifyJoinToken(companyId: number, token: string): boolean {
  const expected = Buffer.from(joinToken(companyId));
  const given = Buffer.from(token);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
