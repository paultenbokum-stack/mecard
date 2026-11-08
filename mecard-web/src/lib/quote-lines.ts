// A quote line's discount, with no server code, so the quote editor can use it in the browser.

export type QuoteItem = { productId: number; name: string; qty: number; unitPriceCents: number; regularPriceCents?: number };

/** The whole line's discount when its price is below the shop price. */
export function lineDiscountCents(i: { qty: number; unitPriceCents: number; regularPriceCents?: number }): number {
  return i.regularPriceCents !== undefined && i.regularPriceCents > i.unitPriceCents ? (i.regularPriceCents - i.unitPriceCents) * i.qty : 0;
}

/** The most a salesperson may take off a basket of products worth this much: their commission rate, so at most all of their commission. */
export const salesMaxDiscountCents = (productsCents: number, rateBps: number) => Math.floor((productsCents * rateBps) / 10000);
