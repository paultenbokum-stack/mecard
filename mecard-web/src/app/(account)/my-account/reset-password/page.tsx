import type { Metadata } from "next";
import Link from "next/link";
import { LostPasswordForm, ResetPasswordForm } from "@/components/account/AuthForms";
import { LOGIN } from "@/lib/auth-paths";
import { resetTokenUser } from "@/lib/password-reset";

export const metadata: Metadata = { title: "Reset password" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  const valid = !!(await resetTokenUser(token));
  return (
    <div className="acc__wrap acc__wrap--narrow">
      <h1>Reset password</h1>
      <div className="acc-panel acc-panel--white">
        {valid ? (
          <>
            <p>Enter a new password below.</p>
            <ResetPasswordForm token={token} />
          </>
        ) : (
          <>
            <p className="acc-error" style={{ marginBottom: 14 }}>
              This password reset link has expired or was already used. Ask for a new one:
            </p>
            <LostPasswordForm />
          </>
        )}
      </div>
      <p className="acc__muted">
        <Link href={LOGIN}>Back to login</Link>
      </p>
    </div>
  );
}
