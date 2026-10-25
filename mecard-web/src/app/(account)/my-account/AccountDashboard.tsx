import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { AccountLayout } from "@/components/account/AccountNav";
import { OrdersTable } from "@/components/shop/OrdersTable";
import { LOGOUT } from "@/lib/auth-paths";
import { customerOrders } from "@/lib/orders";

// WooCommerce's My Account dashboard: a greeting, then where to go next, with
// the latest orders so invoices are one click away.
export async function AccountDashboard({ userId }: { userId: number }) {
  const [[user], recent] = await Promise.all([
    db.select({ firstName: users.firstName, displayName: users.displayName, email: users.email }).from(users).where(eq(users.id, userId)).limit(1),
    customerOrders(userId, 3),
  ]);
  const name = user?.displayName || user?.firstName || user?.email || "there";

  return (
    <AccountLayout active="dashboard">
      <h1>My account</h1>
      <p className="acc__lead">
        Hello <strong>{name}</strong> (not {name}? <Link href={LOGOUT}>Log out</Link>)
      </p>
      <p>
        From your account overview you can manage <Link href="/manage/">your profiles and cards</Link>, view your <Link href="/my-account/orders/">orders</Link> and
        download invoices, manage your <Link href="/my-account/edit-address/">shipping and billing addresses</Link>, and edit{" "}
        <Link href="/my-account/edit-account/">your password and account details</Link>.
      </p>
      <div className="acc-myaccount__tiles">
        <Link className="acc-myaccount__tile" href="/manage/">
          <i className="fa-solid fa-id-card" aria-hidden="true" />
          <span>My profiles and cards</span>
        </Link>
        <Link className="acc-myaccount__tile" href="/my-account/orders/">
          <i className="fa-solid fa-receipt" aria-hidden="true" />
          <span>Orders and invoices</span>
        </Link>
        <Link className="acc-myaccount__tile" href="/my-account/edit-account/">
          <i className="fa-solid fa-user-pen" aria-hidden="true" />
          <span>Account details</span>
        </Link>
      </div>
      {recent.length ? (
        <section className="acc-panel acc-panel--white">
          <div className="acc-panel__head">
            <h2>Recent orders</h2>
            <Link href="/my-account/orders/">All orders</Link>
          </div>
          <OrdersTable list={recent} />
        </section>
      ) : null}
    </AccountLayout>
  );
}
