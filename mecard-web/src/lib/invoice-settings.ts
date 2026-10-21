// Seller details printed on invoices (content is code: edit and deploy).
// With a VAT number the PDF is titled "Tax Invoice" and shows the VAT
// included in the total (prices include VAT, see the Terms & Conditions).
export const INVOICE_SELLER = {
  name: "Taggable (Pty) Ltd",
  registration: "2020/796653/07",
  vatNumber: "",
  address: ["Unit 1 Moyana, Zululami Luxury Coastal Estate", "Sheffield Beach, Ballito, KZN"],
  email: "info@taggable.co.za",
  website: "mecard.co.za",
  // The footer of the WordPress invoices (PDF Invoices & Packing Slips settings).
  footer: ["Taggable (Pty) Ltd", "FNB South Africa", "Account number: 62879096529", "Branch code: 250 655"],
};

export const VAT_RATE = 0.15;

/** Orders that get an invoice: paid ones (and refunded ones, marked as such). */
export const INVOICE_STATUSES = ["processing", "completed", "on-hold", "refunded"];

/** Invoice numbers are the order number with this prefix (order 722 → me722), as on WordPress. */
export const INVOICE_PREFIX = "me";
export const invoiceNumber = (orderId: number) => `${INVOICE_PREFIX}${orderId}`;

/** Direct bank transfer (WooCommerce BACS): shown on the order page and in the on-hold email. */
export const BANK_ACCOUNT = {
  accountName: "Taggable (Pty) Ltd",
  bank: "FNB South Africa",
  accountNumber: "62879096529",
  branchCode: "250 655",
};

export const bankDetailsText = (orderId: number) =>
  [
    "Our bank details:",
    `  Account name: ${BANK_ACCOUNT.accountName}`,
    `  Bank: ${BANK_ACCOUNT.bank}`,
    `  Account number: ${BANK_ACCOUNT.accountNumber}`,
    `  Branch code: ${BANK_ACCOUNT.branchCode}`,
    `  Reference: ${orderId}`,
  ].join("\n");
