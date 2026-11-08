"use server";

import { eq } from "drizzle-orm";
import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { products } from "@/db/schema";
import { logAdmin } from "@/lib/admin-log";
import { rands, randsToCents } from "@/lib/money";
import { PRODUCT_PRICES_TAG } from "@/lib/product-prices";
import { sanitizeRichHtml } from "@/lib/rich-text";
import { requireAdmin } from "@/lib/session";

function back(path: string, outcome: { saved?: string; error?: string }): never {
  redirect(`${path}?${new URLSearchParams(outcome as Record<string, string>)}`);
}

/** A product's name, description, prices and whether it's shown. Quotes and orders keep the prices they already have. */
export async function saveProductAction(form: FormData) {
  const me = await requireAdmin();
  const id = Number(form.get("product_id"));
  const path = `/admin/products/${id}/`;
  const [p] = Number.isInteger(id) ? await db.select().from(products).where(eq(products.id, id)).limit(1) : [];
  if (!p) back("/admin/products/", { error: "Product not found." });

  const name = String(form.get("name") ?? "").trim().slice(0, 255);
  if (!name) back(path, { error: "Please enter the product's name." });
  const priceCents = randsToCents(String(form.get("price") ?? ""));
  if (priceCents === null || Number.isNaN(priceCents)) back(path, { error: "Please enter a valid price." });
  const was = randsToCents(String(form.get("was_price") ?? ""));
  if (Number.isNaN(was)) back(path, { error: "Please enter a valid sale price." });
  if (was !== null && was <= priceCents) back(path, { error: "The struck-through price must be higher than the price." });
  // Cleaned only when it changed, so saving a new price leaves the description exactly as it was.
  const typed = String(form.get("description") ?? "").replace(/\r\n/g, "\n");
  const description = typed === p.description.replace(/\r\n/g, "\n") ? p.description : sanitizeRichHtml(typed);
  const active = !!form.get("active");

  const changes = [
    name !== p.name ? `name "${p.name}" → "${name}"` : "",
    priceCents !== p.priceCents ? `price ${rands(p.priceCents)} → ${rands(priceCents)}` : "",
    was !== p.regularPriceCents ? `struck-through price ${p.regularPriceCents === null ? "none" : rands(p.regularPriceCents)} → ${was === null ? "none" : rands(was)}` : "",
    description !== p.description ? "description" : "",
    active !== p.active ? (active ? "shown in the shop" : "hidden from the shop") : "",
  ].filter(Boolean);
  if (!changes.length) back(path, { saved: "Nothing changed." });

  await db.update(products).set({ name, priceCents, regularPriceCents: was, description, active }).where(eq(products.id, id));
  await logAdmin(me, "product", id, "edited", changes.join(", "));
  updateTag(PRODUCT_PRICES_TAG);
  back(path, { saved: "Product saved." });
}
