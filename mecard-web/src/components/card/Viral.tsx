// Me\Viral\Module surfaces on free (standard) profiles, for visitors:
// the "Get your own MeCard" link under the card, and the call to action shown
// after someone saves the contact.

export function WatermarkStrip() {
  return (
    <div className="mecard-watermark-strip" id="mecard-watermark-strip">
      <a href="/sign-up/?utm_source=watermark&utm_medium=profile&utm_campaign=free_viral" className="mecard-watermark-strip__link" data-mecard-viral="profile_strip">
        Get your own MeCard &rarr;
      </a>
    </div>
  );
}

export function PostSaveCta({ profileId }: { profileId: number }) {
  const signup = `/sign-up/?utm_source=post_save&utm_medium=profile&utm_campaign=free_viral&ref_profile=${profileId}`;
  return (
    <>
      {/* Copied into the Android download message after a save (a <template> would not hydrate). */}
      <div id="mecard-post-save-cta-tpl" hidden>
        <div className="mecard-post-save-cta-inline">
          <p className="mecard-post-save-cta-inline__text">Impressed? Want your own digital business card?</p>
          <a href={signup} className="mecard-post-save-cta-inline__btn" data-mecard-viral="post_save">
            Create your free MeCard &rarr;
          </a>
        </div>
      </div>
      <div className="mecard-post-save-cta" id="mecard-post-save-cta" style={{ display: "none" }}>
        <div className="mecard-post-save-cta__card">
          <button type="button" className="mecard-post-save-cta__close" id="mecard-post-save-cta-close" aria-label="Close">
            &times;
          </button>
          <p className="mecard-post-save-cta__text">Impressed? Want your own digital business card?</p>
          <a href={signup} className="mecard-post-save-cta__btn" id="mecard-post-save-cta-signup" data-mecard-viral="post_save">
            Create your free MeCard
          </a>
        </div>
      </div>
    </>
  );
}
