import { SiteFooter, SiteHeader } from "./SiteChrome";

// A card that isn't linked to a profile yet. WordPress showed an empty page;
// cards were (and will be) linked from the profile editor at /manage/, which
// sends visitors who aren't logged in to sign in first.

export function UnlinkedCard() {
  return (
    <>
      <SiteHeader />
      <main id="content" className="mc-unlinked">
        <div className="mc-unlinked__box">
          <h1>This card isn&apos;t set up yet</h1>
          <p>If it&apos;s yours, sign in and link it to your profile. Every tap will then open your digital business card.</p>
          <a className="mc-unlinked__btn" href="/manage/">
            Activate this card
          </a>
          <p className="mc-unlinked__alt">
            Don&apos;t have a MeCard account? <a href="/sign-up/">Create your free MeCard</a>
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
