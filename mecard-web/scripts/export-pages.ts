// Exports the public site pages from a MySQL copy of the WordPress database
// into src/content/pages/*.json, which the (site) routes render.
//
//   npm run export:pages
//
// Re-run it after editing a page on WordPress before the switch-over; after
// that, edit the JSON (or move the page into a component) instead.

import { config } from "dotenv";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";
import { convertPostContent } from "../src/lib/wp-content";

config({ path: ".env.local" });

// Every published page live mecard.co.za still links to from its menus,
// footer, home page and landing pages. Shop, account, blog, Riscura and
// white-label pages are handled elsewhere or dropped.
export const PAGES: { id: number; slug: string; path: string }[] = [
  { id: 95, slug: "home", path: "/" },
  { id: 18519, slug: "how-it-works", path: "/how-it-works/" },
  { id: 79511, slug: "for-teams", path: "/for-teams/" },
  { id: 79727, slug: "cards", path: "/cards/" },
  { id: 79718, slug: "free", path: "/free/" },
  { id: 16012, slug: "gallery", path: "/gallery/" },
  { id: 1203, slug: "contact-us", path: "/contact-us/" },
  { id: 76731, slug: "tsc-privacy-policy", path: "/tsc/privacy-policy/" },
];

// Astra layout per page, as the live <body> classes showed them.
const SEPARATE_CONTAINER = new Set([76731]);

const decode = (s: string) =>
  s.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&amp;/g, "&").replace(/&#8211;/g, "–").replace(/&quot;/g, '"');

async function main() {
  const url = process.env.WP_DATABASE_URL;
  if (!url) throw new Error("WP_DATABASE_URL is not set (see .env.example)");
  const db = await mysql.createConnection({ uri: url, charset: "utf8mb4" });
  const outDir = path.resolve("src/content/pages");
  mkdirSync(outDir, { recursive: true });

  for (const page of PAGES) {
    const [rows] = await db.query<mysql.RowDataPacket[]>("SELECT post_title, post_content, post_modified FROM wp_posts WHERE ID = ? AND post_status = 'publish'", [page.id]);
    if (!rows.length) throw new Error(`Page ${page.id} (${page.path}) is not published`);
    const [meta] = await db.query<mysql.RowDataPacket[]>("SELECT meta_key, meta_value FROM wp_postmeta WHERE post_id = ? AND meta_key IN ('site-post-title', '_yoast_wpseo_title', '_yoast_wpseo_metadesc')", [page.id]);
    const m = Object.fromEntries(meta.map((r) => [r.meta_key as string, r.meta_value as string]));
    const title = decode(String(rows[0].post_title));
    const { html, dropped } = convertPostContent(String(rows[0].post_content));
    const seoTitle = m._yoast_wpseo_title ? m._yoast_wpseo_title.replace(/%%sep%%/g, "-").replace(/%%title%%/g, title).replace(/%%sitename%%/g, "MeCard").replace(/%%[a-z_]+%%/g, "").trim() : `${title} - MeCard`;
    const data = {
      id: page.id,
      path: page.path,
      title,
      seoTitle,
      description: m._yoast_wpseo_metadesc ?? "",
      showTitle: m["site-post-title"] !== "disabled",
      container: SEPARATE_CONTAINER.has(page.id) ? "ast-separate-container" : "ast-plain-container",
      modified: String(rows[0].post_modified),
      html,
    };
    writeFileSync(path.join(outDir, `${page.slug}.json`), JSON.stringify(data, null, 2) + "\n");
    console.log(`✓ ${page.path.padEnd(22)} ${html.length.toString().padStart(6)} chars${dropped.length ? `  dropped: ${dropped.join(" ")}` : ""}`);
  }
  await db.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
