// The test deploy holds real customers' data, so no email may reach them.
// EMAIL_MODE=log only logs each email; EMAIL_REDIRECT_TO=<address> sends every
// email there instead, with the real recipient in the subject. Every send goes
// through sendEmail (lib/email.ts), which applies this first.

export type OutgoingEmail = { to: string; subject: string; text: string; replyTo?: string };

export type EmailRoute<T extends OutgoingEmail> = { action: "log"; msg: T } | { action: "send"; msg: T };

export function routeEmail<T extends OutgoingEmail>(msg: T, env: { EMAIL_MODE?: string; EMAIL_REDIRECT_TO?: string }): EmailRoute<T> {
  if (env.EMAIL_MODE === "log") return { action: "log", msg };
  const redirect = env.EMAIL_REDIRECT_TO?.trim();
  if (redirect) return { action: "send", msg: { ...msg, to: redirect, subject: `[TEST, for ${msg.to}] ${msg.subject}`, replyTo: undefined } };
  return { action: "send", msg };
}
