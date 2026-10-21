import type { coupons } from "@/db/schema";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { saveCouponAction } from "@/lib/admin-coupon-actions";

type Coupon = typeof coupons.$inferSelect;

const cents = (c: number | null | undefined) => (c == null ? "" : (c / 100).toFixed(2));
/** The expiry date as YYYY-MM-DD in South Africa. */
const saDate = (d: Date | null | undefined) => (d ? new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg" }).format(d) : "");

export function CouponForm({ coupon: c, products, emails = [] }: { coupon?: Coupon; products: { id: number; name: string }[]; emails?: string[] }) {
  return (
    <form action={saveCouponAction} className="adm-form">
      {c ? <input type="hidden" name="coupon_id" value={c.id} /> : null}
      <div className="adm-field">
        <label htmlFor="code">Coupon code</label>
        <input id="code" name="code" required defaultValue={c?.code} className="adm-input" pattern="[A-Za-z0-9_\-]{2,50}" />
        <span className="adm-help">Customers type this in the basket. Not case-sensitive.</span>
      </div>
      <div className="adm-field">
        <label htmlFor="description">Description (only staff see it)</label>
        <input id="description" name="description" defaultValue={c?.description} className="adm-input" />
      </div>

      <div className="adm-field">
        <label htmlFor="discount_type">Discount type</label>
        <select id="discount_type" name="discount_type" defaultValue={c?.discountType ?? "percent"} className="adm-select">
          <option value="percent">Percentage discount</option>
          <option value="fixed_cart">Fixed basket discount (Rands)</option>
        </select>
      </div>
      <div className="adm-field">
        <label htmlFor="amount">Amount</label>
        <input
          id="amount"
          name="amount"
          inputMode="decimal"
          defaultValue={c ? (c.discountType === "percent" ? String(c.amount) : cents(c.amount)) : ""}
          placeholder="e.g. 10 for 10%, or 50.00 for R50"
          className="adm-input"
        />
      </div>
      <div className="adm-field adm-field--full">
        <div className="adm-checkrow">
          <input id="free_shipping" name="free_shipping" type="checkbox" defaultChecked={c?.freeShipping} className="adm-check" />
          <label htmlFor="free_shipping">Free shipping</label>
        </div>
      </div>

      <div className="adm-field">
        <label htmlFor="min_spend">Minimum spend (Rands)</label>
        <input id="min_spend" name="min_spend" inputMode="decimal" defaultValue={cents(c?.minSpendCents)} placeholder="No minimum" className="adm-input" />
        <span className="adm-help">Checked against the basket subtotal, before shipping.</span>
      </div>
      <div className="adm-field">
        <label htmlFor="expires">Valid until</label>
        <input id="expires" name="expires" type="date" defaultValue={saDate(c?.expiresAt)} className="adm-input" />
        <span className="adm-help">Works up to the end of this day. Leave blank to never expire.</span>
      </div>
      <div className="adm-field">
        <label htmlFor="usage_limit">Usage limit per coupon</label>
        <input id="usage_limit" name="usage_limit" type="number" min={0} defaultValue={c?.usageLimit ?? ""} placeholder="Unlimited" className="adm-input" />
      </div>
      <div className="adm-field">
        <label htmlFor="usage_limit_per_user">Usage limit per customer</label>
        <input id="usage_limit_per_user" name="usage_limit_per_user" type="number" min={0} defaultValue={c?.usageLimitPerUser ?? ""} placeholder="Unlimited" className="adm-input" />
      </div>

      <div className="adm-field adm-field--full">
        <span className="adm-label">Products</span>
        <div className="adm-checks">
          {products.map((p) => (
            <div key={p.id} className="adm-checkrow">
              <input id={`p${p.id}`} name="product_ids" type="checkbox" value={p.id} defaultChecked={c?.productIds.includes(p.id)} className="adm-check" />
              <label htmlFor={`p${p.id}`} style={{ fontWeight: 400 }}>
                {p.name}
              </label>
            </div>
          ))}
        </div>
        <span className="adm-help">Tick none for the whole basket, or tick products to discount only those lines.</span>
      </div>

      <div className="adm-field adm-field--full">
        <label htmlFor="allowed_emails">Allowed customers</label>
        <textarea id="allowed_emails" name="allowed_emails" rows={2} defaultValue={emails.join(", ")} className="adm-textarea" placeholder="Anyone" />
        <span className="adm-help">Leave empty for any customer, or list the email addresses of the accounts that may use it.</span>
      </div>

      <div className="adm-field adm-field--full">
        <div className="adm-checkrow">
          <input id="active" name="active" type="checkbox" defaultChecked={c ? c.active : true} className="adm-check" />
          <label htmlFor="active">Active</label>
        </div>
      </div>
      <div className="adm-field--full">
        <SubmitButton className="adm-btn adm-btn--primary" busy="Saving…">
          {c ? "Save coupon" : "Create coupon"}
        </SubmitButton>
      </div>
    </form>
  );
}
