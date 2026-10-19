import { imageUrl } from "@/lib/images/paths";
import { mapsUrl, safeHref, telHref, whatsappDigits } from "@/lib/profile-format";
import { companyLabel, type ProfileView } from "@/lib/public-profile";
import { MoreLinks } from "./MoreLinks";
import { RichText } from "./RichText";
import { SOCIAL_ICONS } from "./socials";

// Port of templates/profile-pro.php (public context):
// logo → photo → name → job → social icons + call/email/WhatsApp → company section.

export function ProProfile({ view, children }: { view: ProfileView; children: React.ReactNode }) {
  const { profile: p, company: c } = view;
  // Full-size master (as WordPress used the full upload): on wide screens the
  // card shrinks to the logo's natural width, as the Astra flex container did.
  const logo = imageUrl(c?.logoPath);
  const photo = imageUrl(p.photoPath, 320);
  const wa = whatsappDigits(p.whatsapp || p.mobile);
  const address = c?.address ?? "";
  const website = c?.website ?? "";
  const tel = c?.phone ?? "";

  return (
    <div className={`pro-profile-container post-${p.id}`}>
      <div className="pro-logo">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img data-me-field="company-logo" src={logo} alt={c?.name ?? ""} fetchPriority="high" />
        ) : null}
      </div>

      <div className="profile-image pro">
        {photo ? (
          <picture className="attachment-medium size-medium wp-post-image">
            <img data-me-field="photo" src={photo} alt="Profile picture" />
          </picture>
        ) : (
          <div className="me-photo-placeholder">
            <i className="fas fa-user" />
          </div>
        )}
      </div>

      <div style={{ height: 20 }} aria-hidden="true" className="wp-block-spacer" />

      <h1 className="has-text-align-center">
        <span data-me-field="first">{p.firstName}</span> <span data-me-field="last">{p.lastName}</span>
      </h1>

      <div className="job-title">
        <span data-me-field="job">{p.jobTitle}</span>
      </div>

      <div className="container-md">
        <div className="row justify-content-center mecard-social">
          {SOCIAL_ICONS.map(([net, icon]) =>
            p.socials[net] ? (
              <div key={net} className="col-2 text-center mecard-social-item" data-me-field={`soc-${net}`}>
                <a href={safeHref(p.socials[net])} target="_blank" rel="noopener" aria-label={net}>
                  <i className={icon} />
                </a>
              </div>
            ) : null,
          )}
        </div>
        <div className="row profile-buttons">
          <div className="col col-4">
            <a data-me-field="call" href={telHref(p.mobile)}>
              <button type="button" className="phone" aria-label="Call">
                <i className="fas fa-mobile-alt" />
              </button>
            </a>
          </div>
          <div className="col col-4">
            <a data-me-field="email" href={p.email ? `mailto:${p.email}` : "#"}>
              <button type="button" className="email" aria-label="Email">
                <i className="fas fa-envelope" />
              </button>
            </a>
          </div>
          <div className="col col-4">
            <a data-me-field="wa" href={wa ? `https://wa.me/${wa}` : "#"}>
              <button type="button" className="whatsapp" aria-label="WhatsApp">
                <i className="fab fa-whatsapp" />
              </button>
            </a>
          </div>
        </div>
      </div>

      <div className="container-fluid">
        <div style={{ height: 50 }} aria-hidden="true" className="wp-block-spacer" />

        <div className="row">
          <div className="col col-sm-12">
            <h2 className="company" data-me-field="company-name">
              {companyLabel(view)}
            </h2>
          </div>
        </div>

        {address ? (
          <div className="row" data-me-field="company-address-row">
            <div className="col col-sm-12">
              <a data-me-field="company-address" href={mapsUrl(address)} target="_blank" rel="noopener" className="company-address" style={{ textDecoration: "none" }}>
                <span data-me-field="company-address-text">{address}</span>
              </a>
              <div style={{ height: 20 }} aria-hidden="true" className="wp-block-spacer" />
            </div>
          </div>
        ) : null}

        {c?.descriptionHtml ? (
          <div className="row">
            <div className="col col-sm-12" data-me-field="company-description">
              <RichText html={c.descriptionHtml} />
            </div>
          </div>
        ) : null}

        <div style={{ height: 50 }} aria-hidden="true" className="wp-block-spacer" />

        <div className="row">
          <div className="col col-sm-12">
            {website ? (
              <a data-me-field="company-website" href={safeHref(website)} target="_blank" rel="noopener">
                <button type="button" className="company website">
                  <i className="fas fa-globe" /> Visit Website
                </button>
              </a>
            ) : null}
            {tel ? (
              <a data-me-field="company-phone" href={telHref(tel)}>
                <button type="button" className="company phone">
                  <i className="fas fa-phone-alt" /> Call the Office
                </button>
              </a>
            ) : null}
            {p.workPhone ? (
              <a data-me-field="direct-line" href={telHref(p.workPhone)}>
                <button type="button" className="company phone">
                  <i className="fas fa-phone-alt" /> Direct Line
                </button>
              </a>
            ) : null}
            {address ? (
              <a data-me-field="company-directions" href={mapsUrl(address)} target="_blank" rel="noopener">
                <button type="button" className="company directions">
                  <i className="fas fa-map-marker" /> Directions
                </button>
              </a>
            ) : null}
          </div>
        </div>

        <MoreLinks view={view} />
      </div>

      <div className="row">
        <div className="col col-12">
          <div className="mecard-swipe-hint d-sm-none" aria-hidden="true" style={{ textAlign: "center", opacity: 0.7, marginTop: 10 }}>
            <small>Tip: swipe left/right for more sharing options</small>
          </div>
        </div>
      </div>

      <div style={{ height: 50 }} aria-hidden="true" className="wp-block-spacer" />

      {children}
    </div>
  );
}
