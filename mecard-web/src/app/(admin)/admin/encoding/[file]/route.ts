import { type EncodingFile, ENCODING_HEADINGS, artworkFilename, encodingRow, inFile, toCsv } from "@/lib/encoding";
import { encodingCards, readArtwork } from "@/lib/encoding-data";
import { requireAdmin } from "@/lib/session";
import { siteUrl } from "@/lib/site";
import { zip, type ZipEntry } from "@/lib/zip";

const FILES: Record<string, EncodingFile | "images"> = { "encoding.csv": "encoding", "print.csv": "print", "images.zip": "images" };

// encoding.csv and print.csv (the old "Encoding CSV" / "Print CSV" links), and
// images.zip: the print batch's original artwork, named as the print CSV names it.
export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  await requireAdmin("/admin/encoding/");
  const kind = FILES[(await params).file];
  if (!kind) return new Response("Not found", { status: 404 });
  const list = await encodingCards();
  const headers = { "Cache-Control": "private, no-store" };

  if (kind !== "images") {
    const rows = list.filter((c) => inFile(kind, c.type)).map((c) => encodingRow(c, (slug) => siteUrl(`/t/${slug}/`)));
    return new Response(toCsv([ENCODING_HEADINGS, ...rows]), {
      headers: { ...headers, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${kind}.csv"` },
    });
  }

  const entries: ZipEntry[] = [];
  const names = new Set<string>();
  const missing: string[] = [];
  for (const c of list.filter((c) => inFile("print", c.type))) {
    for (const path of [c.frontPath, c.backPath]) {
      const name = artworkFilename(path);
      if (!path || !name || names.has(name)) continue;
      names.add(name);
      const data = await readArtwork(path);
      if (data) entries.push({ name, data });
      else missing.push(`${name} (card ${c.id})`);
    }
  }
  if (missing.length) entries.push({ name: "missing.txt", data: Buffer.from(`These images could not be found:\n${missing.join("\n")}\n`) });
  return new Response(new Uint8Array(zip(entries)), {
    headers: { ...headers, "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="card-images.zip"` },
  });
}
