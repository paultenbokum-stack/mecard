"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { buildCompanyFromSiteAction, createCompanyAction } from "@/app/(account)/manage/actions";

// Create a company on Companies, then open its editor in the modal over the
// list (a server-side redirect would open the full page instead). The website
// comes first: the reader fills in the name, logo, colours, fonts and contacts,
// and the editor opens on all of it. "Just a name" is the old form.

export function CreateCompanyForm({
  label,
  suggestedWebsite = "",
  suggestedName = "",
  fromOrder = false,
}: {
  label: string;
  suggestedWebsite?: string;
  /** The company name given at checkout. */
  suggestedName?: string;
  /** Opened from a team order's thank-you page, for the funnel. */
  fromOrder?: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"site" | "name">("site");
  const [site, setSite] = useState(suggestedWebsite);
  const [name, setName] = useState(suggestedName);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const open = (id: number, done: string) => {
    router.push(`/manage/company/${id}/?done=${done}`, { scroll: false });
    router.refresh();
  };

  if (mode === "site") {
    return (
      <form
        className="acc-company-create"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const res = await buildCompanyFromSiteAction(site, name, fromOrder);
            if (!res.ok) {
              setError(`${res.error} You can start with just the name instead.`);
              setMode("name");
              return;
            }
            setError("");
            open(res.id, res.lightLogo ? "company-built-light" : "company-built");
          });
        }}
      >
        <label htmlFor="company-site">Your company website</label>
        <p className="acc__muted">We’ll read it for your logo, colours, fonts and contact details, and you can change anything after.</p>
        <div className="acc-inline-form">
          <input id="company-site" type="text" name="website" required maxLength={300} value={site} onChange={(e) => setSite(e.target.value)} placeholder="yourcompany.co.za" inputMode="url" autoComplete="url" />
          <button type="submit" className="acc-btn acc-btn--primary" disabled={pending || !site.trim()}>
            {pending ? "Reading your website…" : "Build from my website"}
          </button>
        </div>
        <button type="button" className="acc-link" onClick={() => setMode("name")}>
          No website? Start with just the name
        </button>
      </form>
    );
  }

  return (
    <form
      className="acc-inline-form"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await createCompanyAction(name, fromOrder);
          if (!res.ok) return setError(res.error);
          setError("");
          open(res.id, "company-created");
        });
      }}
    >
      {error ? (
        <p className="acc-error" role="alert" style={{ flexBasis: "100%" }}>
          {error}
        </p>
      ) : null}
      <input type="text" name="name" required maxLength={255} value={name} onChange={(e) => setName(e.target.value)} placeholder="Company name" aria-label="Company name" />
      <button type="submit" className="acc-btn acc-btn--primary" disabled={pending}>
        {label}
      </button>
    </form>
  );
}
