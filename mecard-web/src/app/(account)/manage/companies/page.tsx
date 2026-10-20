import type { Metadata } from "next";
import Link from "next/link";
import { ConfirmButton, DoneNotice, Subnav } from "@/components/account/Bits";
import { viewer } from "@/lib/access";
import { imageUrl } from "@/lib/images/paths";
import { listCompanies } from "@/lib/manage";
import { requireUserId } from "@/lib/session";
import { addCompanyAction } from "../actions";

export const metadata: Metadata = { title: "Companies" };

// The team console's Companies tab (company-management-v2 and the add-company form).
export default async function CompaniesPage({ searchParams }: { searchParams: Promise<{ done?: string }> }) {
  const sp = await searchParams;
  const v = await viewer(await requireUserId("/manage/companies/"));
  const companies = await listCompanies(v);

  return (
    <div className="acc__wrap">
      <Subnav active="companies" />
      <p className="acc__eyebrow">For teams</p>
      <h1>Companies</h1>
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
          <div className="acc-empty">You haven&rsquo;t set up a company yet.</div>
        )}

        <details className="acc-details" style={{ marginTop: 16 }} open={!companies.length}>
          <summary className="acc-btn">+ Add a company</summary>
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
