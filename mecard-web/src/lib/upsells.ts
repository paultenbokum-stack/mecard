import "server-only";
import { and, asc, eq, inArray, notInArray } from "drizzle-orm";
import { db } from "@/db/client";
import { companies, products, profiles } from "@/db/schema";
import { editableProfilesWhere, type Viewer } from "./access";
import { getCart } from "./cart";
import { isBundle, PRODUCT } from "./catalog";
import { availableProUpgrades, cardTabCounts, hasPendingUpgrade } from "./manage";
import { upsellRules } from "./upsell-rules";

// What /manage needs for its upsells (WordPress's "My MeCard Home"): prices
// from the products table, the free profiles, a bundle in the basket, a
// pending upgrade, and how many cards are in the basket, on the way or live.

const OFFER_PRODUCTS = [PRODUCT.proUpgrade, PRODUCT.classicBundle, PRODUCT.customBundle, PRODUCT.classicCard, PRODUCT.customCard];

export type Upsells = Awaited<ReturnType<typeof loadUpsells>>;

export async function loadUpsells(v: Viewer) {
  const [priceRows, cart, pending, upgradesReady, free, counts] = await Promise.all([
    db.select({ id: products.id, priceCents: products.priceCents, active: products.active }).from(products).where(inArray(products.id, OFFER_PRODUCTS)),
    getCart(v.id),
    hasPendingUpgrade(v.id),
    availableProUpgrades(v.id),
    db
      .select({
        id: profiles.id,
        firstName: profiles.firstName,
        lastName: profiles.lastName,
        slug: profiles.slug,
        jobTitle: profiles.jobTitle,
        logo: profiles.companyLogoPath,
        companyLogo: companies.logoPath,
      })
      .from(profiles)
      .leftJoin(companies, eq(companies.id, profiles.companyId))
      .where(and(editableProfilesWhere(v.id), eq(profiles.archived, false), notInArray(profiles.type, ["pro", "professional"])))
      .orderBy(asc(profiles.firstName), asc(profiles.lastName), asc(profiles.id)),
    cardTabCounts(v),
  ]);
  const price = (id: number) => priceRows.find((p) => p.id === id && p.active)?.priceCents ?? null;
  const bundleLine = cart.items.find((l) => isBundle(l.productId)) ?? null;
  const upgradeInBasket = cart.items.some((l) => l.productId === PRODUCT.proUpgrade || isBundle(l.productId));
  const rules = upsellRules({ freeProfiles: free.length, pendingUpgrade: pending, upgradesReady, bundleInBasket: !!bundleLine, upgradeInBasket });
  const first = free[0] ?? null;
  return {
    ...rules,
    upgradesReady,
    prices: {
      pro: price(PRODUCT.proUpgrade),
      classicBundle: price(PRODUCT.classicBundle),
      customBundle: price(PRODUCT.customBundle),
      classicCard: price(PRODUCT.classicCard),
      customCard: price(PRODUCT.customCard),
    },
    freeProfiles: free.map((p) => ({ id: p.id, name: `${p.firstName} ${p.lastName}`.trim() || p.slug })),
    bundle: bundleLine ? { key: bundleLine.key, type: bundleLine.productId === PRODUCT.customBundle ? ("custom" as const) : ("classic" as const), profileId: bundleLine.profileId } : null,
    /** The classic card offer's preview: the first free profile's logo, name and job title (WordPress used the profile it was showing). */
    preview: first ? { logo: first.companyLogo ?? first.logo, name: `${first.firstName} ${first.lastName}`.trim(), jobTitle: first.jobTitle } : null,
    basketLines: cart.items.length,
    cards: { basket: counts.design, progress: counts.progress, live: counts.live + counts.unassigned },
  };
}
