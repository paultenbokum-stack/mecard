import { NextResponse } from "next/server";
import { cartView } from "@/lib/cart";
import { shippingOptions } from "@/lib/checkout-shipping";
import { couponForLines } from "@/lib/coupons";
import { rands } from "@/lib/money";
import { currentUserId } from "@/lib/session";

// Delivery options for the address typed at checkout (Bob Go quotes).
export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ options: [] }, { status: 401 });
  const a = (await req.json().catch(() => ({}))) as Record<string, string>;
  const get = (k: string) => String(a[k] ?? "").trim().slice(0, 200);
  const cart = await cartView(userId);
  const coupon = cart.couponCode ? await couponForLines(cart.couponCode, cart.lines.map((l) => ({ productId: l.productId, lineCents: l.lineCents })), userId) : null;
  const { options } = await shippingOptions(
    {
      company: get("billing_company"),
      street: [get("billing_address_1"), get("billing_address_2")].filter(Boolean).join(", "),
      suburb: get("billing_suburb"),
      city: get("billing_city"),
      province: get("billing_state"),
      postcode: get("billing_postcode"),
    },
    cart.lines,
    coupon,
  );
  return NextResponse.json({ options: options.map((o) => ({ id: o.id, label: o.label, price: o.cents ? rands(o.cents) : "Free", note: o.note })) });
}
