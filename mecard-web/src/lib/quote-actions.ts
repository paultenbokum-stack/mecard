"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { cleanEmail, cleanPhone, cleanText } from "@/lib/form-values";
import { rateLimited } from "@/lib/contact";
import { clientInfo } from "@/lib/tracking";
import { verifyQuoteToken } from "@/lib/quote-rules";
import { acceptQuote, quoteById, quotePath, rejectQuote, requestQuote } from "@/lib/quotes";
import { loginUrl } from "@/lib/auth-paths";
import { currentUserId } from "@/lib/session";

export type QuoteFormState = { error?: string } | null;

export async function requestQuoteAction(_: QuoteFormState, form: FormData): Promise<QuoteFormState> {
  // Honeypot and a 3-second minimum, as on the sign-up and contact forms.
  const started = Number(form.get("started"));
  if (String(form.get("website") ?? "") !== "" || !started || Date.now() - started < 3000) redirect("/request-quote/?sent=1");
  const items = [...form.entries()]
    .filter(([k]) => k.startsWith("qty_"))
    .map(([k, v]) => ({ productId: Number(k.slice(4)), qty: Math.max(0, Math.min(5000, Math.floor(Number(v)) || 0)) }))
    .filter((i) => i.productId > 0 && i.qty > 0);
  const name = cleanText(form.get("name"), 200);
  const email = cleanEmail(form.get("email"));
  if (!items.length) return { error: "Choose at least one product and enter how many you need." };
  if (!name) return { error: "Please enter your name." };
  if (!email) return { error: "Please enter a valid email address." };
  if (!form.get("terms")) return { error: "Please accept the terms and conditions." };
  if (rateLimited(`quote:${clientInfo(await headers()).ip}`, Date.now(), 5)) return { error: "You've asked for several quotes already. Please email info@mecard.co.za." };
  const q = await requestQuote({
    userId: await currentUserId(),
    name,
    email,
    phone: cleanPhone(form.get("phone")),
    company: cleanText(form.get("company"), 255),
    message: String(form.get("message") ?? "").trim().slice(0, 3000),
    items,
  });
  redirect(`${quotePath(q)}?sent=1`);
}

async function load(id: number, token: string) {
  const q = await quoteById(id);
  if (!q || !verifyQuoteToken(id, q.email, token)) redirect("/request-quote/");
  return q;
}

/** Accept: sign in (or sign up) first, then the quote goes into the basket and on to checkout. */
export async function acceptQuoteAction(id: number, token: string) {
  const q = await load(id, token);
  const userId = await currentUserId();
  if (!userId) redirect(loginUrl(`/quote/${id}/${token}/?accept=1`));
  const res = await acceptQuote(q, userId);
  if (!res.ok) redirect(`/quote/${id}/${token}/?error=${encodeURIComponent(res.error)}`);
  redirect("/checkout/");
}

export async function rejectQuoteAction(id: number, token: string) {
  const q = await load(id, token);
  await rejectQuote(q);
  redirect(`/quote/${id}/${token}/?rejected=1`);
}
