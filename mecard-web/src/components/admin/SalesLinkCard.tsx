"use client";

import { useState } from "react";
import { LINK_LANDINGS } from "@/lib/sales-link-landings";

/** The salesperson's link, ready to copy or send on WhatsApp. Sending isn't tracked; counting starts at the click. */
export function SalesLinkCard({ url }: { url: string }) {
  const [to, setTo] = useState("home");
  const [copied, setCopied] = useState(false);
  const link = to === "home" ? url : `${url}?to=${to}`;
  const copy = async () => {
    await navigator.clipboard?.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(`Here's MeCard, the digital business card I mentioned: ${link}`)}`;
  return (
    <div className="adm-form" style={{ gridTemplateColumns: "1fr" }}>
      <div className="adm-field">
        <label htmlFor="sales-link">Link to share</label>
        <input id="sales-link" readOnly value={link} className="adm-input" onFocus={(e) => e.target.select()} style={{ fontFamily: "var(--font-mono)" }} />
      </div>
      <div className="adm-field" role="group" aria-labelledby="sales-link-to">
        <span id="sales-link-to" className="adm-label">
          Opens on
        </span>
        <div className="adm-head__actions" style={{ justifyContent: "flex-start", flexWrap: "wrap" }}>
          {Object.entries(LINK_LANDINGS).map(([k, l]) => (
            <button key={k} type="button" className={to === k ? "adm-btn adm-btn--primary" : "adm-btn"} aria-pressed={to === k} onClick={() => setTo(k)}>
              {l.label}
            </button>
          ))}
        </div>
      </div>
      <div className="adm-head__actions">
        <button type="button" className="adm-btn" onClick={copy} aria-live="polite">
          <i className="fas fa-copy" aria-hidden="true" /> {copied ? "Copied" : "Copy link"}
        </button>
        <a href={whatsapp} target="_blank" rel="noopener" className="adm-btn">
          <i className="fab fa-whatsapp" aria-hidden="true" /> Send on WhatsApp
        </a>
      </div>
    </div>
  );
}
