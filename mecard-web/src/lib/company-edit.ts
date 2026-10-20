import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { companies } from "@/db/schema";
import FA_ICONS from "./fa-icons.json";
import { cleanColour, cleanEmail, cleanPhone, cleanText, cleanUrl } from "./form-values";
import { refreshCompanyPages } from "./manage";
import { replaceLinks } from "./profile-edit";

// Saving the company editor (Me\Company_Editor, the edit-companies form and
// save_company_data() in the single editor): details, logo, branding, custom
// CSS and the company-wide buttons. Every Pro profile in the company shows
// the change, so all their pages are refreshed.

export const FONT_CHOICES: [value: string, label: string][] = [
  ["", "Default"],
  ["opensans", "Open Sans"],
  ["Montserrat", "Montserrat"],
  ["Roboto", "Roboto"],
  ["playfairdisplay", "Playfair Display"],
  ["Merriweather", "Merriweather"],
  ["Helvetica", "Helvetica"],
];

export const COLOUR_FIELDS = [
  ["headingColour", "Heading colour"],
  ["bodyColour", "Text colour"],
  ["accentColour", "Accent (buttons and links)"],
  ["buttonTextColour", "Button text"],
  ["downloadColour", "Save contact button"],
  ["downloadTextColour", "Save contact button text"],
] as const;

export const MAX_CUSTOM_CSS = 20000;

export interface CompanyInput {
  name: string;
  phone: string;
  website: string;
  address: string;
  supportEmail: string;
  descriptionHtml: string;
  logoPath: string | null;
  headingFont: string;
  bodyFont: string;
  headingColour: string;
  bodyColour: string;
  accentColour: string;
  buttonTextColour: string;
  downloadColour: string;
  downloadTextColour: string;
  customCss: string;
  links: { id?: number; label: string; url: string; icon: string }[];
}

const font = (v: unknown) => {
  const s = cleanText(v, 50);
  return FONT_CHOICES.some(([f]) => f === s) ? s : "";
};

/** The plugin's icon picker list (data/fa-allowlist.json). */
export const ICON_CHOICES = FA_ICONS as { class: string; label: string }[];

/** Font Awesome classes only ("fa-solid fa-globe"), as the icon picker saved them. */
const icon = (v: unknown) => {
  const s = cleanText(v, 100);
  return /^(fa[a-z]?|fa-(solid|regular|brands))( fa-[a-z0-9-]+)+$/.test(s) ? s : "";
};

export function cleanCompanyInput(raw: Record<string, unknown>): CompanyInput {
  const logo = typeof raw.logoPath === "string" && raw.logoPath.startsWith("/wp-content/uploads/") ? raw.logoPath.slice(0, 500) : null;
  const links = (Array.isArray(raw.links) ? raw.links : [])
    .slice(0, 20)
    .map((l) => {
      const o = (l ?? {}) as Record<string, unknown>;
      const id = Number(o.id);
      return { id: Number.isInteger(id) && id > 0 ? id : undefined, label: cleanText(o.label, 255), url: cleanUrl(o.url), icon: icon(o.icon) };
    })
    .filter((l) => l.label && l.url);
  return {
    name: cleanText(raw.name, 255),
    phone: cleanPhone(raw.phone),
    website: cleanUrl(raw.website),
    address: cleanText(raw.address, 500),
    supportEmail: cleanEmail(raw.supportEmail),
    // HTML, cleaned when shown (RichText's allowlist, as wp_kses_post did).
    descriptionHtml: String(raw.descriptionHtml ?? "").slice(0, 20000),
    logoPath: logo,
    headingFont: font(raw.headingFont),
    bodyFont: font(raw.bodyFont),
    headingColour: cleanColour(raw.headingColour),
    bodyColour: cleanColour(raw.bodyColour),
    accentColour: cleanColour(raw.accentColour),
    buttonTextColour: cleanColour(raw.buttonTextColour),
    downloadColour: cleanColour(raw.downloadColour),
    downloadTextColour: cleanColour(raw.downloadTextColour),
    // Stored as typed; it is scoped to the profile when rendered (branding.ts).
    customCss: String(raw.customCss ?? "").replace(/<\/?style[^>]*>/gi, "").slice(0, MAX_CUSTOM_CSS),
    links,
  };
}

export async function saveCompany(companyId: number, input: CompanyInput) {
  const { links, logoPath, ...fields } = input;
  await db.transaction(async (tx) => {
    await tx
      .update(companies)
      .set({ ...fields, ...(logoPath ? { logoPath } : {}), updatedAt: new Date() })
      .where(eq(companies.id, companyId));
    await replaceLinks(tx, { companyId }, links);
  });
  await refreshCompanyPages(companyId);
}
