import type { Metadata } from "next";
import Link from "next/link";
import { ConfirmButton, DoneNotice, Subnav } from "@/components/account/Bits";
import { viewer } from "@/lib/access";
import { imageUrl } from "@/lib/images/paths";
import { listCompanies } from "@/lib/manage";
import { requireUserId } from "@/lib/session";
import { cookies } from "next/headers";
import { TeamWelcome } from "@/components/account/TeamWelcome";
import { teamProgress } from "@/lib/team-progress";
import { teamWelcomeCookie } from "@/lib/upsell-rules";
import { addCompanyAction } from "../actions";

export const metadata: Metadata = { title: "Companies" };

// The team console's Companies tab (company-management-v2 and the add-company form).
export default async function CompaniesPage({ searchParams }: { searchParams: Promise<{ done?: string }> }) {
  const sp = await searchParams;
  const v = await viewer(await requireUserId("/manage/companies/"));
  const welcome = (await cookies()).has(teamWelcomeCookie(v.id));
  const [companies, progress] = await Promise.all([listCompanies(v), welcome ? teamProgress(v.id) : null]);

  return (
    <div className="acc__wrap">
      <Subnav active="companies" />
      <p className="acc__eyebrow">For teams</p>
      <h1>Companies</h1>
      <p className="acc__lead">A company holds the branding, contact details and buttons shared by every Pro profile in it, and the team of people who use them.</p>
      <DoneNotice done={sp.done} />
      {progress ? <TeamWelcome userId={v.id} progress={progress} /> : null}

      <section className="acc-panel">
        {companies.length ? (
          <ul className="acc-list">
            {companies.map((c) => {
              const logo = imageUrl(c.logoPath, 320);
              return (
                <li className="acc-item" key={c.id}>
                  <div className="acc-item__main">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {logo ? <img className="acc-thumb" style={{ objectFit: "contain", background: "#fff" }} src={logo} alt="" loading="lazy" /> : <span className="acc-thumb" aria-hidden="true" />}
                    <div className="acc-item__text">
                      <div className="acc-item__title">{c.name}</div>
                      <div className="acc-item__sub">{[`${c.profiles} ${c.profiles === 1 ? "profile" : "profiles"}`, c.website].filter(Boolean).join(" · ")}</div>
                    </div>
                  </div>
                  <div className="acc-item__actions">
                    <Link className="acc-btn acc-btn--small" href={`/manage/company/${c.id}/?tab=team`}>
                      Team
                    </Link>
                    <Link className="acc-btn acc-btn--small acc-btn--primary" href={`/manage/company/${c.id}/`}>
                      Edit company
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="acc-teamstart">
            <h2>Set up your team</h2>
            <p>A company turns your profiles into a team:</p>
            <ul>
              <li>Shared company branding: logo, colours, contact details and buttons on every Pro profile</li>
              <li>Manage your team&rsquo;s profiles and cards in one place, and invite people to take over their own</li>
              <li>Bulk cards for the whole team, with a quote first if you need one</li>
            </ul>
            <p className="acc__muted">
              Ordering for a larger team? <Link href="/request-quote/">Request a quote for bulk cards</Link>.
            </p>
          </div>
        )}

        <details className="acc-details" style={{ marginTop: 16 }} open={!companies.length}>
          <summary className="acc-btn">{companies.length ? "+ Add a company" : "Create a team"}</summary>
          <form action={addCompanyAction} className="acc-inline-form">
            <input type="hidden" name="back" value="/manage/companies/" />
            <input type="text" name="name" required maxLength={255} placeholder="Company name" aria-label="Company name" />
            <ConfirmButton className="acc-btn acc-btn--primary">Create company</ConfirmButton>
          </form>
        </details>
      </section>
    </div>
  );
}
