// A quote line's discount, with no server code, so the quote editor can use it in the browser.

export type QuoteItem = { productId: number; name: string; qty: number; unitPriceCents: number; regularPriceCents?: number };

/** The whole line's discount when its price is below the shop price. */
export function lineDiscountCents(i: { qty: number; unitPriceCents: number; regularPriceCents?: number }): number {
  return i.regularPriceCents !== undefined && i.regularPriceCents > i.unitPriceCents ? (i.regularPriceCents - i.unitPriceCents) * i.qty : 0;
}

export const SALES_MAX_DISCOUNT_PERCENT = 10;

/** The most a salesperson may take off a basket of products worth this much. */
export const salesMaxDiscountCents = (productsCents: number) => Math.floor((productsCents * SALES_MAX_DISCOUNT_PERCENT) / 100);
