import Image from "next/image";
import Link from "next/link";
import { PageScripts } from "./PageScripts";

// /how-it-works/: the tap, sharing and the profile. Styles: (site)/home.css.

const SHARES = [
  { kind: "nfc", icon: "fa-solid fa-wifi", title: "NFC phone tag", text: "Tap the tag on the back of your phone against theirs and their browser opens your profile." },
  { kind: "wa", icon: "fa-brands fa-whatsapp", title: "WhatsApp", text: "Type a phone number, hit send, and they get your profile in their WhatsApp chat." },
  { kind: "qr", icon: "fa-solid fa-qrcode", title: "QR code", text: "Show it on your phone, or download it to print on a poster, slide or window decal." },
  { kind: "link", icon: "fa-solid fa-link", title: "Link", text: "Copy your profile link into an email, an SMS or your email signature." },
];

export function HowItWorksPage() {
  return (
    <div className="mc-home" id="mc-wp">
      <section className="mc-home__hero mc-how-hero">
        <div className="mc-home__wrap mc-home__wrap--narrow">
          <span className="mc-label">How MeCard works</span>
          <h1 className="mc-home__hero-title">One tap, you’re saved</h1>
          <p className="mc-home__lead">A card with a chip, a profile that’s always up to date, and your details in their phone in one tap.</p>
          <p className="mc-how-noapp"><i className="fa-solid fa-check" aria-hidden="true" />No app to install, for you or for them</p>
        </div>
      </section>

      <section className="mc-home__section" aria-labelledby="nfc-heading">
        <div className="mc-home__wrap mc-home__feature">
          <div className="mc-home__feature-copy">
            <span className="mc-label">The tap</span>
            <h2 id="nfc-heading">What NFC does</h2>
            <p>There’s a small chip in every MeCard. Hold the card to someone’s phone and their browser opens your profile. They don’t need an app, and there’s nothing to pair.</p>
            <ul className="mc-features">
              <li><i className="fa-solid fa-check mc-home__tick" aria-hidden="true" />Works on modern Android phones and on iPhone 7 and later</li>
              <li><i className="fa-solid fa-check mc-home__tick" aria-hidden="true" />Older phone? They can scan the QR code on the card</li>
              <li><i className="fa-solid fa-check mc-home__tick" aria-hidden="true" />Details changed? The card stays the same and the profile updates</li>
            </ul>
          </div>
          <div className="mc-home__panel mc-home__panel--tint mc-how-card">
            <Image src="/images/home/card-custom.webp" alt="A custom MeCard" width={900} height={563} />
          </div>
        </div>
      </section>

      <section className="mc-home__section mc-home__section--soft" aria-labelledby="share-heading">
        <div className="mc-home__wrap">
          <div className="mc-home__head">
            <span className="mc-label">Sharing</span>
            <h2 id="share-heading">No card on you? Share it anyway</h2>
          </div>
          <div className="mc-home__shares mc-reveal">
            {SHARES.map((s) => (
              <div className={`mc-share mc-share--${s.kind}`} key={s.title}>
                <span className="mc-share__icon"><i className={s.icon} aria-hidden="true" /></span>
                <span className="mc-share__label">{s.title}</span>
                <span className="mc-share__desc">{s.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mc-home__section" aria-labelledby="profile-heading">
        <div className="mc-home__wrap mc-home__feature mc-home__feature--flip">
          <div className="mc-home__feature-copy">
            <span className="mc-label">The profile</span>
            <h2 id="profile-heading">What they see</h2>
            <p>Your photo, role and company, with buttons to call, email or WhatsApp you, and Save contact always in reach.</p>
            <ul className="mc-features">
              <li><i className="fa-solid fa-check mc-home__tick" aria-hidden="true" />Company logo, colours and details, set once for the whole team</li>
              <li><i className="fa-solid fa-check mc-home__tick" aria-hidden="true" />Add it to your home screen and it opens like an app, without an app store</li>
              <li><i className="fa-solid fa-check mc-home__tick" aria-hidden="true" />See your views, saved contacts and contact taps</li>
            </ul>
          </div>
          <div className="mc-how-profile">
            <Image src="/images/upsell/alessio-pro-profile.webp" alt="A MeCard Pro profile on a phone" width={420} height={840} />
          </div>
        </div>
      </section>

      <section className="mc-home__section mc-home__section--tight">
        <div className="mc-home__wrap">
          <div className="mc-cta">
            <div>
              <h2 className="mc-cta__heading">Ready for your team?</h2>
              <p className="mc-cta__text">Work out what your team will cost, with no need to sign up first. Just you? <Link href="/sign-up/?for=me">Create your free profile in 60 seconds</Link></p>
            </div>
            <div className="mc-cta__actions">
              <Link href="/for-teams/" className="mc-btn mc-btn-primary mc-btn-lg">See team pricing</Link>
            </div>
          </div>
        </div>
      </section>
      <PageScripts />
    </div>
  );
}
