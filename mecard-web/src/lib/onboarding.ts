import "server-only";
import { and, asc, eq, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { cards, events, profiles, users } from "@/db/schema";
import { sendEmail } from "./email";
import { cleanEmail, cleanPhone, cleanSocial, cleanText } from "./form-values";
import { createProfile, refreshProfilePages } from "./manage";
import { siteUrl } from "./site";

// First-time onboarding (Me\Onboarding\Module): a new account gets one free
// profile and is walked through basics → contact → preview → install, then
// lands on /manage/. The state lives on the profile (profiles.onboarding),
// with the same keys and string values WordPress used.

export const STEPS = ["basics", "contact", "preview", "install", "ready"] as const;
export type Step = (typeof STEPS)[number];

export type Onboarding = { stage?: string; started?: string; completed?: string; installDone?: string; installSkipped?: string };

/** get_account_state(): anonymous | first_time | onboarding | existing. */
export async function accountState(userId: number | null): Promise<"anonymous" | "first_time" | "onboarding" | "existing"> {
  if (!userId) return "anonymous";
  const own = await ownedProfiles(userId);
  if (own.length) {
    if (own.length > 1) return "existing";
    const o = own[0].onboarding as Onboarding;
    const stage = o.stage || (o.completed === "1" ? "ready" : o.started === "1" ? "basics" : "");
    if (o.completed === "1" && stage === "ready") return "existing";
    if ((STEPS as readonly string[]).includes(stage)) return "onboarding";
    return "existing";
  }
  // Team admins and card buyers without a profile of their own aren't first-timers.
  const [card] = await db.select({ id: cards.id }).from(cards).where(eq(cards.ownerId, userId)).limit(1);
  return card ? "existing" : "first_time";
}

function ownedProfiles(userId: number) {
  return db
    .select({ id: profiles.id, onboarding: profiles.onboarding })
    .from(profiles)
    .where(and(or(eq(profiles.ownerId, userId), eq(profiles.managerId, userId)), eq(profiles.archived, false)))
    .orderBy(asc(profiles.id))
    .limit(2);
}

/** ensure_current_user_profile(): the user's profile, created from their account the first time. */
export async function ensureOnboardingProfile(userId: number): Promise<number> {
  const [existing] = await ownedProfiles(userId);
  if (existing) return existing.id;
  const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const [first, ...rest] = (u.displayName || "").split(" ");
  const id = await createProfile(
    { id: userId, isAdmin: false },
    { firstName: u.firstName || first || u.username || "My", lastName: u.lastName || rest.join(" "), email: u.email, companyId: null },
  );
  await db
    .update(profiles)
    .set({ mobile: u.phone, onboarding: { stage: "basics", started: "1", completed: "0", installDone: "0", installSkipped: "0" } })
    .where(eq(profiles.id, id));
  return id;
}

const NEXT: Record<string, Step> = { basics: "contact", contact: "preview", preview: "install", install: "ready", ready: "ready" };
const STEP_EVENT: Record<string, string> = { basics: "profile_step1_saved", contact: "profile_step2_saved", preview: "look_confirmed", install: "onboarding_completed" };

/** ajax_save_step(): save a step's fields and move the profile on to the next stage. */
export async function saveOnboardingStep(userId: number, profileId: number, step: string, raw: Record<string, unknown>) {
  const [p] = await db.select().from(profiles).where(eq(profiles.id, profileId)).limit(1);
  if (!p || (p.ownerId !== userId && p.managerId !== userId)) throw new Error("Not allowed");
  const upload = (v: unknown) => (typeof v === "string" && v.startsWith("/wp-content/uploads/") ? v.slice(0, 500) : undefined);
  const set: Partial<typeof profiles.$inferInsert> = {};
  if (step === "basics") {
    set.firstName = cleanText(raw.firstName, 100);
    set.lastName = cleanText(raw.lastName, 100);
    set.email = cleanEmail(raw.email);
    set.mobile = cleanPhone(raw.mobile);
    if (upload(raw.photoPath)) set.photoPath = upload(raw.photoPath);
  } else if (step === "contact") {
    set.jobTitle = cleanText(raw.jobTitle, 200);
    set.companyName = cleanText(raw.companyName, 255);
    set.companyLogoPath = upload(raw.companyLogoPath) ?? (raw.companyLogoPath === "" ? null : p.companyLogoPath);
    const linkedin = cleanSocial("linkedin", raw.linkedin);
    set.socials = { ...p.socials, linkedin };
    if (!linkedin) delete set.socials.linkedin;
  }
  const o: Onboarding = { ...(p.onboarding as Onboarding), started: "1", stage: NEXT[step] ?? p.onboarding.stage };
  if (step === "install") {
    const skipped = raw.installStatus === "skipped";
    Object.assign(o, { installDone: skipped ? "0" : "1", installSkipped: skipped ? "1" : "0", completed: "1", stage: "ready" });
  }
  await db.update(profiles).set({ ...set, onboarding: o as Record<string, string>, updatedAt: new Date() }).where(eq(profiles.id, profileId));
  if (STEP_EVENT[step]) await db.insert(events).values({ name: STEP_EVENT[step], userId, profileId, source: "onboarding" });
  await refreshProfilePages(profileId);

  // first_profile_created fires once per user, when the profile is published.
  let firstProfile = false;
  if (step === "preview") {
    const [seen] = await db.select({ id: events.id }).from(events).where(and(eq(events.userId, userId), eq(events.name, "first_profile_created"))).limit(1);
    if (!seen) {
      await db.insert(events).values({ name: "first_profile_created", userId, profileId, source: "onboarding" });
      firstProfile = true;
    }
  }
  return { stage: o.stage as Step, firstProfile, done: step === "install" };
}

/** ajax_send_profile_link(): email the profile link to open on a phone (desktop install step). */
export async function sendProfileLink(userId: number, slug: string) {
  const [u] = await db.select({ email: users.email, name: users.displayName }).from(users).where(eq(users.id, userId)).limit(1);
  if (!u) return { ok: false as const };
  const url = siteUrl(`/mecard-profile/${slug}/`);
  return sendEmail({
    to: u.email,
    subject: "Your MeCard profile link",
    text: `Hi ${u.name || "there"},\n\nHere's your MeCard profile link:\n\n${url}\n\nOpen this on your phone, tap the Share button, then choose "Add to Home Screen" to add your MeCard launch button.\n\nThe MeCard Team`,
  });
}

/** Usernames like WordPress made them: the email's local part, made unique (mecarduser2 …). */
export async function freeUsername(email: string): Promise<string> {
  const base = email.split("@")[0].toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 50) || "mecarduser";
  const taken = await db
    .select({ u: users.username })
    .from(users)
    .where(sql`lower(${users.username}) = ${base} OR lower(${users.username}) ~ ${`^${base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[0-9]+$`}`);
  const used = new Set(taken.map((t) => (t.u ?? "").toLowerCase()));
  if (!used.has(base)) return base;
  for (let n = 2; ; n++) if (!used.has(`${base}${n}`)) return `${base}${n}`;
}
