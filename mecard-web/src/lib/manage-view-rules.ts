// Which /manage/ a user gets, as WordPress decided it
// (Single_Editor_Module::resolve_single_profile_id, mecard_user_home_url):
// exactly one profile of their own (owner or creator, not archived) gets the
// single "My MeCard Home"; none, or two or more, get the team dashboard.
// One addition: owning a company also means the team view, since only it
// manages companies.

export type ManageView = "single" | "team";

export function manageView(s: { ownProfiles: number; ownsCompany: boolean }): ManageView {
  return s.ownProfiles === 1 && !s.ownsCompany ? "single" : "team";
}
