// Markup of the [mecard_share_panel] shortcode: floating share button and the
// off-canvas panel (QR code, WhatsApp a number, share/copy, email, SMS,
// Add to Home Screen). CardBehaviour makes it work.

export function SharePanel() {
  return (
    <>
      <button className="mecard-share-fab" type="button" aria-controls="mecard-share-panel" aria-expanded="false" aria-label="Open share panel">
        <i className="fas fa-share-alt" aria-hidden="true" />
      </button>

      <div className="mecard-share-scrim" aria-hidden="true" />

      <div id="mecard-share-panel" className="mecard-share-panel" data-visible="false" role="dialog" aria-label="Share options" aria-modal="true" aria-hidden="true">
        <div className="container-fluid py-3">
          <div className="row">
            <div className="col-12">
              <div className="card mb-3">
                <div className="card-body text-center">
                  <h5 className="card-title mb-2">
                    <i className="fas fa-qrcode" /> QR code
                  </h5>
                  <div id="mecard-qr-canvas" className="mx-auto" />
                  <button type="button" className="btn btn-outline-secondary btn-sm mt-2" data-action="download-qr">
                    <i className="fas fa-download" /> Download PNG
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="row">
            <div className="col-12">
              <div className="card mb-3">
                <div className="card-body">
                  <h5 className="card-title mb-3">
                    <i className="fab fa-whatsapp" /> WhatsApp a number
                  </h5>
                  <div className="form-group">
                    <label htmlFor="mecard-wa-msisdn" className="mb-1">
                      Mobile number
                    </label>
                    <input id="mecard-wa-msisdn" type="tel" inputMode="tel" className="form-control" autoComplete="tel" placeholder="Enter mobile number" />
                    <small id="mecard-wa-help" className="form-text text-muted">
                      Select the country, then enter the number in local format. Your last choice will be remembered.
                    </small>
                    <div id="mecard-wa-feedback" className="invalid-feedback d-block" aria-live="polite" hidden />
                  </div>
                  <button className="btn btn-success" data-action="whatsapp-number" type="button">
                    <i className="fab fa-whatsapp" /> Open WhatsApp
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="row">
            <div className="col-12">
              <div className="card mb-3">
                <div className="card-body">
                  <h5 className="card-title mb-3">
                    <i className="fas fa-share-square" /> Share
                  </h5>
                  <button type="button" className="btn btn-primary mr-2 mb-2" data-action="native-share">
                    <i className="fas fa-share-alt" /> Share link
                  </button>
                  <button type="button" className="btn btn-outline-secondary mb-2" data-action="copy-link">
                    <i className="fas fa-link" /> Copy link
                  </button>
                </div>
              </div>
            </div>
            <div className="col-12">
              <div className="card mb-3">
                <div className="card-body">
                  <h5 className="card-title mb-3">
                    <i className="fas fa-envelope" /> Email
                  </h5>
                  <button type="button" className="btn btn-primary" data-action="email">
                    <i className="fas fa-paper-plane" /> Compose
                  </button>
                </div>
              </div>
            </div>
            <div className="col-12">
              <div className="card mb-4">
                <div className="card-body">
                  <h5 className="card-title mb-2">
                    <i className="fas fa-sms" /> SMS / Text
                  </h5>
                  <button type="button" className="btn btn-primary" data-action="sms">
                    <i className="fas fa-comment-alt" /> Text link
                  </button>
                  <small className="text-muted d-block mt-2">Your device may handle SMS links differently.</small>
                </div>
              </div>
            </div>
          </div>

          <div className="row">
            <div className="col-12">
              <div className="card mb-3" id="mecard-a2hs-card" data-share-target="install" style={{ display: "none" }}>
                <div className="card-body">
                  <h5 className="card-title mb-3">
                    <i className="fas fa-home" /> Add to Home Screen
                  </h5>
                  <div id="mecard-a2hs-android" style={{ display: "none" }}>
                    <p className="mb-2">Install this profile to your home screen to launch and share with people you meet.</p>
                    <button type="button" className="btn btn-primary" id="mecard-a2hs-install-btn">
                      <i className="fas fa-download" /> Install
                    </button>
                  </div>
                  <div id="mecard-a2hs-ios" style={{ display: "none" }}>
                    <p className="mb-2">Install this profile to your home screen to launch and share with people you meet.</p>
                    <div className="mecard-install-ios-steps">
                      {[
                        ["1. Tap share", "/images/ios-share-icon.png", "iPhone share icon", "mecard-install-shot--crop-bottom"],
                        ["2. Tap view more", "/images/ios-share-view-more.png", "iPhone share sheet showing the View More option", "mecard-install-shot--crop-bottom"],
                        ["3. Tap add to home", "/images/ios-add-to-home.png", "iPhone share options showing Add to Home Screen", "mecard-install-shot--crop-home"],
                      ].map(([title, src, alt, crop]) => (
                        <div className="mecard-install-ios-step" key={title}>
                          <div className="mecard-install-ios-step__title">{title}</div>
                          <div className={`mecard-install-shot ${crop}`}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img className="mecard-install-shot__image" src={src} alt={alt} loading="lazy" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div id="mecard-a2hs-installed" className="text-success" style={{ display: "none" }}>
                    <i className="fas fa-check-circle" /> Already added to your home screen.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
