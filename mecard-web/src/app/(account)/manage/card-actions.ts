"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { cards } from "@/db/schema";
import { canManageCard, viewer } from "@/lib/access";
import { saveClassicDesign, saveCustomDesign, submitDesign } from "@/lib/card-design";
import { requireUserId } from "@/lib/session";

export type DesignResult = { ok: true } | { ok: false; error: string };

async function editable(cardId: number): Promise<DesignResult> {
  const v = await viewer(await requireUserId("/manage/cards/"));
  if (!(await canManageCard(v, cardId))) return { ok: false, error: "You cannot edit this card." };
  const [c] = await db.select({ received: cards.designReceived }).from(cards).where(eq(cards.id, cardId)).limit(1);
  if (c?.received) return { ok: false, error: "This design has already been received and can no longer be changed." };
  return { ok: true };
}

export async function saveDesignAction(cardId: number, kind: "custom" | "classic", data: Record<string, unknown>, submit: boolean): Promise<DesignResult> {
  const check = await editable(cardId);
  if (!check.ok) return check;
  if (kind === "custom") await saveCustomDesign(cardId, data ?? {});
  else await saveClassicDesign(cardId, data ?? {});
  if (submit) {
    if (kind === "custom" && (!data?.frontPath || !data?.backPath)) return { ok: false, error: "Upload both the front and the back design before submitting." };
    await submitDesign(cardId);
  }
  return { ok: true };
}
