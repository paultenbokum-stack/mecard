import { isPro } from "./profile-format";
import type { ProfileView } from "./public-profile";

// vCard 3.0, ported from download_vcard() in the WordPress plugin, with the
// free-profile note from Me\Viral\Module::append_vcard_note(). Same fields and
// order. Differences, all on purpose: empty lines are left out, values are
// escaped as the spec requires, the photo is a proper JPEG property, long lines
// are folded, and REV is the profile's last change instead of a fixed 2021 date.

export interface VcardOptions {
  /** Absolute URL of the public profile page. */
  profileUrl: string;
  /** iPhones get X-SOCIALPROFILE lines; everything else X-CUSTOM. */
  iphone: boolean;
  /** Base64 JPEG of the profile photo, if there is one. */
  photoJpegBase64?: string | null;
}

const decodeEntities = (s: string) =>
  s.replace(/&(amp|quot|#0?39|apos|lt|gt);/g, (_, e: string) => ({ amp: "&", quot: '"', "#039": "'", "#39": "'", apos: "'", lt: "<", gt: ">" })[e] ?? _);

// RFC 2426 text escaping.
export const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/([,;])/g, "\\$1");

/** Fold lines longer than 75 octets (RFC 2425 §5.8.1). */
export function fold(line: string): string {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let start = 0;
  let limit = 75;
  while (start < bytes.length) {
    let end = Math.min(start + limit, bytes.length);
    // Don't split a multi-byte character.
    while (end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--;
    parts.push(bytes.subarray(start, end).toString("utf8"));
    start = end;
    limit = 74; // continuation lines start with a space
  }
  return parts.join("\r\n ");
}

const SOCIALS: [label: string, key: string][] = [
  ["Facebook", "facebook"],
  ["Twitter", "twitter"],
  ["LinkedIn", "linkedin"],
  ["YouTube", "youtube"],
  ["Tiktok", "tiktok"],
  ["INSTAGRAM", "instagram"],
];

export function buildVcard(view: ProfileView, opts: VcardOptions): string {
  const { profile: p, company: c } = view;
  const lines: string[] = [];
  const add = (name: string, value: string | null | undefined, raw = false) => {
    if (value) lines.push(`${name}:${raw ? value : esc(value)}`);
  };

  lines.push("BEGIN:VCARD", "VERSION:3.0");
  lines.push(`FN;CHARSET=UTF-8:${esc(`${p.firstName} ${p.lastName}`.trim())}`);
  lines.push(`N;CHARSET=UTF-8:${esc(p.lastName)};${esc(p.firstName)};;;`);
  if (opts.photoJpegBase64) lines.push(`PHOTO;ENCODING=b;TYPE=JPEG:${opts.photoJpegBase64}`);
  add("EMAIL;CHARSET=UTF-8;type=WORK,INTERNET", p.email);
  add("TEL;TYPE=CELL;type=PREF", p.mobile);
  if (isPro(p)) {
    add("X-WHATSAPP", p.whatsapp);
    add("TEL;TYPE=WORK", p.workPhone);
  }
  add("TEL;TYPE=WORK", c?.phone);
  if (c?.address) lines.push(`ADR;CHARSET=UTF-8;TYPE=WORK:;;${esc(c.address)}`);
  add("TITLE;CHARSET=UTF-8", decodeEntities(p.jobTitle));
  // WordPress only filled ORG from a linked company; fall back to the company
  // name typed on the profile, which the page itself already shows.
  add("ORG;CHARSET=UTF-8", decodeEntities(c?.name || p.companyName));
  add("URL;type=WORK;CHARSET=UTF-8", c?.website, true);

  // Free profiles carry a line about MeCard: appended to the existing NOTE, or
  // as a NOTE of its own at the end.
  const viral = isPro(p) ? null : "Get your own digital business card at mecard.co.za";
  if (!p.hideProfileLinkOnVcard) {
    lines.push(`URL;type=WORK;CHARSET=UTF-8:${opts.profileUrl}`);
    lines.push(`NOTE:${esc(["More links and social profile on mecard.co.za", viral].filter(Boolean).join("\n"))}`);
  }

  for (const [label, key] of SOCIALS) {
    const url = p.socials[key];
    if (!url) continue;
    lines.push(opts.iphone ? `X-SOCIALPROFILE;TYPE=${label.toUpperCase()}:${url}` : `X-CUSTOM(CHARSET=UTF-8,ENCODING=QUOTED-PRINTABLE,${label}):${url}`);
  }
  lines.push(`REV:${p.updatedAt.toISOString()}`);
  if (viral && p.hideProfileLinkOnVcard) lines.push(`NOTE:${esc(viral)}`);
  lines.push("END:VCARD");
  return lines.map(fold).join("\r\n") + "\r\n";
}

/** File name WordPress used: the profile title plus .vcf. */
export function vcardFileName(name: string): string {
  return `${name.replace(/[\\/:*?"<>|\r\n]+/g, " ").trim() || "contact"}.vcf`;
}
