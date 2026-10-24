// Which /manage/ a user gets, as WordPress decided it
// (Single_Editor_Module::resolve_single_profile_id, mecard_user_home_url):
// exactly one profile of their own (owner or creator, not archived) gets the
// single "My MeCard Home"; none, or two or more, get the team dashboard.
// One addition: owning a company also means the team view, since only it
// manages teams, unless the company is just your own profile's branding
// (set up in the single editor's Look and feel step).

export type ManageView = "single" | "team";

export function manageView(s: { ownProfiles: number; ownsCompany: boolean; companyIsOwnBranding?: boolean }): ManageView {
  return s.ownProfiles === 1 && (!s.ownsCompany || !!s.companyIsOwnBranding) ? "single" : "team";
}
