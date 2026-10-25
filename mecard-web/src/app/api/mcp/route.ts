import { timingSafeEqual } from "node:crypto";
import { handleRpc } from "@/lib/insights-mcp";

// The mecard-insights MCP endpoint (conversion plan 4.2), read-only. Register it
// in Claude Code (Taggable account only) with:
//   claude mcp add --transport http mecard-insights https://mecard.co.za/api/mcp/ --header "Authorization: Bearer <INSIGHTS_MCP_TOKEN>"

export const dynamic = "force-dynamic";

function authorized(req: Request) {
  const secret = process.env.INSIGHTS_MCP_TOKEN ?? "";
  const given = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  return secret.length >= 32 && given.length === secret.length && timingSafeEqual(Buffer.from(given), Buffer.from(secret));
}

const json = (body: unknown, status = 200) => Response.json(body, { status });

export async function POST(req: Request) {
  if (!authorized(req)) return json({ jsonrpc: "2.0", id: null, error: { code: -32001, message: "Unauthorized" } }, 401);
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, 400);
  }
  if (Array.isArray(body)) {
    const out = (await Promise.all(body.map(handleRpc))).filter(Boolean);
    return out.length ? json(out) : new Response(null, { status: 202 });
  }
  const out = await handleRpc(body as Parameters<typeof handleRpc>[0]);
  return out ? json(out) : new Response(null, { status: 202 });
}

// Stateless: no server-to-client stream and no sessions to end.
export function GET() {
  return new Response("Method not allowed", { status: 405, headers: { Allow: "POST" } });
}
export const DELETE = GET;
