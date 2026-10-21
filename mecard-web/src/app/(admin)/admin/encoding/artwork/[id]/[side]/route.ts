import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { cards } from "@/db/schema";
import { artworkFilename } from "@/lib/encoding";
import { readArtwork } from "@/lib/encoding-data";
import { requireAdmin } from "@/lib/session";

// One card's original artwork (front or back), for checking a design or reprinting.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string; side: string }> }) {
  const { id, side } = await params;
  await requireAdmin(`/admin/cards/${id}/`);
  if (side !== "front" && side !== "back") return new Response("Not found", { status: 404 });
  const [c] = await db.select({ front: cards.frontPath, back: cards.backPath }).from(cards).where(eq(cards.id, Number(id)));
  const path = side === "front" ? c?.front : c?.back;
  const data = await readArtwork(path ?? null);
  if (!path || !data) return new Response("The original image isn't available.", { status: 404 });
  const name = artworkFilename(path);
  const type = /\.png$/i.test(name) ? "image/png" : /\.jpe?g$/i.test(name) ? "image/jpeg" : "application/octet-stream";
  return new Response(new Uint8Array(data), {
    headers: { "Content-Type": type, "Content-Disposition": `attachment; filename="${name.replace(/"/g, "")}"`, "Cache-Control": "private, no-store" },
  });
}
