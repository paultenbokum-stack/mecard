import Image from "next/image";
import Link from "next/link";
import { PageScripts } from "./PageScripts";

// The homepage, team first, built on the MeCard design system (docs/design-system.md)
// rather than the exported WordPress markup the other site pages use. Styles: (site)/home.css.

const faq = [
  {
    q: "Are there any monthly or recurring fees?",
    a: "No. Cards and Pro profiles are once-off purchases, and the team dashboard is free.",
  },
  {
    q: "Does everyone need a physical card?",
    a: "No. Every profile works by QR code, WhatsApp and a shareable link. Add cards for the people who need them.",
  },
  {
    q: "What happens when someone leaves?",
    a: "Archive their profile and choose whether to deactivate or reassign their card. Then add the new starter and order their card from the same dashboard.",
  },
  {
    q: "How quickly will we get our cards?",
    a: "If you’re in a rush, we can get your cards to you in 3 working days in the major metros once we have your artwork. Just select express shipping at checkout. Profiles are live as soon as you create them, so your team can start sharing by QR code and WhatsApp while the cards are on their way.",
  },
  {
    q: "How does the NFC card work?",
    a: "You hold your MeCard up to someone’s phone. It instantly opens your digital profile with no app required on their end, and they can save your contact details with one tap. It works with virtually all modern iPhones and Android phones.",
  },
  {
    q: "Can I buy just one?",
    a: "Yes. Create a free profile in 60 seconds and add a card whenever you want.",
  },
];

const STEPS = [
  { title: "Tap your card", text: "Hold your card to any modern iPhone or Android phone, or let them scan the QR code." },
  { title: "They see your profile", text: "It opens instantly in their browser with your photo, details and company branding, and no app is needed." },
  { title: "You’re saved", text: "One tap puts your details in their contacts, ready to call, email or WhatsApp." },
];

const SHARES = [
  { kind: "nfc", icon: "fa-solid fa-wifi", name: "NFC", text: "Tap a card or phone tag" },
  { kind: "wa", icon: "fa-brands fa-whatsapp", name: "WhatsApp", text: "Send it to any number" },
  { kind: "qr", icon: "fa-solid fa-qrcode", name: "QR code", text: "Scan it, or print it anywhere" },
  { kind: "link", icon: "fa-solid fa-link", name: "Link", text: "Email, SMS or signature" },
];

// Sample rows for the product illustrations.
const PEOPLE = [
  { initials: "TM", name: "Thandi Mokoena", title: "Operations manager", status: "Using", tone: "using" },
  { initials: "JB", name: "Johan Botha", title: "Sales manager", status: "Using", tone: "using" },
  { initials: "AP", name: "Aisha Patel", title: "Account manager", status: "Quiet", tone: "quiet" },
  { initials: "NK", name: "Naledi Khumalo", title: "Sales representative", status: "Not started", tone: "new" },
];
const WEEKS = [22, 30, 26, 38, 34, 46, 42, 52, 48, 60, 56, 68];
const RANKS = [
  { name: "Johan Botha", views: 31 },
  { name: "Thandi Mokoena", views: 14 },
  { name: "Aisha Patel", views: 3 },
];

// The signal motif: a dot and rings, drawn in currentColor.
function Signal({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 200 200" aria-hidden="true">
      <circle cx="100" cy="100" r="9" fill="currentColor" />
      <circle cx="100" cy="100" r="34" fill="none" stroke="currentColor" strokeWidth="3" opacity="0.6" />
      <circle cx="100" cy="100" r="62" fill="none" stroke="currentColor" strokeWidth="3" opacity="0.4" />
      <circle cx="100" cy="100" r="92" fill="none" stroke="currentColor" strokeWidth="3" opacity="0.2" />
    </svg>
  );
}

// What someone sees the moment they tap: the contact card, live HTML in a phone frame.
function HeroDevice() {
  return (
    <div className="mc-home__device" aria-hidden="true">
      <Signal className="mc-home__device-signal" />
      <div className="mc-phone">
        <div className="mc-phone__screen">
          <div className="mc-contact">
            <div className="mc-contact__cover">
              <Image src="/images/home/cover-amm.webp" alt="" width={800} height={210} priority />
              <span className="mc-contact__company-mark">AMM</span>
            </div>
            <Image className="mc-contact__avatar" src="/images/home/alessio.webp" alt="" width={160} height={160} priority />
            <p className="mc-contact__name">Alessio Martinez</p>
            <p className="mc-contact__role">Creative Director at AMM Designs</p>
            <p className="mc-contact__url">mecard.co.za/t/alessio</p>
            <div className="mc-contact__actions">
              <span><i className="fa-solid fa-phone" />Call</span>
              <span><i className="fa-solid fa-envelope" />Email</span>
              <span><i className="fa-brands fa-whatsapp" />WhatsApp</span>
            </div>
            <div className="mc-contact__detail">
              <i className="fa-solid fa-envelope" />
              <span>
                <small>Email</small>
                alessio@amm.co.za
              </span>
            </div>
            <span className="mc-contact__save"><i className="fa-solid fa-user-plus" />Save contact</span>
          </div>
        </div>
      </div>
      <Image className="mc-home__device-card" src="/images/home/card-custom.webp" alt="" width={900} height={563} priority />
      <span className="mc-badge mc-badge--connect mc-home__device-saved"><span className="mc-badge__dot" />Saved to contacts</span>
    </div>
  );
}

function ManageShot() {
  return (
    <div className="mc-home__panel mc-home__panel--tint">
      <div className="mc-shot" aria-hidden="true">
        <div className="mc-shot__bar">
          <span /><span /><span />
          <code>mecard.co.za/manage</code>
        </div>
        <div className="mc-shot__head">
          <strong>Riverside Logistics</strong>
          <em>Add people</em>
        </div>
        <div className="mc-shot__tabs">
          <b>People</b><span>Cards</span><span>Branding</span><span>Analytics</span>
        </div>
        <ul className="mc-shot__people">
          {PEOPLE.map((p) => (
            <li key={p.name}>
              <span className="mc-shot__avatar">{p.initials}</span>
              <span className="mc-shot__person"><b>{p.name}</b><small>{p.title}</small></span>
              <span className={`mc-shot__status mc-shot__status--${p.tone}`}>{p.status}</span>
            </li>
          ))}
        </ul>
      </div>
      <span className="mc-home__toast" aria-hidden="true"><i className="fa-solid fa-check" />New starter added</span>
    </div>
  );
}

function AnalyticsShot() {
  const peak = Math.max(...WEEKS);
  const top = Math.max(...RANKS.map((r) => r.views));
  return (
    <div className="mc-home__panel">
      <div className="mc-shot mc-shot--stats" aria-hidden="true">
        <strong className="mc-shot__title">Team connections, last 30 days</strong>
        <dl className="mc-shot__stats">
          <div><dd>124</dd><dt>views</dt></div>
          <div><dd>38</dd><dt>contacts saved</dt></div>
          <div><dd>9</dd><dt>people sharing</dt></div>
        </dl>
        <div className="mc-shot__bars">
          {WEEKS.map((w, i) => (
            <span key={i} style={{ height: `${Math.round((w / peak) * 100)}%`, opacity: i === WEEKS.length - 1 ? 1 : 0.35 }} />
          ))}
        </div>
        <ul className="mc-shot__ranks">
          {RANKS.map((r) => (
            <li key={r.name}>
              <b>{r.name}</b>
              <span className="mc-shot__track"><span style={{ width: `${Math.round((r.views / top) * 100)}%` }} /></span>
              <small>{r.views}</small>
            </li>
          ))}
        </ul>
      </div>
      <p className="mc-home__panel-note">Sample figures</p>
    </div>
  );
}

/** Prices come from the products table. A missing one (the database couldn't be read) is left out. */
type HomePrices = { classic?: string };
/** Per-person team package prices, as /for-teams/ charges them. */
type TeamPrices = { custom?: string; classic?: string; pro?: string };

export function HomePage({ prices, team }: { prices: HomePrices; team: TeamPrices }) {
  const teamItems = [
    { price: team.custom, name: "Custom card + Pro profile", text: "Your own design" },
    { price: team.classic, name: "Classic bundle", text: "Card, Pro profile and phone tag" },
    { price: team.pro, name: "Pro profile only", text: "Digital, no card" },
  ].filter((t) => t.price);
  return (
    <div className="mc-home" id="mc-wp">
      <section className="mc-home__hero">
        <div className="mc-home__wrap mc-home__hero-grid">
          <div className="mc-home__hero-copy">
            <h1 className="mc-home__hero-title">
              Smart business cards for your whole team.
              <span className="mc-home__hero-title-sub">Built for functionality. Designed to make a lasting impression.</span>
            </h1>
            <p className="mc-home__lead">Tap a card on any phone and your contact details are saved instantly, with no app to install.</p>
            <p className="mc-home__lead">Add people, keep everyone on-brand and see who’s using their card, all from one dashboard.</p>
            <div className="mc-home__ctas">
              <Link href="/for-teams/" className="mc-btn mc-btn-primary mc-btn-lg mc-when-out">See team pricing</Link>
              <Link href="/manage/" className="mc-btn mc-btn-primary mc-btn-lg mc-when-in">Go to Dashboard</Link>
              <Link href="/how-it-works/" className="mc-btn mc-btn-outline mc-btn-lg">How it works</Link>
            </div>
            <p className="mc-home__fast-line"><i className="fa-solid fa-truck-fast" aria-hidden="true" />In a rush? Once we have your artwork, we can get your cards to you in 3 working days in the major metros. Just select express shipping at checkout.</p>
            <p className="mc-home__solo-line mc-when-out">Just you? <Link href="/sign-up/?for=me">Create your free profile in 60 seconds</Link></p>
          </div>
          <HeroDevice />
        </div>
      </section>

      <section className="mc-home__section mc-home__section--features" aria-labelledby="why-heading">
        <div className="mc-home__wrap">
          <div className="mc-home__head">
            <span className="mc-label">Why teams choose MeCard</span>
            <h2 id="why-heading">Everything your team needs, in one place</h2>
          </div>

          <div className="mc-home__feature mc-reveal">
            <div className="mc-home__feature-copy">
              <h3>Cards for your whole team</h3>
              <p className="mc-home__lead">Your design or your logo on a card for every person, shipped together and each linked to the right profile.</p>
              <p>In a rush? Once we have your artwork, we can get your cards to you in 3 working days in the major metros. Just select express shipping at checkout. These are once-off prices with no monthly fees, and you can add a card for each new starter.</p>
              <Link href="/for-teams/" className="mc-home__feature-link">See team pricing</Link>
            </div>
            <div className="mc-home__panel mc-home__panel--tint">
              <div className="mc-home__cards" aria-hidden="true">
                <Image className="mc-home__cards-back" src="/images/home/card-classic.webp" alt="" width={900} height={600} />
                <Image className="mc-home__cards-front" src="/images/home/card-custom.webp" alt="" width={900} height={563} />
              </div>
              <dl className="mc-home__price-row">
                {teamItems.map((t) => (
                  <div key={t.name}><dd>{t.price}<span className="mc-home__price-per"> per person</span></dd><dt>{t.name}</dt><small>{t.text}</small></div>
                ))}
              </dl>
            </div>
          </div>

          <div className="mc-home__feature mc-home__feature--flip mc-reveal">
            <div className="mc-home__feature-copy">
              <h3>Every way to share</h3>
              <p className="mc-home__lead">However you meet someone, your details land in their phone in one tap, with no app needed on either side.</p>
            </div>
            <div className="mc-home__panel">
              <div className="mc-home__share-grid">
                {SHARES.map((s) => (
                  <div className={`mc-share mc-share--${s.kind}`} key={s.name}>
                    <span className="mc-share__icon"><i className={s.icon} aria-hidden="true" /></span>
                    <span>
                      <span className="mc-share__label">{s.name}</span>
                      <span className="mc-share__desc">{s.text}</span>
                    </span>
                  </div>
                ))}
              </div>
              <p className="mc-home__saved-line"><span className="mc-badge mc-badge--connect"><span className="mc-badge__dot" />Saved to their contacts in one tap</span></p>
            </div>
          </div>

          <div className="mc-home__feature mc-reveal">
            <div className="mc-home__feature-copy">
              <h3>Easy online management</h3>
              <p className="mc-home__lead">Keep everyone in one place, and update your branding once for every profile to follow.</p>
              <p>When someone leaves, archive their profile and deactivate or reassign their card, then add the new starter in a few clicks.</p>
            </div>
            <ManageShot />
          </div>

          <div className="mc-home__feature mc-home__feature--flip mc-reveal">
            <div className="mc-home__feature-copy">
              <h3>See the connections your team makes</h3>
              <p className="mc-home__lead">See how often each person’s profile is opened and their details are saved, so you know the cards are making connections and can spot who hasn’t started yet.</p>
            </div>
            <AnalyticsShot />
          </div>
        </div>
      </section>

      <section className="mc-home__section mc-home__section--soft" id="how-it-works" aria-labelledby="how-heading">
        <div className="mc-home__wrap">
          <div className="mc-home__head">
            <span className="mc-label">How it works</span>
            <h2 id="how-heading">One tap, you’re saved</h2>
          </div>
          <div className="mc-home__steps mc-reveal">
            {STEPS.map((s, i) => (
              <div className="mc-step" key={s.title}>
                <span className="mc-step__num">{i + 1}</span>
                <h3 className="mc-step__title">{s.title}</h3>
                <p className="mc-step__desc">{s.text}</p>
              </div>
            ))}
          </div>
          <p className="mc-home__center-link"><Link href="/how-it-works/">See how it works</Link></p>
        </div>
      </section>

      <section className="mc-home__solo" aria-labelledby="solo-heading">
        <div className="mc-home__wrap mc-home__solo-inner">
          <div>
            <h2 id="solo-heading">Just for you?</h2>
            <p>Your free profile is live in 60 seconds, ready to share by QR code and WhatsApp. Add a card from {prices.classic ?? "the shop"} whenever you want.</p>
          </div>
          <Link href="/sign-up/?for=me" className="mc-btn mc-btn-outline">Create my free profile</Link>
        </div>
      </section>

      <section className="mc-home__section mc-home__section--faq" id="faq" aria-labelledby="faq-heading">
        <div className="mc-home__wrap mc-home__wrap--narrow">
          <div className="mc-home__head">
            <span className="mc-label">FAQ</span>
            <h2 id="faq-heading">Common questions</h2>
          </div>
          <div className="mc-home__faq">
            {faq.map((f, i) => (
              <details key={f.q} open={i === 0}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="mc-home__section mc-home__section--tight">
        <div className="mc-home__wrap">
          <div className="mc-cta mc-reveal">
            <Signal className="mc-cta__signal" />
            <div>
              <h2 className="mc-cta__heading">Ready to make an impression?</h2>
              <p className="mc-cta__text">Work out what your team will cost, with no need to sign up first.</p>
            </div>
            <div className="mc-cta__actions">
              <Link href="/for-teams/" className="mc-btn mc-btn-primary mc-btn-lg mc-when-out">See team pricing</Link>
              <Link href="/manage/" className="mc-btn mc-btn-primary mc-btn-lg mc-when-in">Go to Dashboard</Link>
            </div>
          </div>
        </div>
      </section>

      <PageScripts />
    </div>
  );
}
