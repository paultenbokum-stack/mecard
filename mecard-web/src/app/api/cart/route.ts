import { NextResponse } from "next/server";
import { EMPTY_MINI_CART, miniCart } from "@/lib/mini-cart";
import { currentUserId } from "@/lib/session";

// GET /api/cart/ — the signed-in visitor's basket for the header's mini basket.
// Site pages are cached and the same for everyone, so the header asks here.
export async function GET() {
  const headers = { "Cache-Control": "private, no-store" };
  const userId = await currentUserId();
  return NextResponse.json(userId ? await miniCart(userId) : EMPTY_MINI_CART, { headers });
}
