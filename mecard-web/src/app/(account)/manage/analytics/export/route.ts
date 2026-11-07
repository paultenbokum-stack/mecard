import { viewer } from "@/lib/access";
import { teamAnalytics } from "@/lib/analytics";
import { csvCell, daysAgo, parsePeriod, saveRate } from "@/lib/analytics-rules";
import { requireUserId } from "@/lib/session";

// GET /manage/analytics/export/?days=30: the team table as a spreadsheet. Free
// profiles report no stats, so only Pro profiles are in it.
export async function GET(req: Request) {
  const v = await viewer(await requireUserId("/manage/analytics/"));
  const days = parsePeriod(new URL(req.url).searchParams.get("days"));
  const rows = (await teamAnalytics(v, days)).filter((r) => r.stats);
  const lines = [
    ["Name", "Job title", "Company", "Views", "Saved", "Save rate", "Contacted", "Last view"],
    ...rows.map((r) => [r.name, r.jobTitle, r.company, r.stats!.views, r.stats!.saves, saveRate(r.stats!.views, r.stats!.saves), r.stats!.contactTaps, daysAgo(r.stats!.lastView)]),
  ];
  return new Response(lines.map((l) => l.map(csvCell).join(",")).join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="mecard-analytics-${days}-days.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
