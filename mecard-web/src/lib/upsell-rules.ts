import { rands } from "./money";

// Which upsells /manage shows, as WordPress's "My MeCard Home"
// (class-me-single-manage.php) decided them, for one profile or several:
//   a bundle in the basket      → the "Bundle in progress" journey only
//   otherwise, unless every profile is Pro or an upgrade is pending (paid,
//   awaiting EFT, or in the basket): the Pro upsell and the bundle offer
//   always                      → the card offer
//   free profile + pending, not in the basket → "Your Pro upgrade is pending" (EFT)

/** pendingUpgrade counts an upgrade in the basket too; upgradeInBasket says one is, so "waiting for EFT" isn't shown for it. */
export type UpsellInput = { freeProfiles: number; pendingUpgrade: boolean; upgradesReady: number; bundleInBasket: boolean; upgradeInBasket?: boolean };

export function upsellRules(s: UpsellInput) {
  const hideUpgrade = s.freeProfiles === 0 || s.pendingUpgrade;
  const journey = s.bundleInBasket;
  return {
    journey,
    proUpsell: !journey && !hideUpgrade,
    bundleOffer: !journey && !hideUpgrade,
    cardOffer: !journey,
    // A paid upgrade ready to apply beats "waiting for EFT".
    eftPending: s.freeProfiles > 0 && s.pendingUpgrade && s.upgradesReady === 0 && !s.upgradeInBasket,
  };
}

/** "R499" for whole rands (the offers' "Only R499"), else R499.50. */
export const offerPrice = (cents: number) => rands(cents).replace(/\.00$/, "");

/** The cookie that remembers this user dismissed "Managing a team? Set up a company". */
export const teamPromptCookie = (userId: number) => `mecard_team_prompt_${userId}`;

/** Set by Switch to teams and a team sign-up: the "You're now managing a team" strip shows until it's dismissed. */
export const teamWelcomeCookie = (userId: number) => `mecard_team_welcome_${userId}`;
