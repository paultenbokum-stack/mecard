import type { Metadata } from "next";
import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { Subnav } from "@/components/account/Bits";
import { db } from "@/db/client";
import { profiles } from "@/db/schema";
import { canEditProfile, viewer } from "@/lib/access";
import { freeAnalytics, proAnalytics, teamAnalytics } from "@/lib/analytics";
import { parsePeriod, parseTeamSort } from "@/lib/analytics-rules";
import { pendingProUpgrades } from "@/lib/manage";
import { manageViewFor } from "@/lib/manage-view";
import { accountState } from "@/lib/onboarding";
import { displayName } from "@/lib/profile-view";
import { isPro } from "@/lib/profile-format";
import { requireUserId } from "@/lib/session";
import { FreeAnalytics, ProAnalytics } from "./SingleAnalytics";
import { TeamAnalytics, parseGroup } from "./TeamAnalytics";

export const metadata: Metadata = { title: "Analytics" };

type SP = { days?: string; profile?: string; group?: string; sort?: string; page?: string; more?: string };

// /manage/analytics/: one profile (the single view, or a Pro profile opened from
// the team table) or the whole team. Pro profiles report everything, a free
// single profile its 7-day totals, and free profiles on the team view nothing.
export default async function Analytics({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const v = await viewer(await requireUserId("/manage/analytics/"));
  if ((await accountState(v.id)) === "first_time") redirect("/onboarding/");
  const days = parsePeriod(sp.days);
  const mv = await manageViewFor(v.id);
  const opened = Number(sp.profile) || 0;
  const profileId = mv.view === "single" ? mv.profileId : opened;

  if (profileId) {
    const allowed = await canEditProfile(v, profileId);
    const [p] = allowed ? await db.select().from(profiles).where(and(eq(profiles.id, profileId), eq(profiles.archived, false))).limit(1) : [];
    if (!p) redirect("/manage/analytics/");
    if (isPro(p)) {
      const data = await proAnalytics(p.id, days);
      const team = mv.view !== "single";
      return (
        <div className="acc__wrap">
          <Subnav active="analytics" />
          <ProAnalytics data={data} days={days} shown={Math.max(1, Number(sp.more) || 1)} team={team ? { id: p.id, name: displayName(p) } : null} />
        </div>
      );
    }
    // Free profiles report nothing on the team view.
    if (mv.view !== "single") redirect("/manage/analytics/");
    const [t, pending] = await Promise.all([freeAnalytics(p.id), pendingProUpgrades([p.id], v.id)]);
    return (
      <div className="acc__wrap">
        <Subnav active="analytics" />
        <FreeAnalytics totals={t} profileId={p.id} pending={pending.has(p.id)} />
      </div>
    );
  }

  const rows = await teamAnalytics(v, days);
  const pending = await pendingProUpgrades(rows.filter((r) => !r.stats).map((r) => r.id), v.id);
  return (
    <div className="acc__wrap">
      <Subnav active="analytics" />
      <TeamAnalytics rows={rows} pending={new Set(pending.keys())} days={days} group={parseGroup(sp.group)} sort={parseTeamSort(sp.sort)} page={Math.max(1, Number(sp.page) || 1)} />
    </div>
  );
}
