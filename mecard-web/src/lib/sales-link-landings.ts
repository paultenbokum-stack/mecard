/** Where a salesperson's link can open: /r/<code>/?to=teams. Plain data, shared with the browser. */
export const LINK_LANDINGS: Record<string, { path: string; label: string }> = {
  home: { path: "/", label: "Home page" },
  cards: { path: "/cards/", label: "Pricing" },
  teams: { path: "/for-teams/", label: "For teams" },
  shop: { path: "/shop/", label: "Shop" },
  signup: { path: "/sign-up/", label: "Sign up" },
};
