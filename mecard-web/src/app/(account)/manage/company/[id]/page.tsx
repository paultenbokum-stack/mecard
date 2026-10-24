import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, count, eq, ilike, or, sql } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { db } from "@/db/client";
import { companies, profileLinks, profiles, users } from "@/db/schema";
import { Avatar, ConfirmButton, DoneNotice, Pager, Subnav, NewTab } from "@/components/account/Bits";
import { CompanyEditor } from "@/components/account/CompanyEditor";
import { canManageCompany, viewer } from "@/lib/access";
import { COLOUR_FIELDS, FONT_CHOICES, ICON_CHOICES } from "@/lib/company-edit";
import { invitesForProfiles } from "@/lib/invites";
import { PAGE_SIZE } from "@/lib/manage";
import { isPro } from "@/lib/profile-format";
import { COMPANY_LINK_ORDER, getProfileView, type Company, type Profile, type ProfileView } from "@/lib/public-profile";
import { requireUserId } from "@/lib/session";
import { addProfileAction, archiveProfileAction } from "../../actions";
import { cancelInviteAction, inviteAction } from "../../editor-actions";

export const metadata: Metadata = { title: "Edit company" };

type SP = { tab?: string; done?: string; q?: string; page?: string };

export default async function CompanyPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SP> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const companyId = Number(id);
  if (!Number.isInteger(companyId) || companyId <= 0) notFound();
  const v = await viewer(await requireUserId(`/manage/company/${companyId}/`));
  if (!(await canManageCompany(v, companyId))) redirect("/manage/companies/?done=denied");
  const [company] = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1);
  if (!company) notFound();
  const team = sp.tab === "team";

  return (
    <div className="acc__wrap acc__wrap--wide">
      <Subnav active="companies" />
      <p className="acc__eyebrow">Company</p>
      <h1>{company.name}</h1>
      <nav className="acc-tabs" aria-label="Company">
        <Link href={`/manage/company/${companyId}/`} aria-current={team ? undefined : "page"}>
          Details and branding
        </Link>
        <Link href={`/manage/company/${companyId}/?tab=team`} aria-current={team ? "page" : undefined}>
          Team
        </Link>
      </nav>
      <DoneNotice done={sp.done} />
      {team ? <Team company={company} sp={sp} /> : <Editor company={company} />}
    </div>
  );
}

async function Editor({ company }: { company: Company }) {
  // Preview on one of the company's Pro profiles, or a stand-in when it has none.
  const [first] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(and(eq(profiles.companyId, company.id), eq(profiles.archived, false), or(eq(profiles.type, "pro"), eq(profiles.type, "professional"))))
    .orderBy(asc(profiles.id))
    .limit(1);
  const real = first ? await getProfileView(first.id) : null;
  const sample: ProfileView & { company: Company } = real
    ? { ...real, company }
    : { profile: standIn(company), company, companyLinks: await companyLinks(company.id), profileLinks: [] };
  const label = real ? `Preview on ${`${real.profile.firstName} ${real.profile.lastName}`.trim()}’s profile.` : "Preview with a sample person.";
  return <CompanyEditor sample={sample} fonts={FONT_CHOICES} colours={COLOUR_FIELDS} icons={ICON_CHOICES} sampleLabel={label} />;
}

function companyLinks(companyId: number) {
  return db
    .select({ id: profileLinks.id, label: profileLinks.label, url: profileLinks.url, icon: profileLinks.icon })
    .from(profileLinks)
    .where(eq(profileLinks.companyId, companyId))
    .orderBy(...COMPANY_LINK_ORDER);
}

function standIn(c: Company): Profile {
  const now = new Date();
  return {
    id: 0, slug: "preview", ownerId: null, managerId: null, companyId: c.id, type: "pro",
    firstName: "Your", lastName: "Name", jobTitle: "Job title", email: "you@example.com", mobile: "082 000 0000", whatsapp: "", workPhone: "",
    companyName: "", website: "", socials: { linkedin: "https://www.linkedin.com/" }, photoPath: null, companyLogoPath: null,
    hideProfileLinkOnVcard: false, onboarding: {}, archived: false, createdAt: now, updatedAt: now,
  };
}

async function Team({ company, sp }: { company: Company; sp: SP }) {
  const page = Math.max(1, Number(sp.page) || 1);
  const q = sp.q?.trim();
  const where = and(
    eq(profiles.companyId, company.id),
    eq(profiles.archived, false),
    q ? or(ilike(sql`${profiles.firstName} || ' ' || ${profiles.lastName}`, `%${q.replace(/[%_\\]/g, "\\$&")}%`), ilike(profiles.email, `%${q.replace(/[%_\\]/g, "\\$&")}%`)) : undefined,
  );
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({ p: profiles, ownerEmail: users.email })
      .from(profiles)
      .leftJoin(users, eq(users.id, profiles.ownerId))
      .where(where)
      .orderBy(asc(profiles.firstName), asc(profiles.lastName), asc(profiles.id))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ total: count() }).from(profiles).where(where),
  ]);
  const invites = await invitesForProfiles(rows.map((r) => r.p.id));
  const base = `/manage/company/${company.id}/?tab=team`;
  const url = (n: number) => `${base}${q ? `&q=${encodeURIComponent(q)}` : ""}${n > 1 ? `&page=${n}` : ""}`;

  return (
    <>
      <section className="acc-panel">
        <div className="acc-panel__head">
          <h2>People ({total})</h2>
        </div>
        <p className="acc__muted">
          Invite each person by email: once they accept, the profile is theirs to keep up to date and you can still manage it. Archived profiles are on{" "}
          <Link href="/manage/?show=archived">My MeCard Home</Link>.
        </p>
        {total > 8 || q ? (
          <form className="acc-toolbar" action={`/manage/company/${company.id}/`}>
            <input type="hidden" name="tab" value="team" />
            <input type="search" name="q" defaultValue={q ?? ""} placeholder="Search by name or email" aria-label="Search people" />
            <button className="acc-btn" type="submit">
              Search
            </button>
          </form>
        ) : null}
        {rows.length ? (
          <ul className="acc-list">
            {rows.map(({ p, ownerEmail }) => {
              const mine = invites.filter((i) => i.profileId === p.id);
              const open = mine.find((i) => i.status === "pending");
              return (
                <li className="acc-item" key={p.id} id={`p${p.id}`}>
                  <div className="acc-item__main">
                    <Avatar path={p.photoPath} />
                    <div className="acc-item__text">
                      <div className="acc-item__title">
                        {`${p.firstName} ${p.lastName}`.trim() || p.slug} {isPro(p) ? null : <span className="acc-badge">Standard</span>}
                      </div>
                      <div className="acc-item__sub">
                        {[p.jobTitle, ownerEmail ? `owned by ${ownerEmail}` : open ? `invited ${open.email}` : "not claimed yet"].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                  </div>
                  <div className="acc-item__actions">
                    <a className="acc-btn acc-btn--small" href={`/mecard-profile/${p.slug}/`} target="_blank" rel="noopener">
                      View <NewTab />
                    </a>
                    <Link className="acc-btn acc-btn--small acc-btn--primary" href={`/manage/profile/${p.id}/?back=${encodeURIComponent(url(page))}`}>
                      Edit
                    </Link>
                    <form action={archiveProfileAction}>
                      <input type="hidden" name="profile_id" value={p.id} />
                      <input type="hidden" name="archive" value="1" />
                      <input type="hidden" name="back" value={`/manage/?show=archived`} />
                      <ConfirmButton className="acc-btn acc-btn--small acc-btn--danger" confirm="Archive this profile? Its page and any cards linked to it stop working until you restore it.">
                        Archive
                      </ConfirmButton>
                    </form>
                  </div>
                  <details className="acc-details">
                    <summary className="acc-link" style={{ fontSize: 14 }}>
                      {ownerEmail ? "Invite someone else" : open ? "Invite sent" : "Invite this person"}
                    </summary>
                    {open ? (
                      <form action={cancelInviteAction} className="acc-inline-form">
                        <input type="hidden" name="invite_id" value={open.id} />
                        <input type="hidden" name="profile_id" value={p.id} />
                        <input type="hidden" name="company_id" value={company.id} />
                        <span className="acc__muted">
                          Waiting for {open.email} to accept (sent {open.createdAt.toLocaleDateString("en-ZA")}).
                        </span>
                        <ConfirmButton className="acc-btn acc-btn--small acc-btn--danger">Withdraw</ConfirmButton>
                      </form>
                    ) : null}
                    <form action={inviteAction} className="acc-inline-form">
                      <input type="hidden" name="profile_id" value={p.id} />
                      <input type="hidden" name="company_id" value={company.id} />
                      <input type="email" name="email" required defaultValue={open?.email ?? (ownerEmail ? "" : p.email)} placeholder="Their email address" aria-label="Email address to invite" />
                      <ConfirmButton className="acc-btn acc-btn--small acc-btn--primary">{open ? "Send again" : "Send invite"}</ConfirmButton>
                    </form>
                  </details>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="acc-empty">{q ? "Nobody matches your search." : "No profiles in this company yet."}</div>
        )}
        <Pager page={page} total={total} size={PAGE_SIZE} href={url} />
      </section>

      <section className="acc-panel">
        <h2>Add a person</h2>
        <form action={addProfileAction} className="acc-form">
          <input type="hidden" name="company_id" value={company.id} />
          <input type="hidden" name="back" value="/manage/" />
          <div className="acc-grid">
            <div className="acc-field">
              <label htmlFor="tp-first">First name</label>
              <input id="tp-first" name="first_name" type="text" required maxLength={100} />
            </div>
            <div className="acc-field">
              <label htmlFor="tp-last">Last name</label>
              <input id="tp-last" name="last_name" type="text" maxLength={100} />
            </div>
            <div className="acc-field">
              <label htmlFor="tp-job">Job title</label>
              <input id="tp-job" name="job_title" type="text" maxLength={200} />
            </div>
            <div className="acc-field">
              <label htmlFor="tp-email">Email address</label>
              <input id="tp-email" name="email" type="email" maxLength={255} />
            </div>
          </div>
          <div>
            <ConfirmButton className="acc-btn acc-btn--primary">Add to {company.name}</ConfirmButton>
          </div>
        </form>
      </section>
    </>
  );
}
