// What each MeCard product is, from the constants in wp-config.php and the
// plugin's me_product_array() / Me\Entitlements\Module::product_entitlement_types().

export const PRODUCT = {
  customCard: 706, // MECARD_PRODUCT_ID
  customBundle: 2044, // MECARD_BUNDLE_PRODUCT_ID
  keyRing: 734, // MECARD_KEYRING_PRODUCT_ID (old id; the live key ring is 2025)
  phoneTag: 2028, // MECARD_PHONETAG_PRODUCT_ID
  classicCard: 11157, // MECARD_CLASSIC_PRODUCT_ID
  classicBundle: 11160, // MECARD_CLASSIC_BUNDLE_PRODUCT_ID
  classicCorporate: 3189, // MECARD_CLASSIC_CORP_PRODUCT_ID
  proUpgrade: 41811, // MECARD_PROFILE_UPGRADE_PRODUCT_ID
} as const;

/** Card / tag records (cards.type) one unit of the product creates in the basket. */
export function cardTypesFor(productId: number): string[] {
  switch (productId) {
    case PRODUCT.customCard:
      return ["contactcard"];
    case PRODUCT.phoneTag:
      return ["phonetag"];
    case PRODUCT.classicCard:
    case PRODUCT.classicCorporate:
      return ["classiccard"];
    case PRODUCT.customBundle:
      return ["contactcard", "phonetag"];
    case PRODUCT.classicBundle:
      return ["classiccard", "phonetag"];
    default:
      return [];
  }
}

export type EntitlementType = "pro_upgrade" | "classic_card" | "custom_card" | "phone_tag";

export function entitlementTypesFor(productId: number): EntitlementType[] {
  switch (productId) {
    case PRODUCT.proUpgrade:
      return ["pro_upgrade"];
    case PRODUCT.classicCard:
      return ["classic_card"];
    case PRODUCT.customCard:
      return ["custom_card"];
    case PRODUCT.phoneTag:
      return ["phone_tag"];
    case PRODUCT.classicBundle:
      return ["pro_upgrade", "classic_card", "phone_tag"];
    case PRODUCT.customBundle:
      return ["pro_upgrade", "custom_card", "phone_tag"];
    default:
      return [];
  }
}

export const isBundle = (productId: number) => productId === PRODUCT.classicBundle || productId === PRODUCT.customBundle;

/** The card type an entitlement is fulfilled by (tag_post_type_for_entitlement). */
export const CARD_TYPE_FOR_ENTITLEMENT: Partial<Record<EntitlementType, string>> = {
  classic_card: "classiccard",
  custom_card: "contactcard",
  phone_tag: "phonetag",
};

/** Profile upgrades are virtual: nothing to ship (mecard_force_virtual_profile_upgrades). */
export const isVirtual = (productId: number) => productId === PRODUCT.proUpgrade;

/** Products that are for one profile: the upgrade, and the bundles (which include it). */
export const isForProfile = (productId: number) => productId === PRODUCT.proUpgrade || isBundle(productId);

/** "contactcard-796-50185": the printed slug WordPress gave new cards (create_tag()). */
export function newCardSlug(type: string, userId: number, random = Math.random): string {
  return `${type}-${userId}-${String(Math.floor(random() * 100000)).padStart(5, "0")}`;
}

/** Cards in a basket line carry "<line key>-<user id>" (wpcf-cart-item-key). */
export const cardCartKey = (lineKey: string, userId: number) => `${lineKey}-${userId}`;

/**
 * The shop page, in this order, with a one-line description each (the live
 * home page's wording). Other active products (corporate gift, design help,
 * extra shipping) were hidden from the catalogue and are sold by link only.
 */
export const SHOP_CATALOGUE: { id: number; blurb: string }[] = [
  { id: PRODUCT.classicCard, blurb: "White card with your logo, name and job title." },
  { id: PRODUCT.customCard, blurb: "Full custom design, front and back." },
  { id: PRODUCT.classicBundle, blurb: "Classic card + Pro profile + phone tag." },
  { id: PRODUCT.customBundle, blurb: "Custom card + Pro profile + phone tag." },
  { id: PRODUCT.phoneTag, blurb: "Stick it on your phone: tap to share." },
  { id: PRODUCT.proUpgrade, blurb: "Company branding, details and extra buttons for one profile." },
];
