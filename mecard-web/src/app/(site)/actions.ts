"use server";

import { headers } from "next/headers";
import { db } from "@/db/client";
import { events } from "@/db/schema";
import { checkContact, contactEmail, rateLimited } from "@/lib/contact";
import { sendEmail } from "@/lib/email";
import { clientInfo, eventRow } from "@/lib/tracking";

export type ContactState = { ok?: boolean; error?: string } | null;

export async function sendContactAction(_: ContactState, form: FormData): Promise<ContactState> {
  const check = checkContact(Object.fromEntries(form));
  // Bots get the same thank-you as people, so they learn nothing.
  if (!check.ok) return check.spam ? { ok: true } : { error: check.error };
  const info = clientInfo(await headers());
  if (rateLimited(info.ip || "unknown")) return { error: "You've sent several messages already. Please email info@mecard.co.za instead." };

  const to = process.env.CONTACT_TO || "info@mecard.co.za";
  const res = await sendEmail({ to, replyTo: check.value.email, ...contactEmail(check.value) });
  if (!res.ok) return { error: "Your message couldn't be sent. Please try again, or email info@mecard.co.za." };

  const row = eventRow({ body: { event_name: "contact_form_submitted", meta: { page: "contact-us" } }, sessionCookie: null, userId: null, ...info });
  if (row) await db.insert(events).values(row).catch(() => undefined);
  return { ok: true };
}
