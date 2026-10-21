// Delivery options at checkout. Live, MeCard's couriers are Bob Go rates
// (Standard / Express, quoted for the address) plus local pickup, and free
// shipping only with a coupon that gives it. Without BOBGO_API_KEY (local
// development) the fixed methods below stand in, priced like recent Bob Go
// quotes. Edit here to change them (content is code).
export type ShippingMethod = { id: string; label: string; cents: number; note?: string };

export const SHIPPING_METHODS: ShippingMethod[] = [
  { id: "standard", label: "Standard shipping", cents: 10500 },
  { id: "express", label: "Express shipping", cents: 16000 },
  {
    id: "pickup",
    label: "Local pickup",
    cents: 0,
    note: "Unit 1 Moyana, Zululami Luxury Coastal Estate, Sheffield Beach, Ballito, KZN",
  },
];

// ── Bob Go (live courier rates at checkout, orders sent to Bob Go once paid) ──

/** Where couriers collect from (Bob Go "collection_address"). */
export const SHIPPING_ORIGIN = {
  company: "Taggable (Pty) Ltd",
  street_address: "Unit 1 Moyana, Zululami Luxury Coastal Estate",
  local_area: "Sheffield Beach",
  city: "Ballito",
  zone: "KZN",
  country: "ZA",
  code: "4420",
};

/** Business days between payment and the parcel being ready (cards are printed first). */
export const HANDLING_DAYS = 5;

/** Cards and tags ship together in one small box. */
export const ORDER_PARCEL = { length_cm: 20, width_cm: 15, height_cm: 5 };

/** Weight of one item (kg): a card or tag is light; the box sets the minimum. */
export const DEFAULT_UNIT_WEIGHT_KG = 0.01;
export const UNIT_WEIGHT_KG: Record<number, number> = {};
export const MIN_PARCEL_WEIGHT_KG = 0.1;

export const unitWeightKg = (productId: number) => UNIT_WEIGHT_KG[productId] ?? DEFAULT_UNIT_WEIGHT_KG;

/** The pickup option stays available alongside Bob Go's rates. */
export const PICKUP_METHOD = SHIPPING_METHODS.find((m) => m.id === "pickup")!;
