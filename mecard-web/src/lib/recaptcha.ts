import "server-only";
import { CONTACT_TO } from "./mail-settings";
import { judgeAssessment, RECAPTCHA_BLOCKS, RECAPTCHA_FIELD, type RecaptchaAction } from "./recaptcha-rules";

// Server side of reCAPTCHA Enterprise, as the WordPress sign-up used it: one
// assessment per submit. Without the keys (local development) every form passes,
// and if Google can't be reached the form passes too, so an outage never blocks
// sign-ups or logins.

const SITE_KEY = () => process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ?? "";
const API_KEY = () => process.env.RECAPTCHA_API_KEY ?? "";
const PROJECT = () => process.env.RECAPTCHA_PROJECT ?? "";

export const recaptchaConfigured = () => !!(SITE_KEY() && API_KEY() && PROJECT());

/** True when the submit may go ahead. Low scores are logged; only the forms in RECAPTCHA_BLOCKS are stopped by them. */
export async function recaptchaAllows(form: FormData, action: RecaptchaAction): Promise<boolean> {
  if (!recaptchaConfigured()) return true;
  const token = String(form.get(RECAPTCHA_FIELD) ?? "");
  const blocks = RECAPTCHA_BLOCKS[action];
  if (!token) {
    console.warn(`[recaptcha] ${action}: no token`);
    return !blocks;
  }
  let body: unknown;
  try {
    const res = await fetch(`https://recaptchaenterprise.googleapis.com/v1/projects/${encodeURIComponent(PROJECT())}/assessments?key=${encodeURIComponent(API_KEY())}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: { token, siteKey: SITE_KEY(), expectedAction: action } }),
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    if (!res.ok) {
      console.error(`[recaptcha] ${action}: assessment failed with ${res.status}`);
      return true;
    }
    body = await res.json();
  } catch (e) {
    console.error(`[recaptcha] ${action}: assessment failed`, e);
    return true;
  }
  const verdict = judgeAssessment(body, action);
  if (verdict.pass) return true;
  console.warn(`[recaptcha] ${action}: ${verdict.reason}${blocks ? ", blocked" : ", allowed"}`);
  return !blocks;
}

/** What a blocked person sees. */
export const RECAPTCHA_BLOCKED = `We couldn't confirm you're not a bot. Please try again in a moment, or email ${CONTACT_TO}.`;
