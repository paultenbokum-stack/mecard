import { NextResponse, type NextRequest } from "next/server";
import { imageUrl } from "@/lib/images/paths";
import { listLibrary, MEDIA_PAGE_SIZE } from "@/lib/media-library";
import { currentUserId } from "@/lib/session";

// GET /api/media/?q=&page=&slot= — the signed-in user's images (and their
// company's) for the media picker, newest first. slot=artwork lists only PNG
// and JPG images (card designs print from the original). Thumbnails are given
// only for images in the active media bucket: browsing never restores an image
// from the archive bucket.

export async function GET(req: NextRequest) {
  const headers = { "Cache-Control": "private, no-store" };
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "Please sign in first." }, { status: 401, headers });
  const sp = req.nextUrl.searchParams;
  const list = await listLibrary(userId, { q: sp.get("q") ?? "", page: Number(sp.get("page")) || 1, printable: sp.get("slot") === "artwork" });
  return NextResponse.json(
    {
      total: list.total,
      page: list.page,
      pageSize: MEDIA_PAGE_SIZE,
      rows: list.rows.map((r) => ({
        id: r.id,
        path: r.path,
        title: r.title || r.filename,
        filename: r.filename,
        shared: r.ownerId !== userId,
        thumb: r.active ? imageUrl(r.path, 320) : null,
        width: r.width,
        height: r.height,
        createdAt: r.createdAt,
      })),
    },
    { headers },
  );
}
