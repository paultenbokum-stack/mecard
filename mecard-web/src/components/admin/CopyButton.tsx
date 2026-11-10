"use client";

import { useState } from "react";

/** Copies `text` and says so for two seconds. */
export function CopyButton({ text, label = "Copy link" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="adm-btn"
      aria-live="polite"
      onClick={async () => {
        await navigator.clipboard?.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      <i className="fas fa-copy" aria-hidden="true" /> {copied ? "Copied" : label}
    </button>
  );
}
