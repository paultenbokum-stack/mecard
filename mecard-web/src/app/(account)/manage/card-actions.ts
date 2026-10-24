"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { cards } from "@/db/schema";
import { canManageCard, viewer, type Viewer } from "@/lib/access";
import { cardForDesign, saveClassicDesign, saveCustomDesign, submitDesign } from "@/lib/card-design";
import { canUseImage } from "@/lib/media-library";
import { requireUserId } from "@/lib/session";

export type DesignResult = { ok: true } | { ok: false; error: string };

async function editable(cardId: number): Promise<DesignResult & { v?: Viewer }> {
  const v = await viewer(await requireUserId("/manage/cards/"));
  if (!(await canManageCard(v, cardId))) return { ok: false, error: "You cannot edit this card." };
  const [c] = await db.select({ received: cards.designReceived }).from(cards).where(eq(cards.id, cardId)).limit(1);
  if (c?.received) return { ok: false, error: "This design has already been received and can no longer be changed." };
  return { ok: true, v };
}

/** The artwork must be the user's own (or what the card already has, or its profile's logo, the classic card default). */
async function artworkAllowed(v: Viewer, cardId: number, data: Record<string, unknown>) {
  const now = await cardForDesign(cardId);
  for (const key of ["frontPath", "backPath"] as const) {
    const next = typeof data[key] === "string" ? (data[key] as string) : null;
    const keep = key === "frontPath" ? now?.card.frontPath : now?.card.backPath;
    if (next && next === now?.defaults.logo) continue;
    if (!(await canUseImage(v, next, keep, "artwork"))) return false;
  }
  return true;
}

export async function saveDesignAction(cardId: number, kind: "custom" | "classic", data: Record<string, unknown>, submit: boolean): Promise<DesignResult> {
  const check = await editable(cardId);
  if (!check.ok) return check;
  if (!(await artworkAllowed(check.v!, cardId, data ?? {}))) return { ok: false, error: "Card designs must be PNG or JPG images from your own library. Choose the image again from My images." };
  if (kind === "custom") await saveCustomDesign(cardId, data ?? {});
  else await saveClassicDesign(cardId, data ?? {});
  if (submit) {
    if (kind === "custom" && (!data?.frontPath || !data?.backPath)) return { ok: false, error: "Upload both the front and the back design before submitting." };
    await submitDesign(cardId);
  }
  return { ok: true };
}
