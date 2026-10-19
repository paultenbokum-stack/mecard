import { imageUrl } from "@/lib/images/paths";
import { mapsUrl, safeHref, telHref, whatsappDigits } from "@/lib/profile-format";
import { companyLabel, type ProfileView } from "@/lib/public-profile";
import { SOCIAL_ICONS } from "./socials";

// Port of templates/profile-standard.php (public context). The WordPress data
// loader never passed the profile's own website to this template, so the
// Website row never showed; it stays hidden here too.

const Icon = {
  call: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M6.6 3h3.1a1 1 0 0 1 .95.68l1.34 4a1 1 0 0 1-.25 1.04l-1.86 1.74a13 13 0 0 0 5.66 5.66l1.74-1.86a1 1 0 0 1 1.04-.25l4 1.34a1 1 0 0 1 .68.95v3.1a2 2 0 0 1-2.13 2C10.66 20.91 3.09 13.34 2.6 5.13A2 2 0 0 1 4.6 3Z" /></svg>
  ),
  email: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M3 7.2 11.4 13a1 1 0 0 0 1.2 0L21 7.2V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7.2Z" /><path d="M20.7 5.6A2 2 0 0 0 19 5H5a2 2 0 0 0-1.7.9L12 12l8.7-6.4Z" /></svg>
  ),
  whatsapp: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.9c0 1.92.55 3.78 1.6 5.4L2 22l4.84-1.27a9.86 9.86 0 0 0 5.2 1.48h.01c5.46 0 9.91-4.44 9.91-9.9 0-2.65-1.03-5.14-2.9-7.01A9.87 9.87 0 0 0 12.04 2Zm5.81 14.16c-.24.68-1.41 1.3-1.97 1.34-.5.04-1.13.06-1.83-.12-.42-.13-.96-.31-1.65-.61-2.92-1.26-4.82-4.2-4.97-4.39-.15-.2-1.2-1.59-1.2-3.04 0-1.45.76-2.16 1.03-2.45.27-.3.59-.37.79-.37l.57.01c.18 0 .43-.07.67.51.24.6.83 2.05.9 2.2.07.15.12.32.02.52-.1.2-.15.32-.3.5-.15.17-.32.39-.46.52-.15.15-.31.31-.13.61.18.3.78 1.29 1.67 2.08 1.15 1.02 2.12 1.34 2.42 1.49.3.15.48.13.66-.08.18-.21.76-.89.96-1.19.2-.3.4-.25.67-.15.27.1 1.72.81 2.02.96.3.15.49.22.56.34.08.13.08.73-.16 1.42Z" /></svg>
  ),
  mail: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="m3.5 6.5 8.5 6.5 8.5-6.5" /></svg>
  ),
  phone: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M6.5 3h3l1.5 4.5L9 9.5a12 12 0 0 0 5.5 5.5l2-2L21 14.5v3a2 2 0 0 1-2.2 2C10.5 19 5 13.5 4.5 5.2A2 2 0 0 1 6.5 3Z" /></svg>
  ),
  briefcase: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" /></svg>
  ),
  pin: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21c-4-4-6-7.5-6-10a6 6 0 0 1 12 0c0 2.5-2 6-6 10Z" /><circle cx="12" cy="11" r="2" /></svg>
  ),
  globe: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 3c-2 2.5-3 5.5-3 9s1 6.5 3 9M12 3c2 2.5 3 5.5 3 9s-1 6.5-3 9M3 12h18" /></svg>
  ),
  directions: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="m3 11 19-9-9 19-2-8-8-2Z" /></svg>
  ),
};

export function StandardProfile({ view, children }: { view: ProfileView; children: React.ReactNode }) {
  const { profile: p, company: c } = view;
  const photo = imageUrl(p.photoPath, 320);
  const wa = whatsappDigits(p.whatsapp || p.mobile);
  const label = companyLabel(view);
  const address = c?.address ?? "";
  const website = c?.website ?? "";
  const tel = c?.phone ?? "";

  return (
    <div className="mc-page standard-profile-container">
      <main className="mc-main">
        <section className="mc-card">
          <div className="mc-card__avatar profile-image">
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img data-me-field="photo" src={photo} alt="Profile picture" fetchPriority="high" />
            ) : (
              <div className="mc-card__avatar-placeholder me-photo-placeholder">
                <svg viewBox="0 0 64 64" width="70" height="70" fill="currentColor"><circle cx="32" cy="24" r="11" /><path d="M12 56c0-11 9-19 20-19s20 8 20 19v2H12v-2Z" /></svg>
              </div>
            )}
          </div>

          <h1 className="mc-card__name">
            <span data-me-field="first">{p.firstName}</span> <span data-me-field="last">{p.lastName}</span>
          </h1>

          <p className="mc-card__role">
            <span data-me-field="job">{p.jobTitle}</span>
            {label ? (
              <span data-me-field="role-company">
                <span className="mc-card__role-sep"> at </span>
                <strong>{label}</strong>
              </span>
            ) : null}
          </p>

          <div className="mc-socials">
            {SOCIAL_ICONS.map(([net, icon]) =>
              p.socials[net] ? (
                <div key={net} className="mecard-social-item" data-me-field={`soc-${net}`}>
                  <a className="mc-social" href={safeHref(p.socials[net])} target="_blank" rel="noopener" aria-label={net[0].toUpperCase() + net.slice(1)}>
                    <i className={icon} />
                  </a>
                </div>
              ) : null,
            )}
          </div>
        </section>

        <div className="mc-actions">
          <a className="mc-action" data-me-field="call" href={telHref(p.mobile)} aria-label="Call">
            <span className="mc-action__icon mc-action__icon--call">{Icon.call}</span>
            <span className="mc-action__label">Call</span>
          </a>
          <a className="mc-action" data-me-field="email" href={p.email ? `mailto:${p.email}` : "#"} aria-label="Email">
            <span className="mc-action__icon mc-action__icon--email">{Icon.email}</span>
            <span className="mc-action__label">Email</span>
          </a>
          <a className="mc-action" data-me-field="wa" href={wa ? `https://wa.me/${wa}` : "#"} aria-label="WhatsApp">
            <span className="mc-action__icon mc-action__icon--whatsapp">{Icon.whatsapp}</span>
            <span className="mc-action__label">WhatsApp</span>
          </a>
        </div>

        <section className="mc-details">
          <div className="mc-details__row">
            <span className="mc-details__icon mc-details__icon--blue">{Icon.mail}</span>
            <div className="mc-details__text">
              <div className="mc-details__label">Email</div>
              <div className="mc-details__value">
                <span data-me-field="email-text">{p.email}</span>
              </div>
            </div>
          </div>
          <div className="mc-details__row">
            <span className="mc-details__icon mc-details__icon--blue">{Icon.phone}</span>
            <div className="mc-details__text">
              <div className="mc-details__label">Mobile</div>
              <div className="mc-details__value">
                <span data-me-field="mobile-text">{p.mobile}</span>
              </div>
            </div>
          </div>
        </section>

        <section className="mc-details mc-work">
          <h2 className="mc-details__section-title">Work</h2>
          <div className="mc-details__row">
            <span className="mc-details__icon mc-details__icon--blue">{Icon.briefcase}</span>
            <div className="mc-details__text">
              <div className="mc-details__label">Company</div>
              <div className="mc-details__value">
                <span className="company" data-me-field="company-name">{label}</span>
              </div>
            </div>
          </div>
          {address ? (
            <div className="mc-details__row" data-me-field="company-address-row">
              <span className="mc-details__icon mc-details__icon--blue">{Icon.pin}</span>
              <div className="mc-details__text">
                <div className="mc-details__label">Address</div>
                <div className="mc-details__value">
                  <span data-me-field="company-address">{address}</span>
                </div>
              </div>
            </div>
          ) : null}
          <div className="mc-company-actions">
            {website ? (
              <div data-me-field="btn-website">
                <a data-me-field="company-website" href={safeHref(website)} target="_blank" rel="noopener" className="mc-company-btn">
                  {Icon.globe} Website
                </a>
              </div>
            ) : null}
            {tel ? (
              <div data-me-field="btn-phone">
                <a data-me-field="company-phone" href={telHref(tel)} className="mc-company-btn">
                  {Icon.phone} Call Office
                </a>
              </div>
            ) : null}
            {address ? (
              <div data-me-field="btn-directions">
                <a data-me-field="company-directions" href={mapsUrl(address)} target="_blank" rel="noopener" className="mc-company-btn">
                  {Icon.directions} Directions
                </a>
              </div>
            ) : null}
          </div>
        </section>

        <div style={{ height: 30 }} aria-hidden="true" />
      </main>

      {children}
    </div>
  );
}
