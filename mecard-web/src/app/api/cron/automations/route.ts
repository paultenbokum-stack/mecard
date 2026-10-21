import { timingSafeEqual } from "node:crypto";
import { runAutomations } from "@/lib/automations";

// The AutomateWoo replacements, run hourly by Cloud Scheduler:
//   POST /api/cron/automations/   with   Authorization: Bearer $CRON_SECRET
// Every step records what it did, so a retry or an extra run sends nothing twice.

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorised(req: Request) {
  const secret = process.env.CRON_SECRET ?? "";
  const given = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (secret.length < 16 || given.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(secret));
}

async function run(req: Request) {
  if (!authorised(req)) return Response.json({ error: "Not allowed." }, { status: 401 });
  const result = await runAutomations();
  console.log(`[automations] ${JSON.stringify({ ...result, log: undefined })}\n${result.log.join("\n")}`);
  return Response.json(result);
}

export const POST = run;
export const GET = run;
