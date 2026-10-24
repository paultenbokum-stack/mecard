import { cleanEmail, cleanText } from "./form-values";

// WooCommerce My Account → Account details (save_account_details): name,
// display name and email, plus an optional password change. Pure, so tests can
// use it; the server action checks the current password and the email.

export interface AccountDetails {
  firstName: string;
  lastName: string;
  displayName: string;
  email: string;
  /** The new password, or "" when it isn't being changed. */
  newPassword: string;
  currentPassword: string;
}

export type AccountDetailsResult = { ok: true; details: AccountDetails } | { ok: false; error: string };

export const MIN_PASSWORD = 8;

/** `hasPassword`: false for accounts that only sign in with Google; they set a first password without a current one. */
export function parseAccountDetails(form: { get(name: string): unknown }, hasPassword: boolean): AccountDetailsResult {
  const firstName = cleanText(form.get("account_first_name"), 100);
  const lastName = cleanText(form.get("account_last_name"), 100);
  const displayName = cleanText(form.get("account_display_name"), 250);
  const rawEmail = cleanText(form.get("account_email"));
  const email = cleanEmail(rawEmail);
  const currentPassword = String(form.get("password_current") ?? "");
  const password1 = String(form.get("password_1") ?? "");
  const password2 = String(form.get("password_2") ?? "");

  if (!firstName) return { ok: false, error: "First name is a required field." };
  if (!lastName) return { ok: false, error: "Last name is a required field." };
  if (!displayName) return { ok: false, error: "Display name is a required field." };
  if (!rawEmail) return { ok: false, error: "Email address is a required field." };
  if (!email) return { ok: false, error: "Please provide a valid email address." };

  if (password1 || password2 || currentPassword) {
    if (hasPassword && !currentPassword) return { ok: false, error: "Please enter your current password." };
    if (!password1) return { ok: false, error: "Please enter your new password." };
    if (password1.length < MIN_PASSWORD) return { ok: false, error: `Your new password needs at least ${MIN_PASSWORD} characters.` };
    if (password1 !== password2) return { ok: false, error: "New passwords do not match." };
  }
  return { ok: true, details: { firstName, lastName, displayName, email, newPassword: password1, currentPassword } };
}
