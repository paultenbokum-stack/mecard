import Image from "next/image";
import Link from "next/link";
import { PageScripts } from "./PageScripts";

// The homepage, built on the MeCard design system (docs/design-system.md) rather
// than the exported WordPress markup the other site pages use, with the copy of the
// live WordPress homepage (content/pages/home.json). Styles: (site)/home.css.

const FAQ = [
  {
    q: "Are there any monthly or recurring fees?",
    a: "The Free plan is free forever. MeCard Pro is R199 per year — no monthly charges, no surprises. NFC cards are a once-off purchase. Bundles include the first year of Pro.",
  },
  {
    q: "Do I need to buy a card to use MeCard?",
    a: "Not at all. Your digital profile works immediately via QR code, WhatsApp, and a shareable link. The NFC card is a premium add-on for people who want the physical tap-to-share experience.",
  },
  {
    q: "Can I try it before I pay?",
    a: "Absolutely. Start with a free profile — it’s fully functional. You can share it, add it to your home screen, and see your view count. When you’re ready for company branding, analytics, and lead capture, upgrade to Pro. Your profile and data carry forward seamlessly.",
  },
  {
    q: "How does the NFC card work?",
    a: "You hold your MeCard up to someone’s phone. It instantly opens your digital profile — no app required on their end. They can save your contact details with one tap. It works with virtually all modern iPhones and Android phones.",
  },
  {
    q: "What about teams and companies?",
    a: "If you need profiles and cards for your team, tap “For my team” on the signup page. You’ll get team management, centralised branding, and bulk card ordering. Each team member gets their own profile that they can share independently.",
  },
];

function Check() {
  return <i className="fa-solid fa-check mc-home__tick" aria-hidden="true" />;
}

function Cross() {
  return <i className="fa-solid fa-xmark mc-home__cross" aria-hidden="true" />;
}

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

export function HomePage() {
  return (
    <div className="mc-home" id="mc-wp">
      <section className="mc-home__hero">
        <div className="mc-home__wrap mc-home__hero-grid">
          <div className="mc-home__hero-copy">
            <h1 className="mc-home__hero-title">
              Electronic and tech-savvy smart business cards.
              <span className="mc-home__hero-title-sub">Built for functionality. Designed to make a lasting impression.</span>
            </h1>
            <p className="mc-home__lead">Tap your nfc business card on a phone to share contact information instantly</p>
            <p className="mc-home__lead">Create a professional profile in 60 seconds. Share it via NFC, QR code, or WhatsApp. No app to install.</p>
            <div className="mc-home__ctas">
              <Link href="/sign-up/" className="mc-btn mc-btn-primary mc-btn-lg mc-when-out">Create my free Profile</Link>
              <Link href="/manage/" className="mc-btn mc-btn-primary mc-btn-lg mc-when-in">Go to Dashboard</Link>
              <Link href="/for-teams/" className="mc-btn mc-btn-outline mc-btn-lg">For my team</Link>
            </div>
          </div>
          <HeroDevice />
        </div>
      </section>

      <section className="mc-home__section mc-home__section--soft" id="how-it-works" aria-labelledby="how-heading">
        <div className="mc-home__wrap">
          <div className="mc-home__head">
            <span className="mc-label">How it works</span>
            <h2 id="how-heading">Live in 60 Seconds</h2>
          </div>
          <div className="mc-home__steps mc-reveal">
            <div className="mc-step">
              <span className="mc-step__num">1</span>
              <h3 className="mc-step__title">Sign up</h3>
              <p className="mc-step__desc">One-tap login with Google or LinkedIn. No passwords, no forms.</p>
            </div>
            <div className="mc-step">
              <span className="mc-step__num">2</span>
              <h3 className="mc-step__title">Build your profile</h3>
              <p className="mc-step__desc">Add your name, photo, and contact details. We pre-fill what we can.</p>
            </div>
            <div className="mc-step">
              <span className="mc-step__num">3</span>
              <h3 className="mc-step__title">Start sharing</h3>
              <p className="mc-step__desc">QR code, WhatsApp, order an NFC card — your profile is instantly shareable.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mc-home__section mc-home__section--soft" id="pricing" aria-labelledby="pricing-heading">
        <div className="mc-home__wrap">
          <div className="mc-home__head">
            <span className="mc-label">Pricing</span>
            <h2 id="pricing-heading">Start free. Upgrade when you’re ready</h2>
            <p>No monthly fees on Free. MeCard Pro is billed annually — that’s it.</p>
          </div>
          <div className="mc-home__prices mc-reveal">
            <div className="mc-price-card">
              <h3 className="mc-price-card__tier">Free</h3>
              <p className="mc-price-card__price">R0</p>
              <p className="mc-price-card__sub">Free forever — no catch</p>
              <ul className="mc-features">
                <li><Check />Digital profile with shareable link</li>
                <li><Check />QR code &amp; WhatsApp sharing</li>
                <li><Check />Save to home screen (PWA)</li>
                <li><Check />Basic view count</li>
                <li className="is-off"><Cross />Company branding &amp; colours</li>
                <li className="is-off"><Cross />Remove MeCard branding</li>
              </ul>
              <Link href="/sign-up/" className="mc-btn mc-btn-outline">Get started free</Link>
            </div>
            <div className="mc-price-card mc-price-card--featured">
              <span className="mc-badge">Recommended</span>
              <h3 className="mc-price-card__tier mc-price-card__tier--pro">MeCard Pro</h3>
              <p className="mc-price-card__price">R199</p>
              <p className="mc-price-card__sub">Everything in Free, plus:</p>
              <ul className="mc-features">
                <li><Check />WhatsApp button &amp; direct line</li>
                <li><Check />Company branding &amp; custom colours</li>
                <li><Check />Remove MeCard branding</li>
              </ul>
              <Link href="/sign-up/" className="mc-btn mc-btn-primary">Start free, upgrade anytime</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mc-home__section" id="cards" aria-labelledby="cards-heading">
        <div className="mc-home__wrap">
          <div className="mc-home__head">
            <span className="mc-label">NFC smart business cards</span>
            <h2 id="cards-heading">Add a physical card</h2>
            <p>Tap your card on any phone to share your profile instantly. Works with Free or Pro.</p>
          </div>
          <div className="mc-home__products mc-reveal">
            <Link href="/cards/" className="mc-product">
              <Image src="/images/home/card-classic.webp" alt="Classic MeCard" width={900} height={600} />
              <span className="mc-product__name">Classic card</span>
              <span className="mc-product__price">R299</span>
              <span className="mc-product__desc">White + your logo</span>
            </Link>
            <Link href="/cards/" className="mc-product">
              <Image src="/images/home/card-custom.webp" alt="Custom MeCard" width={900} height={563} />
              <span className="mc-product__name">Custom card</span>
              <span className="mc-product__price">R399</span>
              <span className="mc-product__desc">Full custom design</span>
            </Link>
            <Link href="/cards/" className="mc-product mc-product--best">
              <span className="mc-badge">Best value</span>
              <Image src="/images/home/bundle-classic.webp" alt="Classic Bundle" width={900} height={493} />
              <span className="mc-product__name">Classic bundle</span>
              <span className="mc-product__price">R499</span>
              <span className="mc-product__desc">Card + Pro + phone tag</span>
            </Link>
          </div>
        </div>
      </section>

      <section className="mc-home__section" id="faq" aria-labelledby="faq-heading">
        <div className="mc-home__wrap mc-home__wrap--narrow">
          <div className="mc-home__head">
            <span className="mc-label">FAQ</span>
            <h2 id="faq-heading">Common Questions</h2>
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

      <section className="mc-home__section mc-home__section--tight">
        <div className="mc-home__wrap">
          <div className="mc-cta mc-reveal">
            <Signal className="mc-cta__signal" />
            <div>
              <h2 className="mc-cta__heading">Ready to make an impression?</h2>
              <p className="mc-cta__text">Create your free digital business card in 60 seconds. No credit card, no commitment.</p>
            </div>
            <div className="mc-cta__actions">
              <Link href="/sign-up/" className="mc-btn mc-btn-primary mc-btn-lg mc-when-out">Create my free profile</Link>
              <Link href="/manage/" className="mc-btn mc-btn-primary mc-btn-lg mc-when-in">Go to Dashboard</Link>
              <Link href="/for-teams/" className="mc-btn mc-btn-outline">For my team</Link>
            </div>
          </div>
        </div>
      </section>

      <PageScripts />
    </div>
  );
}
