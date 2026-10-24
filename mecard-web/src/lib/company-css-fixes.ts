// Per-company CSS fixes, appended after the company's own custom CSS (and
// scoped the same way). For branding that was broken on WordPress for reasons
// the scoping fix in lib/branding.ts doesn't cover. Kept in code, keyed by the
// WordPress company ID, so re-running the import never loses them; remove an
// entry once the company's settings are corrected in the editor.

export const COMPANY_CSS_FIXES: Record<number, string> = {
  // Sasfin Holdings Limited: accent and button text are both white, so the
  // call/email/WhatsApp buttons showed white icons on white. Use their teal.
  15124: ".profile-buttons button i { color: #007a8f; }",
};
