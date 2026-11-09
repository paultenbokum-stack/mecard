"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";
import { readTeamChoice } from "@/components/site/TeamPriceBox";
import { beacon } from "@/lib/beacon";
import { clampPeople, packageEachCents, TEAM_PACKAGES, teamPackage, wholeRands, type ProductCents, type TeamPackageId } from "@/lib/team-packages";
import { placeTeamOrderAction } from "../actions";

// Step 3: a headcount and a package. Names come after paying. Delivery and
// payment are chosen on the existing checkout, which this step leads to.

const ART: Partial<Record<TeamPackageId, { src: string; alt: string }>> = {
  custom: { src: "/images/home/card-custom.webp", alt: "Example of a full-colour custom MeCard" },
  pro: { src: "/images/upsell/alessio-pro-profile.webp", alt: "Example of a Pro profile on a phone" },
};

export function TeamOrder({ prices, company, logo, colour }: { prices: ProductCents; company: string; logo: string | null; colour: string }) {
  const [people, setPeople] = useState(5);
  const [option, setOption] = useState<TeamPackageId>("custom");
  const pkg = teamPackage(option);
  const each = packageEachCents(pkg, prices);

  useEffect(() => {
    beacon("team_step_viewed", { meta: { step: "pay" } });
    const saved = readTeamChoice();
    if (saved) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- the choice from the price box lives in the browser
      setPeople(saved.people);
      setOption(saved.option);
    }
  }, []);

  return (
    <form action={placeTeamOrderAction} className="team-grid" style={{ "--team-colour": colour } as CSSProperties}>
      <input type="hidden" name="people" value={people} />
      <input type="hidden" name="option" value={option} />
      <div className="team-main">
        <div>
          <h1>How big is your team?</h1>
          <p>A rough number is fine, and you don’t need any names yet. You’ll add people after you order.</p>
        </div>
        <div className="team-stepper">
          <span id="team-people" className="team-label">Number of people</span>
          <div className="team-stepper__controls" role="group" aria-labelledby="team-people">
            <button type="button" aria-label="One person fewer" onClick={() => setPeople(clampPeople(people - 1))}>-</button>
            <output aria-live="polite">{people}</output>
            <button type="button" aria-label="One person more" onClick={() => setPeople(clampPeople(people + 1))}>+</button>
          </div>
        </div>
        <h2>What does each person get?</h2>
        <div className="team-packages" role="radiogroup" aria-label="What each person gets">
          {TEAM_PACKAGES.map((p) => {
            const c = packageEachCents(p, prices);
            const art = ART[p.id];
            return (
              <button type="button" role="radio" aria-checked={p.id === option} className={`team-package${p.id === option ? " is-on" : ""}`} key={p.id} onClick={() => setOption(p.id)}>
                <span className="team-package__art">
                  {art ? (
                    <img src={art.src} alt={art.alt} />
                  ) : (
                    <span className="team-mini">
                      {logo ? <img src={logo} alt="" /> : <b>{company || "Your logo"}</b>}
                      <span>Name Surname<br />Job title</span>
                    </span>
                  )}
                </span>
                <b>{p.name}</b>
                <span className="team-package__text">{p.text}{p.id === "custom" ? ". Example shown, add your artwork after ordering" : p.id === "classic" ? ", as shown" : ""}</span>
                {c !== null ? <strong>{wholeRands(c)} each</strong> : null}
              </button>
            );
          })}
        </div>
        <p className="team-note"><Link href="/gallery/">See real customer cards</Link></p>
      </div>

      <aside className="team-side team-panel" aria-label="Order summary">
        <h2>{company || "Your team"}</h2>
        <div className="team-summary__row"><span>{people} x {pkg.name}</span></div>
        <div className="team-summary__total">
          <b>Total, once off</b>
          <strong>{each !== null ? wholeRands(each * people) : ""}</strong>
        </div>
        <p className="team-note">{pkg.ships ? "Delivery is added at checkout, where you can pay online or by bank transfer." : "Nothing to deliver. You can pay online or by bank transfer at checkout."}</p>
        <button type="submit" name="intent" value="pay" className="team-btn team-btn--primary team-btn--block">Continue to payment</button>
        <button type="submit" name="intent" value="quote" className="team-btn team-btn--block">Email me a quote for approval</button>
        <p className="team-note">We print each card once its name is in. Need more or fewer? Tell us before printing.</p>
      </aside>
    </form>
  );
}
