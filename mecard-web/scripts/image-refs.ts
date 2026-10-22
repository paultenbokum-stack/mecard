// Every image the app's data points at, as upload keys ("2024/03/photo.jpg"):
// database columns and the exported site pages. Used by images:plan and images:warm.

import { promises as fs } from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { uploadKey } from "../src/lib/images/paths";

/** Every upload path the app's data points at. */
export async function imageReferences(): Promise<Map<string, string>> {
  const refs = new Map<string, string>(); // key → where it was found
  const add = (raw: string | null | undefined, where: string) => {
    if (!raw) return;
    for (const m of raw.match(/\/wp-content\/uploads\/[^\s"'()<>?#]+/g) ?? [raw]) {
      const key = uploadKey(m);
      if (key && !refs.has(key)) refs.set(key, where);
    }
  };
  if (process.env.DATABASE_URL) {
    const sql = postgres(process.env.DATABASE_URL, { max: 1 });
    try {
      for (const r of await sql`SELECT id, logo_path, custom_css, description_html FROM companies`) {
        add(r.logo_path, `company ${r.id} logo`);
        add(r.custom_css, `company ${r.id} CSS`);
        add(r.description_html, `company ${r.id} description`);
      }
      for (const r of await sql`SELECT id, photo_path, company_logo_path FROM profiles WHERE NOT archived`) {
        add(r.photo_path, `profile ${r.id} photo`);
        add(r.company_logo_path, `profile ${r.id} logo`);
      }
      for (const r of await sql`SELECT id, front_path, back_path FROM cards WHERE NOT archived`) {
        add(r.front_path, `card ${r.id} front`);
        add(r.back_path, `card ${r.id} back`);
      }
      for (const r of await sql`SELECT id, image_path, description FROM products`) {
        add(r.image_path, `product ${r.id}`);
        add(r.description, `product ${r.id} description`);
      }
    } finally {
      await sql.end();
    }
  } else {
    console.warn("No DATABASE_URL: only the site pages are checked.");
  }
  const content = path.join(process.cwd(), "src/content");
  for (const f of await fs.readdir(content, { recursive: true })) {
    if (String(f).endsWith(".json")) add(await fs.readFile(path.join(content, String(f)), "utf8"), `page ${f}`);
  }
  return refs;
}

