import { test } from "node:test";
import assert from "node:assert/strict";
import { buildVcard, esc, fold, vcardFileName } from "./vcard";
import type { ProfileView } from "./public-profile";

function view(over: Partial<ProfileView["profile"]> = {}, company: Partial<NonNullable<ProfileView["company"]>> | null = {}): ProfileView {
  return {
    profile: {
      id: 12345, slug: "jane-doe", type: "pro", firstName: "Jane", lastName: "Doe", jobTitle: "Principal &amp; Agent",
      email: "jane@example.com", mobile: "071 234 5678", whatsapp: "071 000 0000", workPhone: "031 000 0000", companyName: "Typed Co",
      website: "", socials: { facebook: "https://facebook.com/x", instagram: "https://instagram.com/mj" }, photoPath: null, companyLogoPath: null,
      hideProfileLinkOnVcard: false, onboarding: {}, archived: false, ownerId: null, managerId: null, companyId: 1,
      createdAt: new Date("2025-01-01T00:00:00Z"), updatedAt: new Date("2025-11-24T16:29:52Z"), ...over,
    },
    company: company === null ? null : ({ id: 1, name: "Acme Properties", phone: "031 555 0100", website: "https://www.example.co.za/", address: "1 Main Rd, Durban; KZN", ...company } as NonNullable<ProfileView["company"]>),
    companyLinks: [],
    profileLinks: [],
  };
}

const opts = { profileUrl: "https://mecard.co.za/mecard-profile/jane-doe/", iphone: false };
const lines = (s: string) => s.replace(/\r\n /g, "").split("\r\n");

test("pro profile: WordPress fields in WordPress order", () => {
  assert.deepEqual(lines(buildVcard(view(), opts)), [
    "BEGIN:VCARD",
    "VERSION:3.0",
    "FN;CHARSET=UTF-8:Jane Doe",
    "N;CHARSET=UTF-8:Doe;Jane;;;",
    "EMAIL;CHARSET=UTF-8;type=WORK,INTERNET:jane@example.com",
    "TEL;TYPE=CELL;type=PREF:071 234 5678",
    "X-WHATSAPP:071 000 0000",
    "TEL;TYPE=WORK:031 000 0000",
    "TEL;TYPE=WORK:031 555 0100",
    "ADR;CHARSET=UTF-8;TYPE=WORK:;;1 Main Rd\\, Durban\\; KZN",
    "TITLE;CHARSET=UTF-8:Principal & Agent",
    "ORG;CHARSET=UTF-8:Acme Properties",
    "URL;type=WORK;CHARSET=UTF-8:https://www.example.co.za/",
    "URL;type=WORK;CHARSET=UTF-8:https://mecard.co.za/mecard-profile/jane-doe/",
    "NOTE:More links and social profile on mecard.co.za",
    "X-CUSTOM(CHARSET=UTF-8,ENCODING=QUOTED-PRINTABLE,Facebook):https://facebook.com/x",
    "X-CUSTOM(CHARSET=UTF-8,ENCODING=QUOTED-PRINTABLE,INSTAGRAM):https://instagram.com/mj",
    "REV:2025-11-24T16:29:52.000Z",
    "END:VCARD",
    "",
  ]);
});

test("iPhones get X-SOCIALPROFILE lines", () => {
  const v = buildVcard(view(), { ...opts, iphone: true });
  assert.match(v, /\r\nX-SOCIALPROFILE;TYPE=FACEBOOK:https:\/\/facebook\.com\/x\r\n/);
  assert.ok(!v.includes("X-CUSTOM"));
});

test("standard profile: no WhatsApp or direct line, and the MeCard note", () => {
  const v = lines(buildVcard(view({ type: "standard" }), opts));
  assert.ok(!v.some((l) => l.startsWith("X-WHATSAPP")));
  assert.equal(v.filter((l) => l.startsWith("TEL;TYPE=WORK")).length, 1);
  assert.ok(v.includes("NOTE:More links and social profile on mecard.co.za\\nGet your own digital business card at mecard.co.za"));
});

test("hidden profile link: no profile URL; free profiles still get the note at the end", () => {
  const v = lines(buildVcard(view({ type: "standard", hideProfileLinkOnVcard: true }), opts));
  assert.ok(!v.some((l) => l.includes("/mecard-profile/")));
  assert.deepEqual(v.slice(-3), ["NOTE:Get your own digital business card at mecard.co.za", "END:VCARD", ""]);
  assert.ok(!lines(buildVcard(view({ hideProfileLinkOnVcard: true }), opts)).some((l) => l.startsWith("NOTE")));
});

test("without a company: ORG falls back to the typed company name; empty fields are left out", () => {
  const v = lines(buildVcard(view({ email: "" }, null), opts));
  assert.ok(v.includes("ORG;CHARSET=UTF-8:Typed Co"));
  assert.ok(!v.some((l) => l.startsWith("EMAIL") || l.startsWith("ADR") || l === "TEL;TYPE=WORK:"));
});

test("photo is embedded as JPEG and long lines are folded at 75 octets", () => {
  const b64 = "A".repeat(300);
  const raw = buildVcard(view(), { ...opts, photoJpegBase64: b64 });
  for (const l of raw.split("\r\n")) assert.ok(Buffer.byteLength(l) <= 75, `line too long: ${l.length}`);
  assert.ok(lines(raw).includes(`PHOTO;ENCODING=b;TYPE=JPEG:${b64}`));
});

test("folding never splits a multi-byte character", () => {
  const out = fold("FN;CHARSET=UTF-8:" + "é".repeat(80));
  for (const part of out.split("\r\n ")) assert.ok(!part.includes("�"));
  assert.equal(out.replace(/\r\n /g, ""), "FN;CHARSET=UTF-8:" + "é".repeat(80));
});

test("escaping and file names", () => {
  assert.equal(esc("a,b;c\\d\ne"), "a\\,b\\;c\\\\d\\ne");
  assert.equal(vcardFileName("Jane Doe"), "Jane Doe.vcf");
  assert.equal(vcardFileName('a/b:c"d'), "a b c d.vcf");
  assert.equal(vcardFileName(""), "contact.vcf");
});
