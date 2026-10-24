// Cloud Scheduler, locally: POSTs the hourly job (/api/cron/automations/) with
// CRON_SECRET, as deploy/8-scheduler.ps1 sets it up in Google Cloud.
//
//   npm run cron:local                 every hour on the hour (started by npm run dev:all)
//   npm run cron:local -- --every 5    every 5 minutes, to watch it work
//   npm run cron:local -- --once       one run now

import { config } from "dotenv";

config({ path: ".env.local" });

const base = (process.env.LOCAL_APP_URL || "http://localhost:3000").replace(/\/+$/, "");
const secret = process.env.CRON_SECRET ?? "";
const everyArg = process.argv.indexOf("--every");
const everyMinutes = everyArg > 0 ? Number(process.argv[everyArg + 1]) : 0;
const once = process.argv.includes("--once");

async function run() {
  const at = new Date().toLocaleTimeString("en-ZA");
  try {
    const res = await fetch(`${base}/api/cron/automations/`, { method: "POST", headers: { Authorization: `Bearer ${secret}` } });
    const body = (await res.json().catch(() => ({}))) as { log?: string[]; error?: string };
    if (!res.ok) {
      console.log(`[cron ${at}] ${res.status} ${body.error ?? ""}`);
      return;
    }
    console.log(`[cron ${at}] ok${body.log?.length ? `:\n  ${body.log.join("\n  ")}` : ", nothing to do"}`);
  } catch (e) {
    console.log(`[cron ${at}] app not reachable at ${base} (${e instanceof Error ? e.message : e})`);
  }
}

/** Milliseconds to the next run: on the hour, like the "0 * * * *" schedule, or every N minutes. */
function nextDelay() {
  if (everyMinutes > 0) return everyMinutes * 60_000;
  const now = new Date();
  return 3_600_000 - (now.getMinutes() * 60_000 + now.getSeconds() * 1000 + now.getMilliseconds());
}

async function main() {
  if (secret.length < 16) {
    console.error("CRON_SECRET (16+ characters) is missing from .env.local: run .\\deploy\\keys.ps1 -Local, or add one.");
    process.exit(1);
  }
  await run();
  if (once) return;
  const loop = () => setTimeout(async () => {
    await run();
    loop();
  }, nextDelay());
  console.log(`[cron] next runs ${everyMinutes ? `every ${everyMinutes} min` : "on the hour"}`);
  loop();
}

void main();
