"use client";

import { useActionState } from "react";
import { loginAction, lostPasswordAction, resetPasswordAction, saveAccountAction, type FormState } from "@/app/(account)/my-account/actions";

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

export interface AccountFormValues {
  firstName: string;
  lastName: string;
  displayName: string;
  email: string;
  hasPassword: boolean;
}

/** WooCommerce's edit-account form: name, display name, email and a password change. */
export function EditAccountForm({ values }: { values: AccountFormValues }) {
  const [state, action, pending] = useActionState(saveAccountAction, null);
  return (
    <form action={action} className="acc-form">
      <div className="acc-grid">
        <div className="acc-field">
          <label htmlFor="account_first_name">First name</label>
          <input type="text" id="account_first_name" name="account_first_name" autoComplete="given-name" required defaultValue={values.firstName} />
        </div>
        <div className="acc-field">
          <label htmlFor="account_last_name">Last name</label>
          <input type="text" id="account_last_name" name="account_last_name" autoComplete="family-name" required defaultValue={values.lastName} />
        </div>
      </div>
      <div className="acc-field">
        <label htmlFor="account_display_name">Display name</label>
        <input type="text" id="account_display_name" name="account_display_name" required defaultValue={values.displayName} aria-describedby="account_display_name_hint" />
        <span className="acc-field__hint" id="account_display_name_hint">
          How your name shows in your account and in emails from MeCard.
        </span>
      </div>
      <div className="acc-field">
        <label htmlFor="account_email">Email address</label>
        <input type="email" id="account_email" name="account_email" autoComplete="email" required defaultValue={values.email} aria-describedby="account_email_hint" />
        <span className="acc-field__hint" id="account_email_hint">
          If you log in with Google, keep this the same as your Google email address.
        </span>
      </div>
      <fieldset className="acc-fieldset">
        <legend>{values.hasPassword ? "Password change" : "Set a password"}</legend>
        {!values.hasPassword ? <p className="acc__muted">You log in with Google. Set a password to log in with your email address too.</p> : null}
        {values.hasPassword ? (
          <div className="acc-field">
            <label htmlFor="password_current">Current password (leave blank to leave unchanged)</label>
            <input type="password" id="password_current" name="password_current" autoComplete="current-password" />
          </div>
        ) : null}
        <div className="acc-field">
          <label htmlFor="password_1">New password{values.hasPassword ? " (leave blank to leave unchanged)" : ""}</label>
          <input type="password" id="password_1" name="password_1" autoComplete="new-password" minLength={8} aria-describedby="password_1_hint" />
          <span className="acc-field__hint" id="password_1_hint">
            At least 8 characters.
          </span>
        </div>
        <div className="acc-field">
          <label htmlFor="password_2">Confirm new password</label>
          <input type="password" id="password_2" name="password_2" autoComplete="new-password" minLength={8} />
        </div>
      </fieldset>
      <FormMessage state={state} />
      <div>
        <button type="submit" className="acc-btn acc-btn--primary" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
