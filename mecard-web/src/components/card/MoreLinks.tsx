import { safeHref } from "@/lib/profile-format";
import type { ProfileView } from "@/lib/public-profile";

// The two Toolset views on pro profiles: company-wide buttons
// (loop-item-in-more-links-company), then the profile's own "My Links"
// (loop-item-in-more-links), which always used a globe icon.

export function MoreLinks({ view }: { view: ProfileView }) {
  return (
    <>
      {view.companyLinks.length ? (
        <div className="js-wpv-view-layout">
          {view.companyLinks.map((l) => (
            <div className="row" key={l.id}>
              <div className="col-sm-12">
                <a className="" href={safeHref(l.url)}>
                  <button type="button" className="btn company more-links">
                    {l.icon ? <i className={l.icon} aria-hidden="true" /> : null}
                    <span className="btn-label">{l.label}</span>
                  </button>
                </a>
              </div>
            </div>
          ))}
        </div>
      ) : null}
      {view.profileLinks.length ? (
        <div className="js-wpv-view-layout">
          <div className="row">
            <div className="col col-12 mecard-section">My Links</div>
            {view.profileLinks.map((l) => (
              <div className="col-sm-12" key={l.id}>
                <a href={safeHref(l.url)}>
                  <button type="button" className="btn company more-links">
                    <i className="fa fa-globe" aria-hidden="true" /> {l.label}
                  </button>
                </a>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}
