// Who MeCard's emails come from and go to: the one place to change them.
// For now mail goes to and from Taggable (Resend must have taggable.co.za
// verified); switch these to mecard.co.za addresses when that domain is set
// up for mail. EMAIL_FROM / CONTACT_TO / ORDER_NOTIFY_TO override them.

export const MAIL_FROM = process.env.EMAIL_FROM || "MeCard <info@taggable.co.za>";
/** Contact form, quote requests, shop notices. */
export const CONTACT_TO = process.env.CONTACT_TO || "info@taggable.co.za";
/** New, cancelled and failed orders (WooCommerce's "new order" recipient). */
export const ORDER_NOTIFY_TO = process.env.ORDER_NOTIFY_TO || CONTACT_TO;
