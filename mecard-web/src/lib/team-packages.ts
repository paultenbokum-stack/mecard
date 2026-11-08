import { PRODUCT } from "./catalog";

// What a team can order per person. Plain data and sums, used in the browser
// and on the server, so the price shown is the price charged.

export type TeamPackageId = "custom" | "classic" | "pro";

export interface TeamPackage {
  id: TeamPackageId;
  name: string;
  text: string;
  /** Basket lines per person. */
  products: number[];
  /** Whether it has something to post. */
  ships: boolean;
}

export const TEAM_PACKAGES: TeamPackage[] = [
  { id: "custom", name: "Custom card and Pro profile", text: "Printed with your own design", products: [PRODUCT.customCard, PRODUCT.proUpgrade], ships: true },
  { id: "classic", name: "Classic card, Pro profile, phone tag", text: "White card with your logo", products: [PRODUCT.classicBundle], ships: true },
  { id: "pro", name: "Pro profile only", text: "Digital, no physical card", products: [PRODUCT.proUpgrade], ships: false },
];

/** At this headcount the main offer becomes a quote. */
export const TEAM_QUOTE_FROM = 20;
export const TEAM_MIN = 2;
export const TEAM_MAX = 500;

/** Where the chosen team size waits in the browser between the price box and the order step. */
export const TEAM_CHOICE_KEY = "mecard_team_choice";

export type ProductCents = Record<number, number>;

export const teamPackage = (id: unknown): TeamPackage => TEAM_PACKAGES.find((p) => p.id === id) ?? TEAM_PACKAGES[0];

/** Price per person in cents, or null when a product's price is missing. */
export function packageEachCents(pkg: TeamPackage, prices: ProductCents): number | null {
  let sum = 0;
  for (const id of pkg.products) {
    const c = prices[id];
    if (typeof c !== "number") return null;
    sum += c;
  }
  return sum;
}

export function clampPeople(v: unknown): number {
  const n = Math.trunc(Number(v));
  if (!Number.isFinite(n)) return TEAM_MIN;
  return Math.min(TEAM_MAX, Math.max(TEAM_MIN, n));
}

/** "R2,990": whole rands, as the price boxes show them. */
export function wholeRands(cents: number): string {
  const r = Math.round(cents / 100);
  return `R${r.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}
