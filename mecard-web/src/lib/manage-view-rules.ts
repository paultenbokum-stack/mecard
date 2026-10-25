// Which /manage/ a user gets. WordPress decided it from what they had
// (Single_Editor_Module::resolve_single_profile_id, mecard_user_home_url):
// exactly one profile of their own (owner or creator, not archived) got the
// single "My MeCard Home"; none, or two or more, the team dashboard. Owning a
// company also means the team view, unless the company is just your own
// profile's branding (set up in the single editor's Look and feel step).
//
// On top of that the account has a mode (users.account_mode): "teams" once
// they sign up for a team or press Switch to teams, "individual" once they go
// back, null for accounts from before (decided by what they have, as above).

export type ManageView = "single" | "team";
export type AccountMode = "individual" | "teams" | null;

export type ViewFacts = {
  mode?: AccountMode;
  ownProfiles: number;
  ownsCompany: boolean;
  /** The one company they own is used by their one profile and nobody else's. */
  companyIsOwnBranding?: boolean;
};

/** What they have is a team whatever the mode: two or more profiles, or a company other profiles use. */
export function hasTeam(s: ViewFacts): boolean {
  return s.ownProfiles >= 2 || (s.ownsCompany && !s.companyIsOwnBranding);
}

export function manageView(s: ViewFacts): ManageView {
  if (s.mode === "teams" || hasTeam(s)) return "team";
  return s.ownProfiles === 1 ? "single" : "team";
}

/** The mode is set to teams for them once they have a team, so archiving a profile doesn't flip them back. */
export function shouldMarkTeams(s: ViewFacts): boolean {
  return s.mode !== "teams" && hasTeam(s);
}

/** "Back to individual view" on the team dashboard: only for one profile and no company anyone else uses. */
export function canGoIndividual(s: ViewFacts): boolean {
  return s.mode === "teams" && s.ownProfiles === 1 && !hasTeam(s);
}
