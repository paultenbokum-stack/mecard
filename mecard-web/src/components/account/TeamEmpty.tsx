// The empty Companies, Profiles and My Cards tabs of the team dashboard: how
// the three relate (a company's branding on its profiles, each card opening
// one profile), with this tab's part highlighted, and what to do next.

const PARTS = [
  ["company", "Company", "fa-building", "Branding"],
  ["profiles", "Profiles", "fa-id-card", "One per person"],
  ["cards", "Cards", "fa-credit-card", "Tap or scan"],
] as const;

export type TeamPart = (typeof PARTS)[number][0];

export function TeamEmpty({ active, title, children, actions }: { active: TeamPart; title: string; children: React.ReactNode; actions: React.ReactNode }) {
  return (
    <div className="acc-teamempty">
      <ol className="acc-teamempty__map" aria-label="How companies, profiles and cards fit together">
        {PARTS.map(([key, label, icon, sub], i) => (
          <li key={key} className={key === active ? "is-active" : undefined} aria-current={key === active ? "step" : undefined}>
            {i ? <i className="fa-solid fa-arrow-right acc-teamempty__arrow" aria-hidden="true" /> : null}
            <span className="acc-teamempty__part">
              <i className={`fa-solid ${icon}`} aria-hidden="true" />
              <strong>{label}</strong>
              <span>{sub}</span>
            </span>
          </li>
        ))}
      </ol>
      <h2>{title}</h2>
      <p>{children}</p>
      <div className="acc-actions acc-teamempty__actions">{actions}</div>
    </div>
  );
}
