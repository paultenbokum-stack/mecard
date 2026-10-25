import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { AccountLayout } from "@/components/account/AccountNav";
import { formatAddress, hasLines } from "@/lib/addresses";
import { requireUserId } from "@/lib/session";

export const metadata: Metadata = { title: { absolute: "Addresses - MeCard" } };

// WooCommerce My Account → Addresses (/my-account/edit-address/): the saved
// billing and shipping addresses that checkout fills in.
export default async function AddressesPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const userId = await requireUserId("/my-account/edit-address/");
  const { saved } = await searchParams;
  const [u] = await db.select({ billing: users.billingAddress, shipping: users.shippingAddress }).from(users).where(eq(users.id, userId)).limit(1);
  const blocks = [
    { kind: "billing", title: "Billing address", a: u?.billing },
    { kind: "shipping", title: "Shipping address", a: u?.shipping },
  ] as const;

  return (
    <AccountLayout active="edit-address">
      <h1>Addresses</h1>
      {saved ? <p className="acc-panel acc-panel--ok">Address changed successfully.</p> : null}
      <p>The following addresses will be used on the checkout page by default.</p>
      <div className="acc-grid">
        {blocks.map(({ kind, title, a }) => (
          <section key={kind} className="acc-panel acc-panel--white">
            <h2>{title}</h2>
            {hasLines(a) ? (
              <address className="shop-address">
                {[...formatAddress(a), a.phone].filter(Boolean).map((l) => (
                  <span key={l}>
                    {l}
                    <br />
                  </span>
                ))}
              </address>
            ) : (
              <p className="acc__muted">You have not set up this type of address yet.</p>
            )}
            <Link className="acc-btn acc-btn--small" href={`/my-account/edit-address/${kind}/`}>
              {hasLines(a) ? `Edit ${title.toLowerCase()}` : `Add ${title.toLowerCase()}`}
            </Link>
          </section>
        ))}
      </div>
    </AccountLayout>
  );
}
