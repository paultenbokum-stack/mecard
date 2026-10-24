import "server-only";
import { inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { profiles } from "@/db/schema";
import { cartView } from "./cart";
import { imageUrl } from "./images/paths";

// What the header's mini basket shows (WooCommerce's widget_shopping_cart):
// the basket lines with their image, quantity and price, and the subtotal.

export interface MiniCartLine {
  key: string;
  name: string;
  /** "For Jane Doe": a Pro upgrade or bundle bought for a profile. */
  forName: string | null;
  url: string;
  image: string | null;
  qty: number;
  priceCents: number;
  lineCents: number;
}

export interface MiniCart {
  count: number;
  lines: MiniCartLine[];
  subtotalCents: number;
}

export const EMPTY_MINI_CART: MiniCart = { count: 0, lines: [], subtotalCents: 0 };

export async function miniCart(userId: number): Promise<MiniCart> {
  const cart = await cartView(userId);
  const profileIds = cart.lines.map((l) => l.profileId).filter((x): x is number => !!x);
  const names = profileIds.length
    ? new Map((await db.select({ id: profiles.id, f: profiles.firstName, l: profiles.lastName }).from(profiles).where(inArray(profiles.id, profileIds))).map((p) => [p.id, `${p.f} ${p.l}`.trim()]))
    : new Map<number, string>();
  return {
    count: cart.lines.reduce((n, l) => n + l.qty, 0),
    subtotalCents: cart.subtotalCents,
    lines: cart.lines.map((l) => ({
      key: l.key,
      name: l.product.name,
      forName: l.profileId ? names.get(l.profileId) || "your profile" : null,
      url: `/product/${l.product.slug}/`,
      image: imageUrl(l.product.imagePath, 160),
      qty: l.qty,
      priceCents: l.product.priceCents,
      lineCents: l.lineCents,
    })),
  };
}
