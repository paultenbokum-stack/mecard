import { ENCODE_TYPES, PRINT_TYPES } from "./admin-cards";

// The Encoding CSV page (Toolset view "encoding-csv", exported by
// mecard-management.js): cards whose design is received but that aren't
// packaged yet. "Encoding CSV" is for GoToTags (custom cards, classic cards,
// phone tags); "Print CSV" for Bartender (custom and classic cards), whose
// Card Front and Card Back columns name the image files downloaded with them.

export type EncodingCard = {
  id: number;
  slug: string;
  type: string;
  label: string;
  nameOnCard: string;
  jobTitleOnCard: string;
  frontPath: string | null;
  backPath: string | null;
  firstName: string | null;
  lastName: string | null;
  jobTitle: string | null;
  orderId: number | null;
  companyName: string | null;
};

export const ENCODING_HEADINGS = ["URL", "Readonly", "Identity", "Notes", "Name", "Job Title", "Card Front", "Card Back"];

/** The file name an image is downloaded under, and named by in the CSV (the old export kept the URL's last part). */
export const artworkFilename = (path: string | null) => (path ? decodeURIComponent(path.split("?")[0].split("/").pop() ?? "") : "");

export function encodingRow(c: EncodingCard, cardUrl: (slug: string) => string): string[] {
  const person = `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim();
  return [
    cardUrl(c.slug),
    "TRUE",
    String(c.id),
    [c.label, person].filter(Boolean).join(" - "),
    c.type === "contactcard" ? person : c.type === "classiccard" ? c.nameOnCard : "",
    c.type === "contactcard" ? (c.jobTitle ?? "") : c.type === "classiccard" ? c.jobTitleOnCard : "",
    artworkFilename(c.frontPath),
    artworkFilename(c.backPath),
  ];
}

export type EncodingFile = "encoding" | "print";

/** The cards staff ticked (?id=1&id=2 or ?id=1,2): whole numbers only, no repeats. */
export function selectedIds(values: string[]): number[] {
  const ids = values.flatMap((v) => v.split(",")).map((v) => Number(v.trim()));
  return [...new Set(ids.filter((n) => Number.isInteger(n) && n > 0))];
}

export const inFile = (file: EncodingFile, type: string) => (file === "encoding" ? ENCODE_TYPES : PRINT_TYPES).includes(type);

/** CSV as the old export wrote it: quoted only when needed, one row per line. */
export function toCsv(rows: string[][]): string {
  const cell = (v: string) => {
    const t = v.trim();
    return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  return rows.map((r) => r.map(cell).join(",")).join("\n") + "\n";
}
