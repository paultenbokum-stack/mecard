import { ConfirmButton } from "@/components/account/Bits";
import { viewer } from "@/lib/access";
import { listCompanies } from "@/lib/manage";
import { requireUserId } from "@/lib/session";
import { addProfileAction } from "../../actions";

export async function loadAddProfile() {
  const v = await viewer(await requireUserId("/manage/profile/new/"));
  return { companies: await listCompanies(v) };
}

/** A new profile: the basics, then the full editor opens on it. */
export function AddProfile({ companies }: Awaited<ReturnType<typeof loadAddProfile>>) {
  return (
    <form action={addProfileAction} className="acc-form">
      <input type="hidden" name="back" value="/manage/" />
      <p className="acc__lead" style={{ margin: 0 }}>
        Start with the basics. You can add a photo, contact details and links next.
      </p>
      <div className="acc-grid">
        <div className="acc-field">
          <label htmlFor="np-first">First name</label>
          <input id="np-first" name="first_name" type="text" required maxLength={100} autoComplete="off" />
        </div>
        <div className="acc-field">
          <label htmlFor="np-last">Last name</label>
          <input id="np-last" name="last_name" type="text" maxLength={100} autoComplete="off" />
        </div>
        <div className="acc-field">
          <label htmlFor="np-job">Job title</label>
          <input id="np-job" name="job_title" type="text" maxLength={200} />
        </div>
        <div className="acc-field">
          <label htmlFor="np-email">Email address</label>
          <input id="np-email" name="email" type="email" maxLength={255} />
        </div>
      </div>
      {companies.length ? (
        <div className="acc-field">
          <label htmlFor="np-company">Company</label>
          <select id="np-company" name="company_id" defaultValue="">
            <option value="">None — a profile for myself</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <span className="acc-field__hint">Company profiles are Pro and use the company&rsquo;s branding. Invite the person from the company&rsquo;s Team tab so they can take it over.</span>
        </div>
      ) : null}
      <div>
        <ConfirmButton className="acc-btn acc-btn--primary">Create profile</ConfirmButton>
      </div>
    </form>
  );
}
