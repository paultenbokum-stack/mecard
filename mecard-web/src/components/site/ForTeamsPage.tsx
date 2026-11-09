import { PageScripts } from "./PageScripts";
import { TeamPriceBox } from "./TeamPriceBox";
import type { ProductCents } from "@/lib/team-packages";

// /for-teams/: the price comes first, before any signup. Styles: (site)/home.css.

const TICKS = [
  "Order on a headcount, then add your team from a spreadsheet",
  "One logo and colour scheme across every card",
  "Someone left? Archive their profile and deactivate or reassign their card",
  "See who is using their card, person by person",
  "In a rush? Cards in 3 working days in the major metros, once we have your artwork",
];

const TILES = [
  { title: "Add people in bulk", text: "Paste your team from a spreadsheet, and invite staff to edit their own details." },
  { title: "Change branding once", text: "Update your logo or colours and every Pro profile follows." },
  { title: "Handle leavers", text: "Archive a profile so the old details disappear, then deactivate or reassign the card." },
  { title: "See what is working", text: "Views, saves and contact taps for each person, with a list of who has not started." },
];

const FAQ = [
  { q: "Is there a minimum team size?", a: "No. A team of two works the same way as a team of two hundred." },
  { q: "Can staff edit their own profiles?", a: "Yes, if you let them. They can update their contact details while the look and feel stays consistent." },
  { q: "How quickly will our cards arrive?", a: "If you’re in a rush, we can get your cards to you in 3 working days in the major metros once we have your artwork. Just select express shipping at checkout. Everyone’s profile is live as soon as you add them, so your team can share by QR code and WhatsApp in the meantime." },
  { q: "Do I need to buy cards for everyone?", a: "No. Every profile works by QR code, WhatsApp and a shareable link. Add cards for the people who need them." },
  { q: "Can I manage several branches or offices?", a: "Yes. Each branch can be its own company with its own details, all in one dashboard." },
  { q: "Can I pay by bank transfer?", a: "Yes. Choose EFT at checkout and pay when your accounts team is ready." },
];

export function ForTeamsPage({ prices }: { prices: ProductCents }) {
  return (
    <div className="mc-home" id="mc-wp">
      <section className="mc-home__hero">
        <div className="mc-home__wrap mc-teams-hero">
          <div>
            <span className="mc-label">MeCard for teams</span>
            <h1 className="mc-home__hero-title">Cards for your whole team, without the admin</h1>
            <p className="mc-home__lead">Set up everyone at once, keep every card on-brand, and update details without reprinting when someone’s number or email changes.</p>
            <ul className="mc-features">
              {TICKS.map((t) => (
                <li key={t}><i className="fa-solid fa-check mc-home__tick" aria-hidden="true" />{t}</li>
              ))}
            </ul>
          </div>
          <TeamPriceBox prices={prices} />
        </div>
      </section>

      <section className="mc-home__section" aria-labelledby="run-heading">
        <div className="mc-home__wrap">
          <div className="mc-home__head">
            <span className="mc-label">Easy to run</span>
            <h2 id="run-heading">Quick to set up and easy to change</h2>
          </div>
          <div className="mc-teams-tiles mc-reveal">
            {TILES.map((t) => (
              <div className="mc-step mc-teams-tile" key={t.title}>
                <h3 className="mc-step__title">{t.title}</h3>
                <p className="mc-step__desc">{t.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mc-home__section mc-home__section--soft" aria-labelledby="faq-heading">
        <div className="mc-home__wrap mc-home__wrap--narrow">
          <div className="mc-home__head">
            <span className="mc-label">FAQ</span>
            <h2 id="faq-heading">Questions about teams</h2>
          </div>
          <div className="mc-home__faq">
            {FAQ.map((f, i) => (
              <details key={f.q} open={i === 0}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
      <PageScripts />
    </div>
  );
}
