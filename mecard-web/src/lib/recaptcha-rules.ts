// reCAPTCHA Enterprise (score based, no tick box): what each form asks for and how
// an assessment is judged. Plain data and pure functions, so they can be tested.

export type RecaptchaAction = "LOGIN" | "SIGNUP" | "PASSWORD_RESET" | "CONTACT" | "QUOTE";

/** Below this a submit counts as a likely bot (Google's scale: 0 bot, 1 human). */
export const RECAPTCHA_MIN_SCORE = 0.5;

/**
 * Whether a low score stops the form. Login and lost password only log it, so a
 * real customer on an odd network is never locked out of their account.
 */
export const RECAPTCHA_BLOCKS: Record<RecaptchaAction, boolean> = {
  SIGNUP: true,
  CONTACT: true,
  QUOTE: true,
  LOGIN: false,
  PASSWORD_RESET: false,
};

/** The hidden field each protected form posts. */
export const RECAPTCHA_FIELD = "recaptcha_token";

export type RecaptchaVerdict = { pass: boolean; score: number | null; reason: string };

/** Judges an assessment response from recaptchaenterprise.googleapis.com. */
export function judgeAssessment(body: unknown, action: RecaptchaAction, min = RECAPTCHA_MIN_SCORE): RecaptchaVerdict {
  const b = (body ?? {}) as { tokenProperties?: { valid?: boolean; action?: string; invalidReason?: string }; riskAnalysis?: { score?: number } };
  const score = typeof b.riskAnalysis?.score === "number" ? b.riskAnalysis.score : null;
  if (!b.tokenProperties?.valid) return { pass: false, score, reason: `invalid token (${b.tokenProperties?.invalidReason ?? "unknown"})` };
  if (b.tokenProperties.action !== action) return { pass: false, score, reason: `action ${b.tokenProperties.action ?? "none"}, expected ${action}` };
  if (score === null || score < min) return { pass: false, score, reason: `score ${score ?? "none"}` };
  return { pass: true, score, reason: "ok" };
}
