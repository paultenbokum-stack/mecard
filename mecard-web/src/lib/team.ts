import "server-only";
import { lookup } from "node:dns/promises";
import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { revalidatePath } from "next/cache";
import { and, asc, desc, eq, gt, isNull, ne, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { cards, companies, entitlements, events, profiles } from "@/db/schema";
import { imageDeps } from "./images/config";
import { storeUpload } from "./images/pipeline";
import { aiCompanyName } from "./ai-name";
import { createInvite } from "./invites";
import { createProfile, linkCard, refreshProfilePages } from "./manage";
import { recordUpload } from "./media-library";
import { isPrivateAddress, logoColours, normaliseSiteUrl, paletteFromLogo, parseCompanySite, stylesheets, type LogoCandidate, type SiteRead } from "./site-read";
import type { ListedPerson } from "./team-people-rules";

// The team flow's server side: reading a company's website, counting the places
// a team has paid for, and adding people to them.

const MAX_HTML = 2 * 1024 * 1024;
const MAX_CSS = 512 * 1024;
const MAX_IMAGE = 5 * 1024 * 1024;
/** Website reads per account per hour. Each one costs a few outbound requests. */
const READS_PER_HOUR = 10;

/**
 * Fetch a URL someone typed, refusing private addresses at every redirect so the
 * server can't be used to reach its own network. Returns null on any failure.
 */
async function safeFetch(rawUrl: string, maxBytes: number): Promise<{ body: Buffer; url: string; type: string } | null> {
  let url = rawUrl;
  for (let hop = 0; hop < 4; hop++) {
    const safe = normaliseSiteUrl(url);
    if (!safe) return null;
    const host = new URL(safe).hostname;
    try {
      const addresses = await lookup(host, { all: true });
      if (!addresses.length || addresses.some((a) => isPrivateAddress(a.address))) return null;
      const res = await fetch(safe, { redirect: "manual", signal: AbortSignal.timeout(8000), headers: { "User-Agent": "MeCard company setup (+https://mecard.co.za/)", Accept: "text/html,text/css,image/*;q=0.9,*/*;q=0.5" } });
      if (res.status >= 300 && res.status < 400) {
        const next = res.headers.get("location");
        if (!next) return null;
        url = new URL(next, safe).href;
        continue;
      }
      if (!res.ok || !res.body) return null;
      const chunks: Buffer[] = [];
      let size = 0;
      const reader = res.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > maxBytes) {
          await reader.cancel();
          break;
        }
        chunks.push(Buffer.from(value));
      }
      return { body: Buffer.concat(chunks), url: safe, type: res.headers.get("content-type") ?? "" };
    } catch {
      return null;
    }
  }
  return null;
}

export type FoundLogo = { path: string; light: boolean; source: LogoCandidate["source"] };
export type SiteReadResult = (Omit<SiteRead, "logos" | "nameHints"> & { website: string; logos: FoundLogo[] }) | { error: string };

const MAX_LOGOS = 3;

/** One logo candidate as a stored image. SVGs are drawn to PNG here, so nothing from the site runs in a browser. */
async function storeLogo(userId: number, c: LogoCandidate): Promise<(FoundLogo & { colour: string; bytes: number; type: string }) | null> {
  let body: Buffer;
  let svg = !!c.svg;
  if (c.svg) {
    body = Buffer.from(c.svg, "utf8");
  } else {
    const image = await safeFetch(c.url, MAX_IMAGE);
    if (!image || !/image|svg/i.test(image.type)) return null;
    body = image.body;
    svg = /svg/i.test(image.type) || /\.svg(\?|$)/i.test(c.url);
  }
  try {
    if (svg) body = await sharp(body, { density: 300 }).resize({ width: 800, height: 400, fit: "inside" }).png().toBuffer();
    const meta = await sharp(body).metadata();
    if ((meta.width ?? 0) < 48 && (meta.height ?? 0) < 48) return null;
    const { data, info } = await sharp(body).resize({ width: 48, height: 48, fit: "inside" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const { colour, light } = logoColours(data, info.channels);
    const path = await storeUpload(body, imageDeps(), { id: `${userId}-${randomBytes(6).toString("hex")}` });
    if (!path) return null;
    return { path, light, source: c.source, colour, bytes: body.length, type: svg ? "image/png" : `image/${meta.format ?? "png"}` };
  } catch {
    return null;
  }
}

/** Read a company's website for the setup step: name, contacts, logo choices and a palette for the profile. */
export async function readCompanySite(userId: number, rawUrl: string): Promise<SiteReadResult> {
  const url = normaliseSiteUrl(rawUrl);
  if (!url) return { error: "Enter a website address, like yourcompany.co.za." };
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(events)
    .where(and(eq(events.name, "team_site_read"), eq(events.userId, userId), gt(events.createdAt, sql`now() - interval '1 hour'`)));
  if (count >= READS_PER_HOUR) return { error: "That's a lot of tries for now. Enter your details yourself, or try again in an hour." };

  const page = await safeFetch(url, MAX_HTML);
  const html = page && /html/i.test(page.type) ? page.body.toString("utf8") : null;
  if (!page || !html) {
    await db.insert(events).values({ name: "team_site_read", userId, source: "team", meta: { ok: false } });
    return { error: "We couldn't read that website. Check the address, or enter your details yourself." };
  }

  const sheets = await Promise.all(stylesheets(html, page.url).map((u) => safeFetch(u, MAX_CSS)));
  const css = sheets.map((s) => (s && /css|text\/plain/i.test(s.type) ? s.body.toString("utf8") : "")).join("\n");
  const { nameHints, ...read } = parseCompanySite(html, page.url, css);

  // A name that matches nothing on the page is a guess: the AI picks one that's written there.
  let { name, nameFrom } = read;
  if (nameFrom === "title" || nameFrom === "none") {
    const ai = await aiCompanyName(page.url, nameHints);
    if (ai) {
      name = ai;
      nameFrom = "ai";
    }
  }

  const stored: Awaited<ReturnType<typeof storeLogo>>[] = [];
  for (const c of read.logos) {
    if (stored.length >= MAX_LOGOS) break;
    const s = await storeLogo(userId, c);
    if (s) stored.push(s);
  }
  const logos = stored.filter((s) => s !== null);
  // A white logo is made for a dark header. A darker version, when the site has one, shows on the profile.
  logos.sort((a, b) => Number(a.light) - Number(b.light));
  for (const s of logos) await recordUpload({ ownerId: userId, path: s.path, filename: "website-logo", mimeType: s.type, bytes: s.bytes });
  const palette = paletteFromLogo(read.palette, logos.find((s) => s.colour)?.colour ?? "");
  const colours = [...new Set([...read.colours, ...logos.map((s) => s.colour).filter(Boolean)])].slice(0, 8);

  await db.insert(events).values({
    name: "team_site_read",
    userId,
    source: "team",
    meta: {
      ok: true,
      name: !!name,
      name_from: nameFrom,
      logo: logos.length > 0,
      logo_source: logos[0]?.source ?? "none",
      logos: logos.length,
      palette_found: read.paletteFound,
      accent: !!palette.accentColour,
      fonts: !!(palette.headingFont || palette.bodyFont),
      colours: colours.length,
      phone: !!read.phone,
      address: !!read.address,
      about: !!read.description,
      socials: read.socials.length,
    },
  });
  return { ...read, name, nameFrom, palette, colours, website: page.url, logos: logos.map(({ path, light, source }) => ({ path, light, source })) };
}

export const teamCompanies = (userId: number) =>
  db.select({ id: companies.id, name: companies.name, logoPath: companies.logoPath, accentColour: companies.accentColour }).from(companies).where(eq(companies.ownerId, userId)).orderBy(desc(companies.id));


/** Cards bought and waiting for a person, and Pro upgrades bought and not used. Phone tags follow their card. */
async function freePlaces(ownerId: number) {
  const [[c], [p]] = await Promise.all([
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(cards)
      .where(and(eq(cards.ownerId, ownerId), isNull(cards.profileId), eq(cards.archived, false), ne(cards.type, "phonetag"), sql`${cards.orderId} is not null`)),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(entitlements)
      .where(and(eq(entitlements.ownerId, ownerId), eq(entitlements.type, "pro_upgrade"), eq(entitlements.status, "paid_unassigned"))),
  ]);
  return { cards: c.n, pro: p.n, places: Math.max(c.n, p.n) };
}
export { freePlaces as teamPlaces };

/** People already on the company's team. */
export const teamProfiles = (companyId: number) =>
  db
    .select({ id: profiles.id, firstName: profiles.firstName, lastName: profiles.lastName, jobTitle: profiles.jobTitle })
    .from(profiles)
    .where(and(eq(profiles.companyId, companyId), eq(profiles.archived, false)))
    .orderBy(asc(profiles.id));

/** Give a new person the next bought card (with its phone tag, if any), printing their name on a Classic. */
async function linkNextCards(profileId: number, ownerId: number, person: { name: string; jobTitle: string }) {
  for (const physical of [true, false]) {
    const [card] = await db
      .select({ id: cards.id, type: cards.type })
      .from(cards)
      .where(and(eq(cards.ownerId, ownerId), isNull(cards.profileId), eq(cards.archived, false), physical ? ne(cards.type, "phonetag") : eq(cards.type, "phonetag"), sql`${cards.orderId} is not null`))
      .orderBy(asc(cards.id))
      .limit(1);
    if (!card) continue;
    await linkCard(card.id, profileId);
    if (card.type === "classiccard") await db.update(cards).set({ nameOnCard: person.name, jobTitleOnCard: person.jobTitle, updatedAt: new Date() }).where(eq(cards.id, card.id));
  }
}

/** Add one person to a team: their profile (Pro if an upgrade is already paid for) and the next bought card. */
async function addTeamPerson(ownerId: number, companyId: number, person: ListedPerson): Promise<number> {
  const profileId = await createProfile({ id: ownerId, isAdmin: false }, { firstName: person.firstName, lastName: person.lastName, email: person.email, jobTitle: person.jobTitle, companyId });
  if (person.mobile) await db.update(profiles).set({ mobile: person.mobile }).where(eq(profiles.id, profileId));
  await linkNextCards(profileId, ownerId, { name: `${person.firstName} ${person.lastName}`.trim(), jobTitle: person.jobTitle });
  await refreshProfilePages(profileId);
  return profileId;
}

export async function addTeamList(ownerId: number, companyId: number, people: ListedPerson[], invite: boolean, invitedBy: number) {
  for (const person of people) {
    const profileId = await addTeamPerson(ownerId, companyId, person);
    if (invite && person.email) await createInvite(profileId, person.email, invitedBy).catch((e) => console.error("[team] invite", e));
  }
  const withEmail = people.filter((p) => p.email).length;
  await db.insert(events).values({ name: "team_people_added", userId: invitedBy, companyId, source: "team", meta: { count: people.length, with_email: withEmail, with_mobile: people.filter((p) => p.mobile).length } });
  if (invite && withEmail) await db.insert(events).values({ name: "team_invite_sent", userId: invitedBy, companyId, source: "team", meta: { count: withEmail } });
  await noteIfComplete(ownerId, companyId);
}

/** Once every bought place has a person, record it: how long orders wait for names is a funnel measure. */
export async function noteIfComplete(ownerId: number, companyId: number) {
  const { places } = await freePlaces(ownerId);
  if (places === 0) await db.insert(events).values({ name: "team_names_completed", userId: ownerId, companyId, source: "team" });
}

export type LeaverChoice =
  | { kind: "deactivate" }
  | { kind: "reassign"; toProfileId: number }
  | { kind: "reassign"; person: { firstName: string; lastName: string; jobTitle: string } };

/**
 * "Has left": the profile is archived, and its cards are deactivated or
 * reassigned. Most cards are printed with the person's name, so deactivating is
 * the usual choice. A deactivated card's link stops working; staff can restore it.
 */
export async function archiveLeaver(ownerId: number, profileId: number, choice: LeaverChoice) {
  const [old] = await db.select({ companyId: profiles.companyId }).from(profiles).where(eq(profiles.id, profileId)).limit(1);
  if (!old) return;
  const linked = await db.select({ id: cards.id, slug: cards.slug }).from(cards).where(and(eq(cards.profileId, profileId), eq(cards.archived, false)));
  if (choice.kind === "deactivate") {
    for (const c of linked) {
      await db.update(cards).set({ archived: true, updatedAt: new Date() }).where(eq(cards.id, c.id));
      revalidatePath(`/t/${c.slug}/`);
    }
  } else {
    const target = "toProfileId" in choice ? choice.toProfileId : await createProfile({ id: ownerId, isAdmin: false }, { ...choice.person, companyId: old.companyId });
    for (const c of linked) await linkCard(c.id, target);
    await refreshProfilePages(target);
  }
  await db.update(profiles).set({ archived: true, updatedAt: new Date() }).where(eq(profiles.id, profileId));
  await refreshProfilePages(profileId);
  await db.insert(events).values({ name: "card_reassigned", userId: ownerId, profileId, companyId: old.companyId, source: "team", meta: { outcome: choice.kind, cards: linked.length } });
}
