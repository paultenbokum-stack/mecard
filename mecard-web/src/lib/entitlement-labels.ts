// Entitlement statuses and types (wp_mecard_entitlements), with the words staff see.

export const ENTITLEMENT_STATUS_LABEL: Record<string, string> = {
  in_cart: "In basket",
  paid_unassigned: "Paid, not used",
  paid_assigned: "Paid, assigned",
  consumed: "Used",
  cancelled: "Cancelled",
};

export const ENTITLEMENT_TYPE_LABEL: Record<string, string> = {
  pro_upgrade: "Pro upgrade",
  classic_card: "Classic card",
  custom_card: "Custom card",
  phone_tag: "Phone tag",
};
