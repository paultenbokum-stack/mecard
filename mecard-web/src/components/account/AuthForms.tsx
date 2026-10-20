"use client";

import { useActionState } from "react";
import { loginAction, lostPasswordAction, resetPasswordAction, type FormState } from "@/app/(account)/my-account/actions";

// The WooCommerce login, lost-password and reset forms.

export function FormMessage({ state }: { state: FormState }) {
  if (state?.error)
    return (
      <p className="acc-error" role="alert">
        {state.error}
      </p>
    );
  if (state?.ok)
    return (
      <p className="acc-ok" role="status">
        {state.ok}
      </p>
    );
  return null;
}

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(loginAction, null);
  return (
    <form action={action} className="acc-form">
      <input type="hidden" name="next" value={next} />
      <div className="acc-field">
        <label htmlFor="username">Username or email address</label>
        <input type="text" id="username" name="username" autoComplete="username" required autoFocus={!state?.username} defaultValue={state?.username} key={state?.username} />
      </div>
      <div className="acc-field">
        <label htmlFor="password">Password</label>
        <input type="password" id="password" name="password" autoComplete="current-password" required autoFocus={!!state?.username} />
      </div>
      <FormMessage state={state} />
      <button type="submit" className="acc-btn acc-btn--primary acc-btn--block" disabled={pending}>
        {pending ? "Logging in…" : "Log in"}
      </button>
    </form>
  );
}

export function LostPasswordForm() {
  const [state, action, pending] = useActionState(lostPasswordAction, null);
  return (
    <form action={action} className="acc-form">
      <div className="acc-field">
        <label htmlFor="user_login">Username or email</label>
        <input type="text" id="user_login" name="user_login" autoComplete="username" required autoFocus />
      </div>
      <FormMessage state={state} />
      <button type="submit" className="acc-btn acc-btn--primary acc-btn--block" disabled={pending}>
        {pending ? "Sending…" : "Reset password"}
      </button>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPasswordAction, null);
  return (
    <form action={action} className="acc-form">
      <input type="hidden" name="token" value={token} />
      <div className="acc-field">
        <label htmlFor="password_1">New password</label>
        <input type="password" id="password_1" name="password_1" autoComplete="new-password" minLength={8} required autoFocus />
        <span className="acc-field__hint">At least 8 characters.</span>
      </div>
      <div className="acc-field">
        <label htmlFor="password_2">Re-enter new password</label>
        <input type="password" id="password_2" name="password_2" autoComplete="new-password" minLength={8} required />
      </div>
      <FormMessage state={state} />
      <button type="submit" className="acc-btn acc-btn--primary acc-btn--block" disabled={pending}>
        {pending ? "Saving…" : "Save new password"}
      </button>
    </form>
  );
}
