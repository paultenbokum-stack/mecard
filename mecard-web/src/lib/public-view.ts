import "server-only";
import { cache } from "react";
import { pendingProUpgrades } from "./manage";
import { isPro } from "./profile-format";
import { getProfileView } from "./public-profile";
import type { ProfileView } from "./profile-view";

/**
 * The profile as the public sees it (card pages and the vCard). A standard
 * profile whose Pro upgrade is waiting for payment doesn't show its company's
 * phone, address or website yet: they go live with Pro once it is paid.
 * Other standard profiles in a company keep showing them, as before.
 */
export const getPublicProfileView = cache(async (profileId: number): Promise<ProfileView | null> => {
  const view = await getProfileView(profileId);
  if (!view?.company || isPro(view.profile)) return view;
  if (!(await pendingProUpgrades([profileId])).has(profileId)) return view;
  return { ...view, company: { ...view.company, phone: "", address: "", website: "" } };
});
