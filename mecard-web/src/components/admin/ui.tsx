import Link from "next/link";

export type AdminSearchParams = { q?: string; page?: string; saved?: string; error?: string };

/** Result of an admin action, passed back in the URL (?saved=… / ?error=…). */
export function Flash({ saved, error }: { saved?: string; error?: string }) {
  if (error)
    return (
      <div className="adm-flash adm-flash--error" role="alert">
        {error}
      </div>
    );
  if (saved)
    return (
      <div className="adm-flash adm-flash--ok" role="status">
        {saved}
      </div>
    );
  return null;
}

export function AdminHeader({ title, back, children }: { title: string; back?: { href: string; label: string }; children?: React.ReactNode }) {
  return (
    <div className="adm-head">
      {back ? (
        <Link href={back.href} className="adm-back">
          <i className="fas fa-arrow-left" aria-hidden="true" /> {back.label}
        </Link>
      ) : null}
      <div className="adm-head__row">
        <h1>{title}</h1>
        {children ? <div className="adm-head__actions">{children}</div> : null}
      </div>
    </div>
  );
}

const keepOnly = (keep: Record<string, string | undefined>) => Object.fromEntries(Object.entries(keep).filter((e): e is [string, string] => !!e[1]));

/** A search box that keeps the page's other filters. */
export function SearchBox({ q, placeholder, keep = {} }: { q?: string; placeholder: string; keep?: Record<string, string | undefined> }) {
  const kept = keepOnly(keep);
  return (
    <form className="adm-search" role="search">
      {Object.entries(kept).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <input type="search" name="q" defaultValue={q} placeholder={placeholder} aria-label={placeholder} className="adm-input" />
      <button className="adm-btn">Search</button>
      {q ? (
        <Link href={`?${new URLSearchParams(kept)}`} className="adm-link">
          Clear
        </Link>
      ) : null}
    </form>
  );
}

/** Filter tabs, like WordPress's "All (12) | Processing (3)". */
export function Tabs({ tabs }: { tabs: { href: string; label: string; count?: number; active: boolean }[] }) {
  return (
    <ul className="adm-tabs">
      {tabs.map((t) => (
        <li key={t.href}>
          <Link href={t.href} className={t.active ? "is-active" : undefined} aria-current={t.active ? "page" : undefined}>
            {t.label}
            {t.count !== undefined ? <span className="adm-tabs__n">{t.count}</span> : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export const PAGE_SIZE = 50;

export function pageNumber(page?: string) {
  const n = Number(page);
  return Number.isInteger(n) && n > 0 ? n : 1;
}

export function Pager({ page, total, size = PAGE_SIZE, params = {} }: { page: number; total: number; size?: number; params?: Record<string, string | undefined> }) {
  const pages = Math.max(1, Math.ceil(total / size));
  if (pages <= 1) return <p className="adm-muted">{total} total</p>;
  const kept = keepOnly(params);
  const href = (p: number) => `?${new URLSearchParams({ ...kept, page: String(p) })}`;
  return (
    <div className="adm-pager">
      {page > 1 ? <Link href={href(page - 1)}>‹ Previous</Link> : <span className="adm-muted">‹ Previous</span>}
      <span>
        Page {page} of {pages} ({total} total)
      </span>
      {page < pages ? <Link href={href(page + 1)}>Next ›</Link> : <span className="adm-muted">Next ›</span>}
    </div>
  );
}

// WooCommerce's order status colours, and the same for quotes, entitlements and coupons.
const TONE: Record<string, string> = {
  pending: "grey",
  processing: "green",
  "on-hold": "amber",
  completed: "blue",
  cancelled: "grey",
  refunded: "grey",
  failed: "red",
  new: "amber",
  sent: "blue",
  accepted: "green",
  rejected: "grey",
  expired: "grey",
  in_cart: "grey",
  paid_unassigned: "amber",
  paid_assigned: "green",
  consumed: "blue",
  active: "green",
  inactive: "grey",
  "used-up": "amber",
};

export function Badge({ status, children }: { status: string; children: React.ReactNode }) {
  return <span className={`adm-badge adm-badge--${TONE[status] ?? "grey"}`}>{children}</span>;
}

export function Card({ title, children, className = "" }: { title?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`adm-card ${className}`.trim()}>
      {title ? <h2>{title}</h2> : null}
      {children}
    </section>
  );
}
