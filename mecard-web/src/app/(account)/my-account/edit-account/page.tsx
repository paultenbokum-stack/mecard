import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { AccountLayout } from "@/components/account/AccountNav";
import { EditAccountForm } from "@/components/account/AuthForms";
import { requireUserId } from "@/lib/session";

export const metadata: Metadata = { title: { absolute: "Account details - MeCard" } };

// WooCommerce My Account → Account details (/my-account/edit-account/).
export default async function EditAccountPage() {
  const userId = await requireUserId("/my-account/edit-account/");
  const [u] = await db
    .select({ firstName: users.firstName, lastName: users.lastName, displayName: users.displayName, email: users.email, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return (
    <AccountLayout active="edit-account">
      <h1>Account details</h1>
      <section className="acc-panel acc-panel--white">
        <EditAccountForm
          values={{ firstName: u?.firstName ?? "", lastName: u?.lastName ?? "", displayName: u?.displayName ?? "", email: u?.email ?? "", hasPassword: !!u?.passwordHash }}
        />
      </section>
    </AccountLayout>
  );
}
