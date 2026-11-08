"use client";

import { useRef, useState } from "react";
import { rands, randsToCents } from "@/lib/money";
import { lineDiscountCents, type QuoteItem, SALES_MAX_DISCOUNT_PERCENT, salesMaxDiscountCents } from "@/lib/quote-lines";

type Product = { id: number; name: string; priceCents: number; active: boolean };
type Row = { key: number; productId: string; qty: string; price: string; regularPriceCents?: number };
type Shipping = { productId: number; qty: number; price: string };

const toRands = (c: number) => (c / 100).toFixed(2);
/** What's typed, in cents; empty or not a price falls back to the shop price. */
const priceOf = (typed: string, shop: number) => {
  const c = randsToCents(typed);
  return c === null || Number.isNaN(c) ? shop : c;
};

/**
 * The quote's lines, with live totals: products, then the discount, then shipping.
 * Posts product_id[], qty[] and price[] for linesFromForm; shipping is the last set.
 */
export function QuoteLinesEditor({
  catalogue,
  shippingProduct,
  items,
  shippingLine,
  discountCents,
  locked,
  fixedPrices,
}: {
  catalogue: Product[];
  shippingProduct: Product | null;
  items: QuoteItem[];
  shippingLine: QuoteItem | null;
  discountCents: number;
  locked: boolean;
  /** A salesperson: prices show but can't be changed, and the discount has a limit. */
  fixedPrices: boolean;
}) {
  const nextKey = useRef(items.length);
  const [rows, setRows] = useState<Row[]>(() =>
    items.map((l, key) => ({ key, productId: String(l.productId), qty: String(l.qty), price: toRands(l.unitPriceCents), regularPriceCents: l.regularPriceCents })),
  );
  const [shipping, setShipping] = useState<Shipping | null>(() => (shippingLine ? { productId: shippingLine.productId, qty: shippingLine.qty, price: toRands(shippingLine.unitPriceCents) } : null));
  const [discount, setDiscount] = useState(discountCents ? toRands(discountCents) : "");

  const shop = (id: string) => catalogue.find((p) => String(p.id) === id);
  const update = (key: number, change: Partial<Row>) => setRows((all) => all.map((r) => (r.key === key ? { ...r, ...change } : r)));
  const figures = rows.map((r) => {
    const p = shop(r.productId);
    const qty = Math.max(0, Math.floor(Number(r.qty)) || 0);
    if (!p && r.regularPriceCents === undefined && !r.price) return { total: 0, off: 0 };
    const unit = priceOf(r.price, p?.priceCents ?? 0);
    return { total: unit * qty, off: lineDiscountCents({ qty, unitPriceCents: unit, regularPriceCents: r.regularPriceCents ?? p?.priceCents }) };
  });
  const subtotal = figures.reduce((n, f) => n + f.total, 0);
  const discountNow = Math.min(subtotal, priceOf(discount, 0));
  const shippingCents = shipping ? priceOf(shipping.price, shippingProduct?.priceCents ?? 0) * shipping.qty : 0;
  const total = subtotal - discountNow + shippingCents;
  const maxDiscount = salesMaxDiscountCents(subtotal);
  const shownPrice = (r: Row) => r.price || (shop(r.productId) ? toRands(shop(r.productId)!.priceCents) : "");

  return (
    <>
      <div className="adm-table-wrap">
        <table className="adm-table adm-table--tight">
          <thead>
            <tr>
              <th>Product</th>
              <th>Qty</th>
              <th>Price each (R)</th>
              <th className="adm-num">Discount</th>
              <th className="adm-num">Total</th>
              {locked ? null : <th aria-label="Remove" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, n) => (
              <tr key={r.key}>
                <td>
                  <select
                    name="product_id"
                    value={r.productId}
                    onChange={(e) => update(r.key, { productId: e.target.value, price: "", regularPriceCents: undefined })}
                    className="adm-select"
                    disabled={locked}
                    aria-label={`Line ${n + 1} product`}
                    style={{ width: "100%" }}
                  >
                    <option value="">Choose a product</option>
                    {catalogue
                      .filter((p) => p.active || String(p.id) === r.productId)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({rands(p.priceCents)})
                        </option>
                      ))}
                  </select>
                </td>
                <td>
                  <input name="qty" type="number" min={0} max={5000} value={r.qty} onChange={(e) => update(r.key, { qty: e.target.value })} className="adm-input adm-input--num" disabled={locked} aria-label={`Line ${n + 1} quantity`} />
                </td>
                <td>
                  {fixedPrices ? (
                    <>
                      <input type="hidden" name="price" value={r.price} disabled={locked} />
                      {shownPrice(r)}
                    </>
                  ) : (
                    <input name="price" inputMode="decimal" value={r.price} onChange={(e) => update(r.key, { price: e.target.value })} placeholder="Shop price" className="adm-input adm-input--num" disabled={locked} aria-label={`Line ${n + 1} price`} />
                  )}
                </td>
                <td className="adm-num">{figures[n].off ? `-${rands(figures[n].off)}` : ""}</td>
                <td className="adm-num">{rands(figures[n].total)}</td>
                {locked ? null : (
                  <td className="adm-num">
                    <button type="button" className="adm-link adm-link--danger adm-small" onClick={() => setRows((all) => all.filter((x) => x.key !== r.key))} aria-label={`Remove line ${n + 1}`}>
                      Remove
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={locked ? 5 : 6} className="adm-muted">
                  No products yet.
                </td>
              </tr>
            ) : null}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2} className="adm-num">
                Subtotal
              </td>
              <td colSpan={2} />
              <td className="adm-num">{rands(subtotal)}</td>
              {locked ? null : <td />}
            </tr>
            <tr>
              <td colSpan={2} className="adm-num">
                <label htmlFor="discount">Discount (R)</label>
              </td>
              <td>
                <input id="discount" name="discount" inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0.00" className="adm-input adm-input--num" disabled={locked} />
              </td>
              <td />
              <td className="adm-num">{discountNow ? `-${rands(discountNow)}` : ""}</td>
              {locked ? null : <td />}
            </tr>
            {shipping ? (
              <tr>
                <td colSpan={2} className="adm-num">
                  {fixedPrices ? "Shipping (R)" : <label htmlFor="shipping">Shipping (R)</label>}
                </td>
                <td>
                  <input type="hidden" name="product_id" value={shipping.productId} disabled={locked} />
                  <input type="hidden" name="qty" value={shipping.qty} disabled={locked} />
                  {fixedPrices ? (
                    <>
                      <input type="hidden" name="price" value={shipping.price} disabled={locked} />
                      {shipping.price}
                    </>
                  ) : (
                    <input id="shipping" name="price" inputMode="decimal" value={shipping.price} onChange={(e) => setShipping({ ...shipping, price: e.target.value })} className="adm-input adm-input--num" disabled={locked} />
                  )}
                </td>
                <td />
                <td className="adm-num">{rands(shippingCents)}</td>
                {locked ? null : (
                  <td className="adm-num">
                    <button type="button" className="adm-link adm-link--danger adm-small" onClick={() => setShipping(null)} aria-label="Remove shipping">
                      Remove
                    </button>
                  </td>
                )}
              </tr>
            ) : null}
            <tr>
              <td colSpan={2} className="adm-num">
                <strong>Total</strong>
              </td>
              <td colSpan={2} />
              <td className="adm-num">
                <strong>{rands(total)}</strong>
              </td>
              {locked ? null : <td />}
            </tr>
          </tfoot>
        </table>
      </div>
      {fixedPrices && !locked ? (
        <p className={priceOf(discount, 0) > maxDiscount ? "adm-note" : "adm-help"} role="status">
          You can give a discount of up to {SALES_MAX_DISCOUNT_PERCENT}% on this quote, which is {rands(maxDiscount)}. It comes off your commission.
        </p>
      ) : null}
      {locked ? null : (
        <>
          <div className="adm-head__actions" style={{ justifyContent: "flex-start", marginTop: 10 }}>
            <button
              type="button"
              className="adm-btn"
              onClick={() => {
                const key = nextKey.current++;
                setRows((all) => [...all, { key, productId: "", qty: "1", price: "" }]);
              }}
            >
              <i className="fas fa-plus" aria-hidden="true" /> Add product
            </button>
            {!shipping && shippingProduct ? (
              <button type="button" className="adm-btn" onClick={() => setShipping({ productId: shippingProduct.id, qty: 1, price: toRands(shippingProduct.priceCents) })}>
                <i className="fas fa-truck" aria-hidden="true" /> Add shipping
              </button>
            ) : null}
          </div>
          <p className="adm-help" style={{ marginBottom: 0 }}>
            {fixedPrices ? "" : "Leave a price empty for the shop price. A lower price shows on the quote as a discount on that line. "}Shipping comes after the discount, and checkout then offers delivery as
            included in the quote. Changes count once you save.
          </p>
        </>
      )}
    </>
  );
}
