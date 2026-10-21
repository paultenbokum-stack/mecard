"use server";

import { eq, inArray, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { coupons, users } from "@/db/schema";
import { randsToCents } from "@/lib/money";
import { requireAdmin } from "@/lib/session";

// WooCommerce's coupon screen.

const str = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

function back(path: string, outcome: { saved?: string; error?: string }): never {
  redirect(`${path}?${new URLSearchParams(outcome as Record<string, string>)}`);
}

function optionalInt(v: string): number | null {
  if (!v) return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 ? n : NaN;
}

export async function saveCouponAction(form: FormData) {
  await requireAdmin();
  const id = Number(form.get("coupon_id")) || null;
  const path = id ? `/admin/coupons/${id}/` : "/admin/coupons/new/";
  const code = str(form, "code");
  const discountType = str(form, "discount_type") === "fixed_cart" ? "fixed_cart" : "percent";
  const amountRaw = str(form, "amount") || "0";
  const amount = discountType === "percent" ? Number(amountRaw) : randsToCents(amountRaw);
  const minSpendCents = randsToCents(str(form, "min_spend"));
  const usageLimit = optionalInt(str(form, "usage_limit"));
  const usageLimitPerUser = optionalInt(str(form, "usage_limit_per_user"));
  const expires = str(form, "expires");
  const productIds = form
    .getAll("product_ids")
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0);

  if (!/^[\w-]{2,50}$/.test(code)) back(path, { error: "Use 2–50 letters, numbers, dashes or underscores for the code." });
  if (discountType === "percent" && (!Number.isInteger(amount) || amount! < 0 || amount! > 100)) back(path, { error: "A percentage discount must be a whole number from 0 to 100." });
  if (amount === null || Number.isNaN(amount)) back(path, { error: "Please enter a valid discount amount." });
  if (Number.isNaN(minSpendCents)) back(path, { error: "Please enter a valid minimum spend." });
  if (Number.isNaN(usageLimit) || Number.isNaN(usageLimitPerUser)) back(path, { error: "Usage limits must be whole numbers." });
  if (expires && !/^\d{4}-\d{2}-\d{2}$/.test(expires)) back(path, { error: "Please enter a valid expiry date." });

  // Allowed customers, by email (WooCommerce's "Allowed emails"), stored as account IDs.
  const emails = [...new Set(str(form, "allowed_emails").toLowerCase().split(/[\s,;]+/).filter(Boolean))];
  const accounts = emails.length ? await db.select({ id: users.id, email: users.email }).from(users).where(inArray(sql`lower(${users.email})`, emails)) : [];
  const unknown = emails.filter((e) => !accounts.some((a) => a.email.toLowerCase() === e));
  if (unknown.length) back(path, { error: `No account for ${unknown.join(", ")}. Customers need an account to use a restricted coupon.` });

  const [clash] = await db
    .select({ id: coupons.id })
    .from(coupons)
    .where(sql`lower(${coupons.code}) = ${code.toLowerCase()}`);
  if (clash && clash.id !== id) back(path, { error: `There is already a coupon called ${code}.` });

  const values = {
    code,
    description: str(form, "description"),
    discountType,
    amount: amount!,
    freeShipping: form.get("free_shipping") === "on",
    minSpendCents,
    productIds,
    allowedUserIds: accounts.map((a) => a.id),
    usageLimit,
    usageLimitPerUser,
    // Valid to the end of the chosen day in South Africa (UTC+2).
    expiresAt: expires ? new Date(`${expires}T23:59:59.999+02:00`) : null,
    active: form.get("active") === "on",
  };
  if (id) {
    await db.update(coupons).set(values).where(eq(coupons.id, id));
    back(path, { saved: "Coupon saved." });
  }
  const [c] = await db.insert(coupons).values(values).returning({ id: coupons.id });
  back(`/admin/coupons/${c.id}/`, { saved: "Coupon created." });
}

export async function deleteCouponAction(form: FormData) {
  await requireAdmin();
  const [c] = await db
    .delete(coupons)
    .where(eq(coupons.id, Number(form.get("coupon_id"))))
    .returning({ code: coupons.code });
  // Orders keep their code and discount.
  back("/admin/coupons/", { saved: c ? `Deleted coupon ${c.code}.` : "Coupon deleted." });
}
