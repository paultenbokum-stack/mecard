// The My Cards tabs and which one a card or tag belongs on. Pure, so tests can
// use it; listCards() applies the same rules in SQL (cardTabSql in manage.ts).
//
// The card's own shipped/design flags aren't reliable for cards imported from
// WordPress (thousands of delivered cards have shipped = false), so the order
// decides with them:
//   archived, or its order cancelled, refunded or failed           → Archived
//   in the basket (not ordered yet)                                → Design pending
//   a card with artwork still to submit, not shipped, order open   → Design pending
//   on an order that isn't completed yet (awaiting payment, being
//     made, shipped and on its way)                                → In progress
//   everything else (order completed, or older cards with no order)
//     linked to a profile                                          → Live
//     not linked                                                   → Live unassigned

export const CARD_TABS = [
  ["design", "Design pending"],
  ["progress", "In progress"],
  ["live", "Live"],
  ["unassigned", "Live unassigned"],
  ["archived", "Archived"],
] as const;

export type CardTab = (typeof CARD_TABS)[number][0];

export const DEAD_ORDER_STATUSES = ["cancelled", "refunded", "failed"];
/** Card types with artwork to design before printing (custom and classic cards; tags have none). */
export const DESIGNED_CARD_TYPES = ["contactcard", "classiccard"];

export interface CardTabInput {
  archived: boolean;
  type: string;
  linked: boolean;
  inBasket: boolean;
  orderStatus: string | null;
  designSubmitted: boolean;
  shipped: boolean;
}

export function cardTab(c: CardTabInput): CardTab {
  if (c.archived || (c.orderStatus && DEAD_ORDER_STATUSES.includes(c.orderStatus))) return "archived";
  if (!c.orderStatus && c.inBasket) return "design";
  const open = !!c.orderStatus && c.orderStatus !== "completed";
  if (open && DESIGNED_CARD_TYPES.includes(c.type) && !c.designSubmitted && !c.shipped) return "design";
  if (open) return "progress";
  return c.linked ? "live" : "unassigned";
}

/** Where an In progress card has got to. */
export function cardProgress(c: { orderStatus: string | null; designSubmitted: boolean; designReceived: boolean; printed: boolean; encoded: boolean; packaged: boolean; shipped: boolean }): string {
  if (c.orderStatus === "pending" || c.orderStatus === "on-hold") return "Awaiting payment";
  if (c.shipped || c.orderStatus === "shipped") return "Shipped";
  if (c.packaged) return "Packed";
  if (c.encoded) return "Encoded";
  if (c.printed) return "Printed";
  if (c.designReceived) return "Printing";
  if (c.designSubmitted) return "Artwork review";
  return "Being made";
}

export const isCardTab = (v: unknown): v is CardTab => CARD_TABS.some(([k]) => k === v);

export const cardTabLabel = (t: CardTab) => CARD_TABS.find(([k]) => k === t)![1];

/**
 * Back to My Cards from a card's editor: the tab it was opened from (?tab=),
 * unless a save moved the card to another tab (a submitted design goes to In
 * progress), which then opens with a "Moved to …" notice (?moved=).
 */
export function cardsListHref(from: CardTab | null | undefined, now: CardTab | null | undefined, extra: Record<string, string> = {}): string {
  const tab = now ?? from;
  const p = new URLSearchParams(tab ? { tab } : {});
  if (from && now && from !== now) p.set("moved", now);
  for (const [k, v] of Object.entries(extra)) p.set(k, v);
  const qs = p.toString();
  return `/manage/cards/${qs ? `?${qs}` : ""}`;
}

/** A /manage/ list URL a profile editor was opened from (?back=), so closing it returns there; anything else is /manage/. */
export function manageBack(raw: unknown): string {
  const s = typeof raw === "string" ? raw : "";
  if (!s.startsWith("/manage/") || s.startsWith("/manage//")) return "/manage/";
  const url = new URL(s, "http://x");
  url.searchParams.delete("done");
  url.searchParams.delete("moved");
  return url.pathname + url.search;
}
