import "server-only";
import { Resend } from "resend";
import { MAIL_FROM } from "./mail-settings";

// Same seam as GuestWave: Cloud Run blocks SMTP, so mail goes via Resend's API.
// Locally: with MAILPIT_URL (npm run dev:all) mail goes to the Mailpit catcher,
// readable at http://localhost:8025; with neither it is printed to the terminal.
const apiKey = process.env.RESEND_API_KEY;
const from = MAIL_FROM;
const resend = apiKey ? new Resend(apiKey) : null;

export type Attachment = { filename: string; content: Buffer };

/** "MeCard <info@x.co>" → Mailpit's { Name, Email }. */
function address(a: string) {
  const m = a.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  return m ? { Name: m[1], Email: m[2] } : { Email: a.trim() };
}

async function sendToMailpit(base: string, msg: Parameters<typeof sendEmail>[0]) {
  const res = await fetch(`${base.replace(/\/+$/, "")}/api/v1/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      From: address(from),
      To: [address(msg.to)],
      ...(msg.replyTo ? { ReplyTo: [address(msg.replyTo)] } : {}),
      Subject: msg.subject,
      Text: msg.text,
      Attachments: (msg.attachments ?? []).map((a) => ({ Filename: a.filename, Content: a.content.toString("base64") })),
    }),
  });
  if (!res.ok) throw new Error(`Mailpit returned ${res.status}`);
}

export async function sendEmail(msg: { to: string; subject: string; text: string; replyTo?: string; attachments?: Attachment[] }) {
  if (!resend && process.env.MAILPIT_URL) {
    try {
      await sendToMailpit(process.env.MAILPIT_URL, msg);
      return { ok: true as const };
    } catch (e) {
      console.error(`[email] Mailpit: ${e instanceof Error ? e.message : e}; printing instead.`);
    }
  }
  if (!resend) {
    const files = msg.attachments?.map((a) => `${a.filename} (${a.content.length} bytes)`).join(", ");
    console.log(`[email:dev] to=${msg.to} subject=${JSON.stringify(msg.subject)}${files ? ` attachments=${files}` : ""}\n${msg.text}`);
    return { ok: true as const };
  }
  try {
    const { error } = await resend.emails.send({
      from,
      to: msg.to,
      subject: msg.subject,
      text: msg.text,
      ...(msg.replyTo ? { replyTo: msg.replyTo } : {}),
      ...(msg.attachments?.length ? { attachments: msg.attachments } : {}),
    });
    if (error) {
      console.error(`[email] send to ${msg.to} failed: ${error.message}`);
      return { ok: false as const, error: error.message };
    }
    return { ok: true as const };
  } catch (e) {
    const error = e instanceof Error ? e.message : "Email failed to send.";
    console.error(`[email] send to ${msg.to} failed: ${error}`);
    return { ok: false as const, error };
  }
}
