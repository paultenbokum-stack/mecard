import Link from "next/link";
import { SiteFooter, SiteHeader } from "./SiteChrome";

// A card that isn't linked to a profile yet. WordPress showed an empty page.
// "Activate this card" opens /manage/ with the card picked out (signing in
// first when needed), where its owner links it to a profile.

export function UnlinkedCard({ slug }: { slug: string }) {
  return (
    <>
      <SiteHeader />
      <main id="content" className="mc-unlinked">
        <div className="mc-unlinked__box">
          <h1>This card isn&apos;t set up yet</h1>
          <p>If it&apos;s yours, sign in and link it to your profile. Every tap will then open your digital business card.</p>
          <a className="mc-unlinked__btn" href={`/manage/cards/?activate=${encodeURIComponent(slug)}#activate`}>
            Activate this card
          </a>
          <p className="mc-unlinked__alt">
            Don&apos;t have a MeCard account? <Link href="/sign-up/">Create your free MeCard</Link>
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
