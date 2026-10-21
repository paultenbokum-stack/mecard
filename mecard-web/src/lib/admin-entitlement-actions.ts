"use server";

import { eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { entitlements, users } from "@/db/schema";
import { ENTITLEMENT_STATUS_LABEL } from "@/lib/entitlement-labels";
import { requireAdmin } from "@/lib/session";

// Entitlements (wp_mecard_entitlements had no admin screen; support fixed
// rows in the database). Every change by staff is noted in the row's meta.

const str = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

function back(form: FormData, outcome: { saved?: string; error?: string }): never {
  const from = str(form, "back");
  const url = new URL(/^\/admin\/entitlements\/[\w/?=&%.+@-]*$/.test(from) ? from : "/admin/entitlements/", "http://x");
  url.searchParams.delete("saved");
  url.searchParams.delete("error");
  for (const [k, v] of Object.entries(outcome)) if (v) url.searchParams.set(k, v);
  redirect(`${url.pathname}${url.search}`);
}

type Change = { at: string; by: number; note: string };
const withChange = (meta: Record<string, unknown> | null, change: Change) => ({ ...(meta ?? {}), adminChanges: [...((meta?.adminChanges as Change[]) ?? []), change] });

export async function setEntitlementStatusAction(form: FormData) {
  const me = await requireAdmin();
  const id = Number(form.get("entitlement_id"));
  const status = str(form, "status");
  if (!(status in ENTITLEMENT_STATUS_LABEL)) back(form, { error: "Unknown status." });
  const [e] = await db.select().from(entitlements).where(eq(entitlements.id, id));
  if (!e) back(form, { error: "Entitlement not found." });
  if (e.status === status) back(form, { saved: `Entitlement ${id} is already ${ENTITLEMENT_STATUS_LABEL[status]}.` });
  const reason = str(form, "reason");
  await db
    .update(entitlements)
    .set({
      status,
      // Back to unassigned frees it for another profile or card.
      ...(status === "paid_unassigned" ? { assignedProfileId: null, assignedCardId: null, assignedTagId: null, consumedAt: null } : {}),
      ...(status === "consumed" && !e.consumedAt ? { consumedAt: new Date() } : {}),
      meta: withChange(e.meta, { at: new Date().toISOString(), by: me, note: `${e.status} → ${status}${reason ? `: ${reason}` : ""}` }),
      updatedAt: new Date(),
    })
    .where(eq(entitlements.id, id));
  back(form, { saved: `Entitlement ${id}: ${ENTITLEMENT_STATUS_LABEL[e.status] ?? e.status} → ${ENTITLEMENT_STATUS_LABEL[status]}.` });
}

/**
 * Give a customer Pro upgrades without an order (goodwill, a reissue). Their
 * profiles take them up like bought ones. Cards can't be granted this way:
 * a card is made when it is added to a basket.
 */
export async function grantProUpgradeAction(form: FormData) {
  const me = await requireAdmin();
  const email = str(form, "email").toLowerCase();
  const type = "pro_upgrade";
  const count = Number(form.get("count") || 1);
  const reason = str(form, "reason");
  if (!Number.isInteger(count) || count < 1 || count > 50) back(form, { error: "Give between 1 and 50." });
  if (!reason) back(form, { error: "Please say why, for the record." });
  const [u] = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.email}) = ${email}`);
  if (!u) back(form, { error: `No account for ${email}.` });
  const now = new Date();
  await db.insert(entitlements).values(
    Array.from({ length: count }, () => ({
      ownerId: u.id,
      type,
      status: "paid_unassigned",
      meta: { grantedBy: me, reason, adminChanges: [{ at: now.toISOString(), by: me, note: `granted: ${reason}` }] },
    })),
  );
  back(form, { saved: `Gave ${email} ${count} Pro upgrade${count === 1 ? "" : "s"}.` });
}
