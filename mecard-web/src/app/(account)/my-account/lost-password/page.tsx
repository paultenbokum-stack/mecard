import type { Metadata } from "next";
import Link from "next/link";
import { LostPasswordForm } from "@/components/account/AuthForms";
import { LOGIN } from "@/lib/auth-paths";

export const metadata: Metadata = { title: "Lost password" };

export default function LostPasswordPage() {
  return (
    <div className="acc__wrap acc__wrap--narrow">
      <h1>Lost password</h1>
      <div className="acc-panel acc-panel--white">
        <p>Lost your password? Please enter your username or email address. You will receive a link to create a new password via email.</p>
        <LostPasswordForm />
      </div>
      <p className="acc__muted">
        <Link href={LOGIN}>Back to login</Link>
      </p>
    </div>
  );
}
