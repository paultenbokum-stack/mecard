import { imageDeps } from "@/lib/images/config";
import { uploadKey } from "@/lib/images/paths";
import { loadMaster, renderVariant } from "@/lib/images/pipeline";
import { displayName, getProfileView } from "@/lib/public-profile";
import { siteUrl } from "@/lib/site";
import { buildVcard, vcardFileName } from "@/lib/vcard";

// GET /vcard/?profile_id=123&profile_name=…&iphone=1 — same URL as WordPress,
// so links already saved in browsers and shared messages keep working.

export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = Number(url.searchParams.get("profile_id"));
  const view = Number.isInteger(id) && id > 0 ? await getProfileView(id) : null;
  if (!view || view.profile.archived) return new Response("Not found", { status: 404 });

  const vcard = buildVcard(view, {
    profileUrl: siteUrl(`/mecard-profile/${view.profile.slug}/`),
    iphone: url.searchParams.get("iphone") === "1",
    photoJpegBase64: await photo(view.profile.photoPath),
  });

  const name = vcardFileName(displayName(view.profile));
  return new Response(vcard, {
    headers: {
      "Content-Type": "text/x-vcard; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name.replace(/[^\x20-\x7e]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "no-store",
    },
  });
}

// WordPress embedded the full-size photo; a 400 px JPEG is plenty for a
// contact picture and keeps the file small enough for every phone.
async function photo(path: string | null) {
  const key = path ? uploadKey(path) : null;
  if (!key) return null;
  try {
    const master = await loadMaster(key, imageDeps());
    return master ? (await renderVariant(master, 400, "jpeg")).toString("base64") : null;
  } catch {
    return null;
  }
}
