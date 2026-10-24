"use client";

import Link from "next/link";
import { useState } from "react";
import { removeBundleAction } from "@/app/(account)/manage/actions";
import { startProUpgradeAction } from "@/app/(account)/manage/editor-actions";
import { PRODUCT } from "@/lib/catalog";
import { imageUrl } from "@/lib/images/paths";
import { addToCartAction } from "@/lib/shop-actions";
import { offerPrice } from "@/lib/upsell-rules";
import type { Upsells } from "@/lib/upsells";

// The upsells and offers of WordPress's "My MeCard Home"
// (class-me-single-manage.php), in its wording: the Pro upsell, the bundle
// journey, and the bundle and card offers. Which ones show is upsellRules().

const IMG = "/images/upsell";

/** pro_upsell_clicked in the event store (as the share panel's upsell). */
function trackUpsell(context: string, profileId?: number | null) {
  const body = JSON.stringify({ event_name: "pro_upsell_clicked", profile_id: profileId ?? null, meta: { context }, referrer: document.referrer || null });
  try {
    if (navigator.sendBeacon) navigator.sendBeacon("/api/track/", new Blob([body], { type: "application/json" }));
    else void fetch("/api/track/", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true });
  } catch {
    // Tracking never blocks the upgrade.
  }
}

/**
 * Starts the upgrade without checkout first: Pro editing unlocks at once and the
 * upgrade waits in the basket to be paid (startProUpgradeAction).
 */
function StartUpgrade({ profileId, context, className, children }: { profileId: number; context: string; className: string; children: React.ReactNode }) {
  return (
    <form action={startProUpgradeAction} onSubmit={() => trackUpsell(context, profileId)}>
      <input type="hidden" name="profile_id" value={profileId} />
      <button type="submit" className={className}>
        {children}
      </button>
    </form>
  );
}

/** The compact "Upgrade" on each free profile in the list. */
export function UpgradeButton({ profileId }: { profileId: number }) {
  return (
    <StartUpgrade profileId={profileId} context="manage_profile_row" className="acc-btn acc-btn--small acc-btn--cta">
      Upgrade
    </StartUpgrade>
  );
}

/** "Upgrade to Pro / Supercharge your profile", with the standard → Pro comparison. */
export function ProUpsell({ u }: { u: Upsells }) {
  const [profileId, setProfileId] = useState(u.freeProfiles[0]?.id ?? 0);
  if (!u.proUpsell || !profileId) return null;
  return (
    <section className="acc-panel acc-upsell">
      <p className="acc-upsell__kicker">Upgrade to Pro</p>
      <h2>Supercharge your profile</h2>
      <div className="acc-upsell__compare">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${IMG}/alessio-standard-profile-phone.webp`} width={456} height={875} alt="Standard profile preview: a free MeCard profile with name, photo and contact buttons" loading="lazy" />
        <span className="acc-upsell__arrow" aria-hidden="true">
          A &rarr; B
        </span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${IMG}/alessio-pro-profile.webp`} width={438} height={852} alt="Pro profile preview: the same profile with company branding, company info and extra links" loading="lazy" />
      </div>
      <ul className="acc-upsell__benefits">
        <li>Customise look and feel to your company branding</li>
        <li>Add company info</li>
        <li>Extra buttons and links</li>
      </ul>
      {u.upgradesReady > 0 ? (
        <p>
          You have {u.upgradesReady === 1 ? "a Pro upgrade" : `${u.upgradesReady} Pro upgrades`} ready to use.{" "}
          <Link href={`/manage/profile/${profileId}/`}>Apply it in the profile editor.</Link>
        </p>
      ) : (
        <>
          {u.prices.pro !== null ? <p className="acc-upsell__price">{offerPrice(u.prices.pro)} once off</p> : null}
          <div className="acc-actions">
            {u.freeProfiles.length > 1 ? (
              <select value={profileId} onChange={(e) => setProfileId(Number(e.target.value))} aria-label="Profile to upgrade">
                {u.freeProfiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            ) : null}
            <StartUpgrade profileId={profileId} context="manage_panel" className="acc-btn acc-btn--primary">
              Design Pro Profile
            </StartUpgrade>
          </div>
        </>
      )}
    </section>
  );
}

/** "Bundle in progress": a bundle is in the basket, so finish setting it up. */
export function BundleJourney({ u }: { u: Upsells }) {
  if (!u.journey || !u.bundle) return null;
  const custom = u.bundle.type === "custom";
  const profileHref = u.bundle.profileId ? `/manage/profile/${u.bundle.profileId}/` : "/manage/";
  return (
    <section className="acc-panel acc-upsell acc-upsell--journey">
      <p className="acc-upsell__kicker">Bundle in progress</p>
      <h2>{custom ? "Finish setting up your custom bundle" : "Finish setting up your classic bundle"}</h2>
      <p>Your bundle is already in your basket. The quickest path now is to configure your Pro profile, confirm the bundle items, and then checkout.</p>
      <ol className="acc-upsell__steps">
        <li>
          <strong>Step 1.</strong> Configure your Pro profile
        </li>
        <li>
          <strong>Step 2.</strong> {custom ? "Configure your custom card and confirm your phone tag" : "Confirm your classic card and phone tag"}
        </li>
        <li>
          <strong>Step 3.</strong> Checkout
        </li>
      </ol>
      <div className="acc-actions">
        <Link className="acc-btn acc-btn--primary" href={profileHref} scroll={false}>
          Continue profile setup
        </Link>
        <Link className="acc-btn" href="/manage/cards/?tab=design">
          Confirm bundle items
        </Link>
        <Link className="acc-btn acc-btn--cta" href="/checkout/">
          Checkout
        </Link>
        <form action={removeBundleAction}>
          <input type="hidden" name="key" value={u.bundle.key} />
          <button type="submit" className="acc-btn">
            Remove bundle
          </button>
        </form>
      </div>
    </section>
  );
}

function Toggle<T extends string>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="acc-upsell__switch" role="group" aria-label={label}>
      {options.map(([k, text]) => (
        <button key={k} type="button" className={`acc-btn acc-btn--small${value === k ? " is-active" : ""}`} aria-pressed={value === k} onClick={() => onChange(k)}>
          {text}
        </button>
      ))}
    </div>
  );
}

function AddForm({ productId, profileId, next, label }: { productId: number; profileId?: number | null; next: string; label: string }) {
  return (
    <form action={addToCartAction}>
      <input type="hidden" name="product_id" value={productId} />
      <input type="hidden" name="quantity" value="1" />
      {profileId ? <input type="hidden" name="profile_id" value={profileId} /> : null}
      <input type="hidden" name="next" value={next} />
      <button type="submit" className="acc-btn acc-btn--primary">
        {label}
      </button>
    </form>
  );
}

/** The Classic / Custom bundle offer (card, phone tag and the Pro upgrade). */
export function BundleOffer({ u, showManageCards = true }: { u: Upsells; showManageCards?: boolean }) {
  const [kind, setKind] = useState<"classic" | "custom">("classic");
  if (!u.bundleOffer) return null;
  const profileId = u.freeProfiles[0]?.id ?? null;
  const price = kind === "classic" ? u.prices.classicBundle : u.prices.customBundle;
  if (price === null) return null;
  return (
    <section className="acc-panel acc-upsell acc-upsell--offer">
      <p className="acc-upsell__kicker">{kind === "classic" ? "Classic Bundle Offer" : "Custom Bundle Offer"}</p>
      <div className="acc-upsell__heading">
        <h2>{kind === "classic" ? "Get your Classic MeCard bundle" : "Order a Custom MeCard bundle"}</h2>
        <p className="acc-upsell__offer-price">Only {offerPrice(price)}</p>
      </div>
      <div className="acc-upsell__artwork">
        {kind === "classic" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`${IMG}/classic_bundle_new_250_v2.webp`} width={250} height={289} alt="Classic bundle preview: a classic MeCard, a phone tag and a Pro profile" loading="lazy" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`${IMG}/custom_bundle_new.webp`} width={640} height={754} alt="Custom bundle preview: a custom-designed MeCard, a phone tag and a Pro profile" loading="lazy" />
        )}
      </div>
      <Toggle label="Bundle" value={kind} options={[["classic", "Classic"], ["custom", "Custom"]]} onChange={setKind} />
      {kind === "classic" ? (
        <>
          <p>Includes a classic card, a phone tag and the Pro upgrade.</p>
          <p className="acc__muted">Classic is the quickest route. No design files required.</p>
        </>
      ) : (
        <>
          <p>Includes a custom card, a phone tag and the Pro upgrade.</p>
          <p className="acc__muted">You need to provide your own front and back design files in 856 x 540px, PNG or JPG.</p>
          <p className="acc__muted">QR code generated automatically, you control size colour and placement.</p>
        </>
      )}
      <div className="acc-actions">
        <AddForm
          productId={kind === "classic" ? PRODUCT.classicBundle : PRODUCT.customBundle}
          profileId={profileId}
          next="/manage/?done=bundle-added"
          label={kind === "classic" ? "Add classic bundle" : "Add custom bundle"}
        />
        {showManageCards && kind === "classic" ? (
          <Link className="acc-btn" href="/manage/cards/">
            Manage cards
          </Link>
        ) : null}
      </div>
    </section>
  );
}

/** A classic card with its Front / Back toggle (the back is the standard MeCard design). */
export function ClassicCardPreview({ logo, name, jobTitle }: { logo: string | null; name: string; jobTitle: string }) {
  const [side, setSide] = useState<"front" | "back">("front");
  const src = imageUrl(logo, 480);
  return (
    <div className="acc-upsell__classic">
      <Toggle label="Classic card preview side" value={side} options={[["front", "Front"], ["back", "Back"]]} onChange={setSide} />
      {side === "front" ? (
        <div className="card-design__card card-design__card--classic">
          <div className="card-design__logo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {src ? <img src={src} alt="Logo" /> : <span className="acc__muted">Your logo</span>}
          </div>
          <p className="card-design__name">{name || "Your name"}</p>
          <p className="card-design__title">{jobTitle}</p>
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="acc-upsell__card-img" src={`${IMG}/classic-back.webp`} width={640} height={403} alt="Classic card back: the standard MeCard design with your QR code" loading="lazy" />
      )}
    </div>
  );
}

/** "Order a card": a Classic card from the profile's details, or a Custom card. */
export function CardOffer({ u }: { u: Upsells }) {
  const [kind, setKind] = useState<"classic" | "custom">("classic");
  if (!u.cardOffer) return null;
  const price = kind === "classic" ? u.prices.classicCard : u.prices.customCard;
  if (price === null) return null;
  const next = "/manage/cards/?tab=design&done=card-added";
  return (
    <section className="acc-panel acc-upsell acc-upsell--offer">
      <p className="acc-upsell__kicker">{kind === "classic" ? "Order a card" : "Custom card"}</p>
      <div className="acc-upsell__heading">
        <h2>{kind === "classic" ? "Classic card" : "Order a Custom card"}</h2>
        <p className="acc-upsell__offer-price">Only {offerPrice(price)}</p>
      </div>
      {kind === "classic" ? (
        <>
          <p>Fastest option. We&rsquo;ll use the details already on your profile.</p>
          <ClassicCardPreview logo={u.preview?.logo ?? null} name={u.preview?.name ?? ""} jobTitle={u.preview?.jobTitle ?? ""} />
        </>
      ) : (
        <>
          <p className="acc__muted">You need to provide your own front and back design files in 856 x 540px, PNG or JPG.</p>
          <div className="acc-upsell__examples">
            <figure>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="acc-upsell__card-img" src={`${IMG}/alessio-card-rounded_front.webp`} width={640} height={400} alt="Custom card front example: a full-colour design supplied by the customer" loading="lazy" />
              <figcaption>Front example</figcaption>
            </figure>
            <figure>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="acc-upsell__card-img" src={`${IMG}/alessio-back.webp`} width={640} height={407} alt="Custom card back example with the QR code placed on the design" loading="lazy" />
              <figcaption>Back example</figcaption>
            </figure>
          </div>
        </>
      )}
      <Toggle label="Card" value={kind} options={[["classic", "Classic"], ["custom", "Custom"]]} onChange={setKind} />
      {kind === "classic" ? (
        <p className="acc__muted">You&rsquo;ll be able to update your logo, name and job title on the next screen before checking out.</p>
      ) : (
        <p className="acc__muted">QR code generated automatically, you control size colour and placement.</p>
      )}
      <div className="acc-actions">
        <AddForm productId={kind === "classic" ? PRODUCT.classicCard : PRODUCT.customCard} next={next} label={kind === "classic" ? "Add classic card" : "Add custom card"} />
      </div>
    </section>
  );
}
