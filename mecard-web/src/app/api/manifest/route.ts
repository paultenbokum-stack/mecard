import { displayName, getProfileView } from "@/lib/public-profile";
import { shortLabel } from "@/lib/profile-format";
import { siteUrl } from "@/lib/site";

// Web app manifest for "Add to Home Screen" from a card page: the installed
// app opens that profile. Was /wp-json/mecard/v1/manifest (rewritten here).

export async function GET(req: Request) {
  const pid = Number(new URL(req.url).searchParams.get("pid"));
  const view = Number.isInteger(pid) && pid > 0 ? await getProfileView(pid) : null;
  if (!view) return Response.json({ code: "bad_request", message: "Missing pid" }, { status: 400 });

  const label = displayName(view.profile) || "MeCard";
  const start = siteUrl(`/mecard-profile/${view.profile.slug}/`);
  return Response.json(
    {
      id: start,
      name: label,
      short_name: shortLabel(label),
      start_url: start,
      scope: "/",
      display: "standalone",
      background_color: "#ffffff",
      theme_color: "#ffffff",
      icons: [
        { src: "/me192w.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
        { src: "/me512w.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json; charset=utf-8", "Cache-Control": "no-store, max-age=0, must-revalidate" } },
  );
}
