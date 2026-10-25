import type { Metadata } from "next";
import Link from "next/link";
import { DoneNotice, Subnav } from "@/components/account/Bits";
import { viewer } from "@/lib/access";
import { imageUrl } from "@/lib/images/paths";
import { listCompanies } from "@/lib/manage";
import { requireUserId } from "@/lib/session";
import { cookies } from "next/headers";
import { TeamEmpty } from "@/components/account/TeamEmpty";
import { TeamWelcome } from "@/components/account/TeamWelcome";
import { teamProgress } from "@/lib/team-progress";
import { teamWelcomeCookie } from "@/lib/upsell-rules";
import { CreateCompanyForm } from "@/components/account/CreateCompanyForm";

export const metadata: Metadata = { title: "Companies" };

// The team console's Companies tab (company-management-v2 and the add-company form).
export default async function CompaniesPage({ searchParams }: { searchParams: Promise<{ done?: string; add?: string }> }) {
  const sp = await searchParams;
  const v = await viewer(await requireUserId("/manage/companies/"));
  const welcome = (await cookies()).has(teamWelcomeCookie(v.id));
  const [companies, progress] = await Promise.all([listCompanies(v), welcome ? teamProgress(v.id) : null]);

  return (
    <div className="acc__wrap">
      <Subnav active="companies" />
      <p className="acc__eyebrow">For teams</p>
      <div className="acc-pagehead">
        <h1>Companies</h1>
        {companies.length ? (
          <Link className="acc-btn acc-btn--primary" href="/manage/companies/?add=1#add-company">
            <i className="fa-solid fa-plus" aria-hidden="true" /> Add new company
          </Link>
        ) : null}
      </div>
      <p className="acc__lead">A company holds the branding, contact details and buttons shared by every Pro profile in it, and the team of people who use them.</p>
      <DoneNotice done={sp.done} />

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
                    <Link className="acc-btn acc-btn--small acc-btn--primary" href={`/manage/company/${c.id}/`} scroll={false}>
                      Edit company
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <TeamEmpty
            active="company"
            title="Set up your company"
            actions={
              <CreateCompanyForm label="Create your company" />
            }
          >
            A company holds your branding: logo, colours, fonts and the office number and website. Every Pro profile in it uses that look, so the whole team stays on-brand.
          </TeamEmpty>
        )}

        {companies.length ? (
          <details className="acc-details" id="add-company" style={{ marginTop: 16 }} open={!!sp.add}>
            <summary className="acc-btn">+ Add a company</summary>
            <CreateCompanyForm label="Create company" />
          </details>
        ) : (
          <p className="acc__muted" style={{ textAlign: "center", marginBottom: 0 }}>
            Ordering for a larger team? <Link href="/request-quote/">Request a quote for bulk cards</Link>.
          </p>
        )}
      </section>

      {progress ? <TeamWelcome userId={v.id} progress={progress} /> : null}
    </div>
  );
}
