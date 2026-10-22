// Everything that runs on Google Cloud, on this laptop, in one command:
//   npm run dev:all
// Starts Postgres, the Cloud Storage emulator and Mailpit (docker compose),
// runs migrations, seeds the image bucket the first time, then runs the app
// against them (as on Cloud Run) with the hourly job firing on the hour.
//   http://localhost:3000   the app        http://localhost:8025   every email it sends
// Ctrl+C stops the app and the job; `docker compose stop` stops the services.

import { spawn, spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import net from "node:net";

const BUCKETS = { media: "mecard-media", archive: "mecard-uploads" };
const SEED = ".gcs-seed/mecard-uploads";
const GCS = "http://localhost:4443";

// What Cloud Run gets from the deploy, pointed at the local stand-ins.
const appEnv = {
  ...process.env,
  STORAGE_EMULATOR_HOST: GCS,
  MEDIA_BUCKET: BUCKETS.media,
  ARCHIVE_BUCKET: BUCKETS.archive,
  MAILPIT_URL: "http://localhost:8025",
};

const step = (s) => console.log(`\n== ${s}`);
const run = (cmd, env = process.env) => {
  const r = spawnSync(cmd, { stdio: "inherit", shell: true, env });
  if (r.status !== 0) throw new Error(`Failed: ${cmd}`);
};
const portOpen = (port) =>
  new Promise((resolve) => {
    const s = net.connect(port, "127.0.0.1");
    s.once("connect", () => (s.destroy(), resolve(true)));
    s.once("error", () => resolve(false));
  });
async function waitFor(port, name, seconds = 60) {
  for (let i = 0; i < seconds; i++) {
    if (await portOpen(port)) return;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`${name} did not come up on port ${port}.`);
}
async function ensureBucket(name) {
  const res = await fetch(`${GCS}/storage/v1/b/${name}`);
  if (res.ok) return;
  const made = await fetch(`${GCS}/storage/v1/b?project=local`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
  if (!made.ok) throw new Error(`Couldn't create bucket ${name}: ${made.status}`);
}

async function main() {
  if (spawnSync("docker info", { shell: true, stdio: "ignore" }).status !== 0) throw new Error("Docker isn't running: start Docker Desktop first.");
  if (await portOpen(3000)) throw new Error("Something is already running on port 3000 (another `npm run dev`?). Stop it first.");

  step("Local services: Postgres, Cloud Storage emulator, Mailpit");
  run("docker compose up -d");
  await waitFor(5435, "Postgres");
  await waitFor(4443, "Cloud Storage emulator");
  await waitFor(8025, "Mailpit");

  step("Database migrations");
  run("npm run db:migrate");

  if (!existsSync(SEED) || !readdirSync(SEED).length) {
    step("First run: seeding the image bucket with the images the data uses (from ../wp-content/uploads)");
    run(`npm run images:plan -- --stage ${SEED} --referenced`);
    run("docker compose restart gcs");
    await waitFor(4443, "Cloud Storage emulator");
  }
  await ensureBucket(BUCKETS.archive);
  await ensureBucket(BUCKETS.media);

  step("App on http://localhost:3000 (emails: http://localhost:8025)");
  const kids = [spawn("npx next dev", { stdio: "inherit", shell: true, env: appEnv })];
  await waitFor(3000, "The app", 120);
  kids.push(spawn("npx tsx scripts/local-cron.ts", { stdio: "inherit", shell: true, env: appEnv }));

  const stop = () => {
    for (const k of kids) if (!k.killed) k.kill();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

main().catch((e) => {
  console.error(`\n${e.message}`);
  process.exit(1);
});
