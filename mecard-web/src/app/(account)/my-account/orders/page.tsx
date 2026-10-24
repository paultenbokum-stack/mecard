import type { Metadata } from "next";
import Link from "next/link";
import { AccountLayout } from "@/components/account/AccountNav";
import { OrdersTable } from "@/components/shop/OrdersTable";
import { customerOrders } from "@/lib/orders";
import { requireUserId } from "@/lib/session";

export const metadata: Metadata = { title: { absolute: "Orders - MeCard" } };

// WooCommerce My Account → Orders.
export default async function OrdersPage() {
  const userId = await requireUserId("/my-account/orders/");
  const list = await customerOrders(userId);

  return (
    <AccountLayout active="orders">
      <h1>Orders</h1>
      {list.length ? (
        <section className="acc-panel acc-panel--white">
          <OrdersTable list={list} />
        </section>
      ) : (
        <div className="acc-empty">
          No order has been made yet. <Link href="/shop/">Browse products</Link>
        </div>
      )}
    </AccountLayout>
  );
}
