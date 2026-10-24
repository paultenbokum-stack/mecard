// Warm the image cache: request every image the data uses once, at the width the
// pages use most, so its WebP master is made from the archive bucket now rather
// than when the first visitor asks (Archive-class reads are slow and charged).
//
//   npm run images:warm                                   against the local app (npm run dev:all)
//   npm run images:warm -- --url https://mecard-xxxx.a.run.app   against Cloud Run, before the DNS switch
//
// Safe to repeat: images already warm are served from the media bucket.

import { config } from "dotenv";
import { imageReferences } from "./image-refs";

config({ path: ".env.local" });

const i = process.argv.indexOf("--url");
const base = (i > 0 ? process.argv[i + 1] : "http://localhost:3000").replace(/\/+$/, "");
const WIDTH = 480;
const PARALLEL = 8;

async function main() {
  const keys = [...(await imageReferences()).keys()];
  console.log(`Warming ${keys.length} images at ${base} …`);
  const failed: string[] = [];
  let done = 0;
  let next = 0;
  const started = Date.now();
  async function worker() {
    while (next < keys.length) {
      const key = keys[next++];
      const url = `${base}/wp-content/uploads/${key.split("/").map(encodeURIComponent).join("/")}?w=${WIDTH}`;
      try {
        const res = await fetch(url);
        await res.arrayBuffer();
        // The route answers a missing image with a placeholder: count it as not found.
        if (!res.ok || res.headers.get("content-type")?.includes("svg")) failed.push(`${res.status} ${key}`);
      } catch (e) {
        failed.push(`error ${key} (${e instanceof Error ? e.message : e})`);
      }
      if (++done % 250 === 0) console.log(`  ${done}/${keys.length}`);
    }
  }
  await Promise.all(Array.from({ length: PARALLEL }, worker));
  console.log(`Done in ${Math.round((Date.now() - started) / 1000)}s: ${keys.length - failed.length} warm, ${failed.length} not found.`);
  if (failed.length) console.log(failed.slice(0, 30).map((f) => `  ${f}`).join("\n") + (failed.length > 30 ? `\n  … and ${failed.length - 30} more` : ""));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
