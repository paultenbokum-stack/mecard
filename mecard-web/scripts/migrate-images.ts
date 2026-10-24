// WordPress uploads → the archive bucket (ARCHIVE_BUCKET): every original
// image under its upload path ("2024/03/photo.jpg"), which the image route
// turns into WebP masters on first request (src/lib/images/).
//
//   npm run images:plan                                     dry run on ../wp-content/uploads
//   npm run images:plan -- --source D:\live-uploads         dry run on a fresh copy from the live site
//   npm run images:plan -- --source <dir> --stage <empty dir>   also lay out the files to upload (hard links)
//   … --referenced                                          only the images the data uses (the local emulator seed)
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
import { sourceCandidates } from "../src/lib/images/paths";
import { imageReferences as references } from "./image-refs";

config({ path: ".env.local" });

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const source = path.resolve(arg("source") ?? path.join(process.cwd(), "../wp-content/uploads"));
const stage = arg("stage") ? path.resolve(arg("stage")!) : null;
const onlyReferenced = process.argv.includes("--referenced");
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
  // The file each reference resolves to (its first candidate that exists).
  const used = new Set([...refs.keys()].map((key) => sourceCandidates(key).find((k) => uploadKeys.has(k))).filter((k): k is string => !!k));
  const chosen = onlyReferenced ? upload.filter((f) => used.has(f.key)) : upload;

  const lines = [
    `Source: ${source}`,
    `Files found (outside skipped folders): ${all.length} (${mb(sum(all))})`,
    `Images: ${images.length} (${mb(sum(images))})`,
    `To upload (originals, plus resized copies with no original): ${upload.length} (${mb(sum(upload))})`,
    `Left out as resized copies: ${images.length - upload.length}`,
    `Left out as not images: ${all.length - images.length}`,
    `Skipped folders: ${SKIP_DIRS.map((r) => r.source).join(" ")}`,
    "",
    `Images the data refers to: ${refs.size}; found: ${used.size} files (${mb(sum(upload.filter((f) => used.has(f.key))))}); not found: ${missing.length}`,
    ...missing.map(([key, where]) => `  MISSING ${key}  (${where})`),
  ];
  await fs.writeFile(reportFile, lines.join("\n") + "\n");
  console.log(lines.slice(0, 9).join("\n"));
  if (missing.length) console.log(`  (the list is in ${reportFile})`);

  if (stage) {
    if (existsSync(stage) && (await fs.readdir(stage)).length) throw new Error(`--stage must be a new or empty folder: ${stage}`);
    let linked = 0;
    for (const f of chosen) {
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
