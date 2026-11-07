"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { logAdmin } from "@/lib/admin-log";
import { rands } from "@/lib/money";
import { ensureSalesCode, payCommissions, setOrderSalesperson } from "@/lib/sales";
import { bpsToPercent, percentToBps } from "@/lib/sales-rules";
import { requireAdmin } from "@/lib/session";

// Staff actions on salespeople and commission. Every action checks the admin again.

function back(path: string, outcome: { saved?: string; error?: string }): never {
  redirect(`${path}?${new URLSearchParams(outcome as Record<string, string>)}`);
}

/** Make someone a salesperson, set their rate, and say who referred this customer. */
export async function saveSalesAction(form: FormData) {
  const me = await requireAdmin();
  const id = Number(form.get("user_id"));
  const path = `/admin/users/${id}/`;
  const [u] = await db.select().from(users).where(eq(users.id, id));
  if (!u) back("/admin/users/", { error: "Account not found." });
  const isSales = !!form.get("is_sales");
  const rate = percentToBps(String(form.get("rate") ?? ""));
  if (rate === null) back(path, { error: "Please enter a commission rate from 0 to 100." });
  const referredBy = Number(form.get("referred_by")) || null;
  if (referredBy === id) back(path, { error: "A customer can't be referred by themselves." });
  if (referredBy && referredBy !== u.referredBy) {
    const [s] = await db.select({ isSales: users.isSales }).from(users).where(eq(users.id, referredBy)).limit(1);
    if (!s?.isSales) back(path, { error: "Choose a salesperson." });
  }
  // Set by staff the 12 months still run from the sign-up.
  const referredAt = referredBy ? (u.referredAt ?? u.createdAt) : null;
  const changes = [
    isSales !== u.isSales ? (isSales ? "made a salesperson" : "no longer a salesperson") : "",
    rate !== u.commissionRateBps ? `rate ${bpsToPercent(u.commissionRateBps)}% → ${bpsToPercent(rate)}%` : "",
    referredBy !== u.referredBy ? `referred by ${u.referredBy ?? "nobody"} → ${referredBy ?? "nobody"}` : "",
  ].filter(Boolean);
  if (!changes.length) back(path, { saved: "Nothing changed." });
  await db.update(users).set({ isSales, commissionRateBps: rate, referredBy, referredAt }).where(eq(users.id, id));
  if (isSales) await ensureSalesCode(id);
  await logAdmin(me, "user", id, "sales", changes.join(", "));
  back(path, { saved: "Sales details saved." });
}

/** Choose who earns on an order, or nobody. Stays chosen: nothing later replaces it. */
export async function setOrderSalespersonAction(form: FormData) {
  const me = await requireAdmin();
  const id = Number(form.get("order_id"));
  const path = `/admin/orders/${id}/`;
  const salesUserId = Number(form.get("sales_user_id")) || null;
  if (salesUserId) {
    const [s] = await db.select({ isSales: users.isSales }).from(users).where(eq(users.id, salesUserId)).limit(1);
    if (!s?.isSales) back(path, { error: "Choose a salesperson." });
  }
  const error = await setOrderSalesperson(id, salesUserId);
  if (error) back(path, { error });
  await logAdmin(me, "order", id, "salesperson set", String(salesUserId ?? "nobody"));
  back(path, { saved: "Salesperson saved." });
}

/** Pay out what's due to a salesperson. `through` is when the page was opened, so the total shown is the total paid. */
export async function payCommissionsAction(form: FormData) {
  const me = await requireAdmin();
  const id = Number(form.get("sales_user_id"));
  const month = String(form.get("month") ?? "");
  const path = `/admin/commissions/?month=${encodeURIComponent(month)}`;
  const go = (outcome: { saved?: string; error?: string }): never => redirect(`${path}&${new URLSearchParams(outcome as Record<string, string>)}`);
  const ref = String(form.get("ref") ?? "").trim().slice(0, 120);
  const through = new Date(String(form.get("through") ?? ""));
  if (!ref) go({ error: "Add a payment reference." });
  if (Number.isNaN(through.getTime())) go({ error: "Please try again." });
  const cents = await payCommissions(id, through, ref, me);
  if (cents === null) go({ error: "Nothing is due to pay." });
  await logAdmin(me, "user", id, "commission paid", `${rands(cents as number)}, reference ${ref}`);
  go({ saved: `${rands(cents as number)} marked as paid.` });
}
