import type { orderItems, orders } from "@/db/schema";
import { billingLinesOf, deliveryOf, formatAddress, shipsElsewhere } from "@/lib/addresses";
import { BANK_ACCOUNT } from "@/lib/invoice-settings";
import { PAYMENT_LABEL, rands } from "@/lib/money";

// WooCommerce's order details table, billing address and (for EFT orders
// still on hold) the bank details.

type Order = typeof orders.$inferSelect;
type Item = typeof orderItems.$inferSelect;

export function BankDetails({ orderId }: { orderId: number }) {
  return (
    <section className="acc-panel acc-panel--notice">
      <h2>Our bank details</h2>
      <p>Please use your order number as the payment reference. Your order will not be processed until the funds have cleared in our account.</p>
      <table className="shop-table shop-table--compact">
        <tbody>
          <tr>
            <th>Account name</th>
            <td>{BANK_ACCOUNT.accountName}</td>
          </tr>
          <tr>
            <th>Bank</th>
            <td>{BANK_ACCOUNT.bank}</td>
          </tr>
          <tr>
            <th>Account number</th>
            <td>{BANK_ACCOUNT.accountNumber}</td>
          </tr>
          <tr>
            <th>Branch code</th>
            <td>{BANK_ACCOUNT.branchCode}</td>
          </tr>
          <tr>
            <th>Reference</th>
            <td>
              <strong>{orderId}</strong>
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}

export function OrderDetails({ order, items }: { order: Order; items: Item[] }) {
  const address = formatAddress({ firstName: order.billingFirstName, lastName: order.billingLastName, company: order.billingCompany, ...billingLinesOf(order) });
  const delivery = shipsElsewhere(order) ? formatAddress(deliveryOf(order)) : null;
  return (
    <section className="acc-panel acc-panel--white">
      <h2>Order details</h2>
      <table className="shop-table">
        <thead>
          <tr>
            <th>Product</th>
            <th className="shop-num">Total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.id}>
              <td>
                {i.name} <strong>× {i.quantity}</strong>
              </td>
              <td className="shop-num">{rands(i.unitPriceCents * i.quantity)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th>Subtotal:</th>
            <td className="shop-num">{rands(order.subtotalCents)}</td>
          </tr>
          {order.discountCents > 0 ? (
            <tr>
              <th>Discount{order.couponCode ? ` (${order.couponCode})` : ""}:</th>
              <td className="shop-num">-{rands(order.discountCents)}</td>
            </tr>
          ) : null}
          {order.shippingMethod ? (
            <tr>
              <th>Shipping:</th>
              <td className="shop-num">{order.shippingCents > 0 ? `${rands(order.shippingCents)} via ${order.shippingMethod}` : order.shippingMethod}</td>
            </tr>
          ) : null}
          <tr>
            <th>Payment method:</th>
            <td className="shop-num">{PAYMENT_LABEL[order.paymentMethod] ?? order.paymentMethod}</td>
          </tr>
          <tr>
            <th>Total:</th>
            <td className="shop-num">
              <strong>{rands(order.totalCents)}</strong>
            </td>
          </tr>
        </tfoot>
      </table>
      {order.notes ? (
        <p>
          <strong>Note:</strong> {order.notes}
        </p>
      ) : null}
      <h3>Billing address</h3>
      <address className="shop-address">
        {address.map((l) => (
          <span key={l}>
            {l}
            <br />
          </span>
        ))}
        {order.billingPhone}
        <br />
        {order.billingEmail}
      </address>
      {delivery ? (
        <>
          <h3>Shipping address</h3>
          <address className="shop-address">
            {delivery.map((l) => (
              <span key={l}>
                {l}
                <br />
              </span>
            ))}
          </address>
        </>
      ) : null}
    </section>
  );
}
