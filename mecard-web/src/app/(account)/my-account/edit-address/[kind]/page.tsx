import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { AccountLayout } from "@/components/account/AccountNav";
import { AddressForm } from "@/components/account/AddressForm";
import { EMPTY_ADDRESS } from "@/lib/addresses";
import { requireUserId } from "@/lib/session";

export const metadata: Metadata = { title: { absolute: "Addresses - MeCard" } };

// /my-account/edit-address/billing/ and /shipping/. A new billing address starts from the account's name and phone.
export default async function EditAddressPage({ params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  if (kind !== "billing" && kind !== "shipping") notFound();
  const userId = await requireUserId(`/my-account/edit-address/${kind}/`);
  const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const saved = kind === "billing" ? u?.billingAddress : u?.shippingAddress;
  const address = { ...EMPTY_ADDRESS, firstName: u?.firstName ?? "", lastName: u?.lastName ?? "", phone: kind === "billing" ? (u?.phone ?? "") : "", ...saved };

  return (
    <AccountLayout active="edit-address">
      <h1>{kind === "billing" ? "Billing address" : "Shipping address"}</h1>
      <section className="acc-panel acc-panel--white">
        <AddressForm kind={kind} address={address} />
      </section>
    </AccountLayout>
  );
}
