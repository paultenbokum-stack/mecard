import { imageDeps } from "@/lib/images/config";
import { uploadKey, pickWidth, MASTER_WIDTH } from "@/lib/images/paths";
import { loadMaster, PLACEHOLDER_SVG, renderVariant, type OutputFormat } from "@/lib/images/pipeline";

// Serves every legacy /wp-content/uploads/… URL: the ones on profile and card
// records, and the ones already out in emails, saved vCards and social posts.
// ?w= picks a width (rounded up to a fixed set); ?fmt=jpeg for vCard photos.

export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const key = uploadKey(path.join("/"));
  if (!key) return placeholder(path.join("/"), "bad_path");

  const url = new URL(req.url);
  const width = pickWidth(Number(url.searchParams.get("w")) || MASTER_WIDTH);
  const format: OutputFormat = url.searchParams.get("fmt") === "jpeg" ? "jpeg" : "webp";

  const master = await loadMaster(key, imageDeps());
  if (!master) return placeholder(key, "not_found");

  const body = width === MASTER_WIDTH && format === "webp" ? master : await renderVariant(master, width, format);
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": format === "jpeg" ? "image/jpeg" : "image/webp",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}

function placeholder(path: string, reason: string) {
  // Structured log line: Cloud Logging picks up severity and the fields.
  console.warn(JSON.stringify({ severity: "WARNING", message: "image_miss", path, reason }));
  return new Response(PLACEHOLDER_SVG, {
    headers: {
      "Content-Type": "image/svg+xml",
      // Short, so a restored or newly uploaded image shows up soon.
      "Cache-Control": "public, max-age=300",
    },
  });
}
