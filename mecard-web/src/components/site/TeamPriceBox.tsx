"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { beacon } from "@/lib/beacon";
import { clampPeople, packageEachCents, TEAM_CHOICE_KEY, TEAM_PACKAGES, TEAM_QUOTE_FROM, teamPackage, wholeRands, type ProductCents, type TeamPackageId } from "@/lib/team-packages";

const ART: Record<TeamPackageId, string> = {
  custom: "/images/home/card-custom.webp",
  classic: "/images/home/card-classic.webp",
  pro: "/images/upsell/alessio-pro-profile.webp",
};

export function saveTeamChoice(people: number, option: TeamPackageId) {
  try {
    localStorage.setItem(TEAM_CHOICE_KEY, JSON.stringify({ people, option }));
  } catch {
    // Private mode: the order step starts from its defaults.
  }
}

export function readTeamChoice(): { people: number; option: TeamPackageId } | null {
  try {
    const raw = JSON.parse(localStorage.getItem(TEAM_CHOICE_KEY) ?? "null") as { people?: unknown; option?: unknown } | null;
    return raw ? { people: clampPeople(raw.people), option: teamPackage(raw.option).id } : null;
  } catch {
    return null;
  }
}

// The team price, worked out before signing up.
export function TeamPriceBox({ prices }: { prices: ProductCents }) {
  const [people, setPeople] = useState(5);
  const [option, setOption] = useState<TeamPackageId>("custom");
  const logged = useRef(false);
  const pkg = teamPackage(option);
  const each = packageEachCents(pkg, prices);
  const large = people >= TEAM_QUOTE_FROM;

  useEffect(() => saveTeamChoice(people, option), [people, option]);

  const changed = (nextPeople: number, nextOption: TeamPackageId) => {
    setPeople(nextPeople);
    setOption(nextOption);
    if (!logged.current) {
      logged.current = true;
      beacon("team_price_changed", { meta: { people: nextPeople, option: nextOption } });
    }
  };
  const started = () => beacon("team_setup_started", { meta: { button: "price_box", people, option } });

  return (
    <div className="mc-teambox">
      <h2>What your team will cost</h2>
      <div className="mc-teambox__row">
        <span id="team-people">How many people?</span>
        <div className="mc-stepper" role="group" aria-labelledby="team-people">
          <button type="button" aria-label="One person fewer" onClick={() => changed(clampPeople(people - 1), option)}>-</button>
          <output aria-live="polite">{people}</output>
          <button type="button" aria-label="One person more" onClick={() => changed(clampPeople(people + 1), option)}>+</button>
        </div>
      </div>
      <div className="mc-teambox__options" role="radiogroup" aria-label="What each person gets">
        {TEAM_PACKAGES.map((p) => {
          const c = packageEachCents(p, prices);
          return (
            <button type="button" role="radio" aria-checked={p.id === option} className={`mc-teambox__option${p.id === option ? " is-on" : ""}`} key={p.id} onClick={() => changed(people, p.id)}>
              <img src={ART[p.id]} alt="" width={72} height={52} />
              <span className="mc-teambox__option-text">
                <b>{p.name}</b>
                <span>{p.text}</span>
              </span>
              {c !== null ? <strong>{wholeRands(c)} each</strong> : null}
            </button>
          );
        })}
      </div>
      <div className="mc-teambox__total">
        <span>{people === 1 ? "1 person" : `${people} people`}, before delivery</span>
        <strong>{each !== null ? wholeRands(each * people) : ""}</strong>
      </div>
      {large ? (
        <>
          <Link className="mc-btn mc-btn-primary mc-teambox__cta" href="/request-quote/">Get a quote for my team</Link>
          <p className="mc-teambox__note">For 20 or more we can load your list for you. <Link href="/sign-up/?for=teams" onClick={started}>Set it up myself</Link></p>
        </>
      ) : (
        <>
          <Link className="mc-btn mc-btn-primary mc-teambox__cta" href="/sign-up/?for=teams" onClick={started}>Set up my team</Link>
          <p className="mc-teambox__note">Once off, no monthly fees. Ordering 20 or more? <Link href="/request-quote/">Get a quote</Link></p>
        </>
      )}
    </div>
  );
}
