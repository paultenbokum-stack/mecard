"use server";

import { and, eq, ne } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { cards } from "@/db/schema";
import { CARD_FLAGS, isCardFlag } from "@/lib/admin-cards";
import { shipOrderIfCardsShipped } from "@/lib/order-shipping";
import { slugify } from "@/lib/slug";
import { requireAdmin } from "@/lib/session";

// Card Processing (Toolset's backend-card-edit and edit-keyring-slug forms).

const str = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

/** Back to the list or card page the form came from, with its filters, and the outcome. */
function back(form: FormData, outcome: { saved?: string; error?: string }): never {
  const from = str(form, "back");
  const path = /^\/admin\/cards\/[\w/?=&%.+-]*$/.test(from) ? from : "/admin/cards/";
  const url = new URL(path, "http://x");
  url.searchParams.delete("saved");
  url.searchParams.delete("error");
  for (const [k, v] of Object.entries(outcome)) if (v) url.searchParams.set(k, v);
  redirect(`${url.pathname}${url.search}`);
}

/** One production flag, ticked or unticked on the list (the checkbox posts "on" when ticked). */
export async function setCardFlagAction(form: FormData) {
  const me = await requireAdmin();
  const id = Number(form.get("card_id"));
  const flag = str(form, "flag");
  if (!isCardFlag(flag)) back(form, { error: "Unknown step." });
  const on = form.get("value") === "on";
  const [c] = await db
    .update(cards)
    .set({ [flag]: on, updatedAt: new Date() })
    .where(eq(cards.id, id))
    .returning({ orderId: cards.orderId });
  const label = CARD_FLAGS.find(([k]) => k === flag)![1];
  const orderShipped = flag === "shipped" && on && (await shipOrderIfCardsShipped(c?.orderId ?? null, { by: me }));
  back(form, { saved: `Card ${id}: ${label.toLowerCase()} ${on ? "ticked" : "unticked"}.${orderShipped ? ` All its order's cards are shipped, so order #${c!.orderId} is now shipped.` : ""}` });
}

/** All the flags at once, from the card page. */
export async function saveCardFlagsAction(form: FormData) {
  const me = await requireAdmin();
  const id = Number(form.get("card_id"));
  const values = Object.fromEntries(CARD_FLAGS.map(([k]) => [k, form.get(k) === "on"]));
  const [c] = await db
    .update(cards)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(cards.id, id))
    .returning({ orderId: cards.orderId });
  const orderShipped = values.shipped && (await shipOrderIfCardsShipped(c?.orderId ?? null, { by: me }));
  back(form, { saved: `Production steps saved.${orderShipped ? ` Order #${c!.orderId} is now shipped.` : ""}` });
}

export async function saveCardLabelAction(form: FormData) {
  await requireAdmin();
  const id = Number(form.get("card_id"));
  await db
    .update(cards)
    .set({ label: str(form, "label").slice(0, 255), updatedAt: new Date() })
    .where(eq(cards.id, id));
  back(form, { saved: `Card ${id}: label saved.` });
}

/**
 * Key rings come with their code printed on them: staff type the code and it
 * becomes the card's address, /t/<code>/ (update_post_slug did this from the title).
 */
export async function setTagCodeAction(form: FormData) {
  await requireAdmin();
  const id = Number(form.get("card_id"));
  const code = str(form, "code");
  const slug = slugify(code, "");
  if (!slug) back(form, { error: "Please enter the code printed on the key ring." });
  const [c] = await db.select({ type: cards.type }).from(cards).where(eq(cards.id, id));
  if (c?.type !== "keyring") back(form, { error: "Only key rings take a printed code." });
  const [clash] = await db
    .select({ id: cards.id })
    .from(cards)
    .where(and(eq(cards.slug, slug), ne(cards.id, id)));
  if (clash) back(form, { error: `Code ${slug} is already used by card ${clash.id}.` });
  await db.update(cards).set({ slug, title: code, updatedAt: new Date() }).where(eq(cards.id, id));
  back(form, { saved: `Key ring ${id} is now /t/${slug}/.` });
}
