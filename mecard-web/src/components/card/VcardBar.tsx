// Markup of the [mecard_vcard_button] shortcode. CardBehaviour wires the click
// (and the optional automatic download) to a hidden iframe.

export function VcardBar({ profileId, name }: { profileId: number; name: string }) {
  return (
    <div data-me-field="vcard-button">
      <div className="vcard-download">
        <div id="download-message">
          <button type="button" id="download-close" className="close" aria-label="Close">
            <span aria-hidden="true">&times;</span>
          </button>
          <div>
            <p>Click on the downloaded file</p>
            <p>
              <span className="vcard-file">&quot;{name}.vcf&quot;</span>
            </p>
            <p>to import into your phone&apos;s contacts.</p>
          </div>
          <div id="mecard-download-cta-slot" />
        </div>
        <div className="vcard-button" id={`vcard-button-${profileId}`}>
          <a href="#" role="button">
            <svg className="mc-vcard-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="10" cy="9" r="3.5" />
              <path d="M4 19c0-3 2.7-5.5 6-5.5s6 2.5 6 5.5" />
              <path d="M18 6v6M15 9h6" />
            </svg>{" "}
            Save to contacts
          </a>
        </div>
      </div>
      <iframe id="vcard-download" title="vCard download" aria-hidden="true" tabIndex={-1} />
    </div>
  );
}
