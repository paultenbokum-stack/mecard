// WordPress uploads → the archive bucket (ARCHIVE_BUCKET): every original
// image under its upload path ("2024/03/photo.jpg"), which the image route
// turns into WebP masters on first request (src/lib/images/).
//
//   npm run images:plan                                     dry run on ../wp-content/uploads
//   npm run images:plan -- --source D:\live-uploads         dry run on a fresh copy from the live site
//   npm run images:plan -- --source <dir> --stage <empty dir>   also lay out the files to upload (hard links)
//
// Then deploy/9-images.ps1 uploads the staged folder with `gcloud storage rsync`.
//
// What goes: image files (what the image route serves). Left out: WordPress's
// resized copies when their original is there (sizes are regenerated), and
// folders that aren't site images and hold customer data (CSV exports,
// invoices, quote PDFs, logs, private downloads) or local test uploads.
// The report checks every image the data refers to (database columns, the
// exported site pages) against what would be uploaded.

import { config } from "dotenv";
import { promises as fs, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import postgres from "postgres";
import { sourceCandidates, uploadKey } from "../src/lib/images/paths";

config({ path: ".env.local" });

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const source = path.resolve(arg("source") ?? path.join(process.cwd(), "../wp-content/uploads"));
const stage = arg("stage") ? path.resolve(arg("stage")!) : null;
const reportFile = path.resolve(arg("report") ?? path.join(os.tmpdir(), "mecard-images-report.txt"));

// Top-level folders that are not site images.
const SKIP_DIRS = [/^woocommerce_uploads$/, /^wpo_wcpdf_/, /^yith_ywraq$/, /^wc-logs$/, /^views-import-temp$/, /^backup$/, /^mecard$/, /^cache$/];
const IMAGE = /\.(jpe?g|png|gif|webp|avif|bmp|svg)$/i;
const RESIZED = /-\d+x\d+(\.[a-z]+)$/i;

type File = { key: string; bytes: number };

async function walk(dir: string, rel = ""): Promise<File[]> {
  const out: File[] = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const key = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) {
      if (!rel && SKIP_DIRS.some((r) => r.test(e.name))) continue;
      out.push(...(await walk(path.join(dir, e.name), key)));
    } else if (e.isFile()) {
      out.push({ key, bytes: (await fs.stat(path.join(dir, e.name))).size });
    }
  }
  return out;
}

const mb = (b: number) => `${(b / 1024 / 1024).toFixed(1)} MB`;

/** Every upload path the app's data points at. */
async function references(): Promise<Map<string, string>> {
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

async function main() {
  if (!existsSync(source)) throw new Error(`No uploads folder at ${source}`);
  console.log(`Uploads: ${source}`);
  const all = await walk(source);
  const images = all.filter((f) => IMAGE.test(f.key));
  const keys = new Set(images.map((f) => f.key));
  const upload = images.filter((f) => {
    const original = f.key.replace(RESIZED, "$1");
    return original === f.key || !keys.has(original);
  });
  const uploadKeys = new Set(upload.map((f) => f.key));
  const sum = (fs: File[]) => fs.reduce((t, f) => t + f.bytes, 0);

  const refs = await references();
  const missing = [...refs].filter(([key]) => !sourceCandidates(key).some((k) => uploadKeys.has(k)));

  const lines = [
    `Source: ${source}`,
    `Files found (outside skipped folders): ${all.length} (${mb(sum(all))})`,
    `Images: ${images.length} (${mb(sum(images))})`,
    `To upload (originals, plus resized copies with no original): ${upload.length} (${mb(sum(upload))})`,
    `Left out as resized copies: ${images.length - upload.length}`,
    `Left out as not images: ${all.length - images.length}`,
    `Skipped folders: ${SKIP_DIRS.map((r) => r.source).join(" ")}`,
    "",
    `Images the data refers to: ${refs.size}; not found in this folder: ${missing.length}`,
    ...missing.map(([key, where]) => `  MISSING ${key}  (${where})`),
  ];
  await fs.writeFile(reportFile, lines.join("\n") + "\n");
  console.log(lines.slice(0, 9).join("\n"));
  if (missing.length) console.log(`  (the list is in ${reportFile})`);

  if (stage) {
    if (existsSync(stage) && (await fs.readdir(stage)).length) throw new Error(`--stage must be a new or empty folder: ${stage}`);
    let linked = 0;
    for (const f of upload) {
      const to = path.join(stage, ...f.key.split("/"));
      await fs.mkdir(path.dirname(to), { recursive: true });
      try {
        await fs.link(path.join(source, ...f.key.split("/")), to); // same drive: no extra space
      } catch {
        await fs.copyFile(path.join(source, ...f.key.split("/")), to);
      }
      linked++;
    }
    console.log(`Staged ${linked} files in ${stage}. Upload with: .\\deploy\\9-images.ps1 -Stage "${stage}"`);
  } else {
    console.log("Dry run: nothing staged or uploaded.");
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
