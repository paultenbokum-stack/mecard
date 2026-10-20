// The contact form (the Toolset "contact-us" form): checks and the email it
// sends. Submissions aren't stored, as decided for the migration; they go to
// CONTACT_TO with the sender as Reply-To (customise_cred_notifications()).

import { cleanEmail, cleanPhone, cleanText } from "./form-values";

export interface ContactInput {
  name: string;
  email: string;
  phone: string;
  message: string;
}

export type ContactCheck = { ok: true; value: ContactInput } | { ok: false; error: string; spam?: boolean };

/** Fewer than this many ms between showing the form and sending it is a bot. */
export const MIN_FILL_MS = 2500;

export function checkContact(form: { name?: unknown; email?: unknown; phone?: unknown; message?: unknown; website?: unknown; started?: unknown }, now = Date.now()): ContactCheck {
  // Honeypot and timing in place of reCAPTCHA (which needed WordPress's keys).
  const started = Number(form.started);
  if (String(form.website ?? "") !== "" || !Number.isFinite(started) || now - started < MIN_FILL_MS) return { ok: false, error: "Please try again.", spam: true };
  const value = {
    name: cleanText(form.name, 200),
    email: cleanEmail(form.email),
    phone: cleanPhone(form.phone),
    message: String(form.message ?? "").replace(/\r\n/g, "\n").trim().slice(0, 5000),
  };
  if (!value.name) return { ok: false, error: "Please enter your name." };
  if (!value.email) return { ok: false, error: "Please enter a valid email address." };
  if (!value.message) return { ok: false, error: "Please tell us what you would like to know." };
  if ((value.message.match(/https?:\/\//g) ?? []).length > 3) return { ok: false, error: "Please send fewer links.", spam: true };
  return { ok: true, value };
}

export function contactEmail(c: ContactInput) {
  return {
    subject: `New contact from mecard.co.za: ${c.name}`,
    text: [`Name: ${c.name}`, `Email: ${c.email}`, `Phone: ${c.phone || "-"}`, "", c.message].join("\n"),
  };
}

// A few messages per visitor per hour is plenty; this stops floods from one IP.
const recent = new Map<string, number[]>();
export function rateLimited(key: string, now = Date.now(), max = 5, windowMs = 3600_000): boolean {
  const list = (recent.get(key) ?? []).filter((t) => now - t < windowMs);
  if (list.length >= max) return true;
  list.push(now);
  recent.set(key, list);
  if (recent.size > 5000) recent.clear();
  return false;
}
