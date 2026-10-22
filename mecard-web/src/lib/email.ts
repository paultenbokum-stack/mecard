import "server-only";
import { Resend } from "resend";
import { MAIL_FROM } from "./mail-settings";

// Same seam as GuestWave: Cloud Run blocks SMTP, so mail goes via Resend's API.
// With no RESEND_API_KEY (local dev) messages are printed to the terminal.
const apiKey = process.env.RESEND_API_KEY;
const from = MAIL_FROM;
const resend = apiKey ? new Resend(apiKey) : null;

export type Attachment = { filename: string; content: Buffer };

export async function sendEmail(msg: { to: string; subject: string; text: string; replyTo?: string; attachments?: Attachment[] }) {
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
