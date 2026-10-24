import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { cards, companies, profiles } from "@/db/schema";
import { cleanColour, cleanText } from "./form-values";

// Designing a card before it is printed (Me\Single_Cards\Module and the
// team console's edit-card form):
//   custom card (contactcard): front and back artwork, 856 × 540 px, and the
//     QR code's position, size and colours on the back;
//   classic card (classiccard): logo, name and job title printed on a white card.
// The QR position is in CSS pixels on the 8.56 × 5.4 cm card back the team
// console used (wpcf-qr-x / -y / -width), which is what printing reads.
// Once the design is marked received it can no longer be changed.

export const CARD_BACK = { widthCm: 8.56, heightCm: 5.4 };
export const QR_DEFAULTS = { x: 120, y: 55, width: 90, code: "#000000", fill: "#ffffff" };
export const QR_MIN = 40;
export const QR_MAX = 190;

const artwork = (v: unknown) => (typeof v === "string" && v.startsWith("/wp-content/uploads/") ? v.slice(0, 500) : null);
const num = (v: unknown, min: number, max: number, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
};

export async function cardForDesign(cardId: number) {
  const [c] = await db.select().from(cards).where(eq(cards.id, cardId)).limit(1);
  if (!c) return null;
  const [p] = c.profileId
    ? await db
        .select({ firstName: profiles.firstName, lastName: profiles.lastName, jobTitle: profiles.jobTitle, logo: profiles.companyLogoPath, companyLogo: companies.logoPath })
        .from(profiles)
        .leftJoin(companies, eq(companies.id, profiles.companyId))
        .where(eq(profiles.id, c.profileId))
        .limit(1)
    : [];
  // bundle_classic_card_data(): the card's own values, else the profile's (company logo first).
  return {
    card: c,
    defaults: {
      name: p ? `${p.firstName} ${p.lastName}`.trim() : "",
      jobTitle: p?.jobTitle ?? "",
      logo: p?.companyLogo ?? p?.logo ?? null,
    },
  };
}

export async function saveCustomDesign(cardId: number, raw: Record<string, unknown>) {
  await db
    .update(cards)
    .set({
      frontPath: artwork(raw.frontPath),
      backPath: artwork(raw.backPath),
      qrX: String(num(raw.qrX, 0, 330, QR_DEFAULTS.x)),
      qrY: String(num(raw.qrY, 0, 210, QR_DEFAULTS.y)),
      qrWidth: String(num(raw.qrWidth, QR_MIN, QR_MAX, QR_DEFAULTS.width)),
      qrCodeColour: cleanColour(raw.qrCodeColour) || QR_DEFAULTS.code,
      qrFillColour: cleanColour(raw.qrFillColour) || QR_DEFAULTS.fill,
      updatedAt: new Date(),
    })
    .where(eq(cards.id, cardId));
}

export async function saveClassicDesign(cardId: number, raw: Record<string, unknown>) {
  await db
    .update(cards)
    .set({ frontPath: artwork(raw.frontPath), nameOnCard: cleanText(raw.nameOnCard, 255), jobTitleOnCard: cleanText(raw.jobTitleOnCard, 255), updatedAt: new Date() })
    .where(eq(cards.id, cardId));
}

/** ajax_submit_design(): ready for MeCard to check and print. */
export async function submitDesign(cardId: number) {
  await db.update(cards).set({ designSubmitted: true, updatedAt: new Date() }).where(eq(cards.id, cardId));
}
