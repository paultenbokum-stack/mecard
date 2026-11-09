// The team flow's progress bar: sign up and pay, then the company is set up in the dashboard.

const STEPS = [
  ["account", "Your account"],
  ["order", "Team size and pay"],
  ["company", "Your company"],
] as const;

export function TeamSteps({ now }: { now: (typeof STEPS)[number][0] }) {
  const at = STEPS.findIndex(([k]) => k === now);
  return (
    <ol className="team-steps" aria-label="Progress">
      {STEPS.map(([k, label], i) =>
        i < at ? (
          <li className="is-done" key={k}>{`${i + 1} ${label}, done`}</li>
        ) : i === at ? (
          <li className="is-now" aria-current="step" key={k}>{`${i + 1} ${label}`}</li>
        ) : (
          <li key={k}>{`${i + 1} ${label}`}</li>
        ),
      )}
    </ol>
  );
}
