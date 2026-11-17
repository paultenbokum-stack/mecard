// The AutomateWoo workflows, as rules. Pure, so they can be unit tested.
//
//   Card checkout reminder   basket with cards abandoned (15 minutes, AutomateWoo's default)
//   Abandoned cart (1 Day)   1 day after (baskets without cards, e.g. a Pro upgrade, get their own wording)
//   Abandoned Cart (5 days)  5 days after, the same
//   (WooCommerce session)    the basket is emptied after 7 days, as the emails promise
//   Trash Abandoned Tags     30 days: cards still marked as in a basket that no longer has them
//   Order on hold            2 days after an EFT order goes on hold, if it still is

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

export const ABANDONED_AFTER = 15 * MINUTE;
export const BASKET_EXPIRES_AFTER = 7 * DAY;
export const ORPHAN_CARDS_AFTER = 30 * DAY;
export const ON_HOLD_REMINDER_AFTER = 2 * DAY;
/** Older on-hold orders are left alone (the job's first run must not email the whole backlog). */
export const ON_HOLD_REMINDER_UNTIL = 7 * DAY;

/** The card products (AutomateWoo's rules: cart includes 706, 2044, 11157 or 11160; category Contact Cards). */
export const REMINDER_PRODUCTS = [706, 2044, 11157, 11160];

/** Bits in carts.reminders_sent, reset whenever the basket changes. */
export const SENT = { checkout: 1, day1: 2, day5: 4 } as const;
export type BasketReminder = keyof typeof SENT;

/**
 * What to do with a basket now: send one reminder, empty it, or nothing.
 * Each reminder has a window, so a job that was down for a while sends the
 * one that fits the basket's age, not all of them at once.
 */
export function basketAction(b: { ageMs: number; sent: number; hasCards: boolean; empty: boolean }): BasketReminder | "expire" | null {
  if (b.empty) return null;
  if (b.ageMs >= BASKET_EXPIRES_AFTER) return "expire";
  if (b.ageMs >= 5 * DAY) return b.sent & SENT.day5 ? null : "day5";
  if (b.ageMs >= DAY) return b.sent & SENT.day1 ? null : "day1";
  // The 15-minute "Confirm your MeCard Order" email is about designing cards, so only baskets with cards get it.
  if (b.ageMs >= ABANDONED_AFTER && b.hasCards) return b.sent & SENT.checkout ? null : "checkout";
  return null;
}

/** The bits to record once a reminder is sent: later ones imply the earlier ones are done. */
export function markSent(sent: number, r: BasketReminder): number {
  if (r === "day5") return sent | SENT.day5 | SENT.day1 | SENT.checkout;
  if (r === "day1") return sent | SENT.day1 | SENT.checkout;
  return sent | SENT.checkout;
}

/** The latest reminder sent for a basket's contents, for the staff baskets list (later ones set the earlier bits too). */
export function lastReminderLabel(sent: number): string | null {
  if (sent & SENT.day5) return "5 days";
  if (sent & SENT.day1) return "1 day";
  if (sent & SENT.checkout) return "15 min";
  return null;
}

export const onHoldReminderDue = (onHoldMs: number) => onHoldMs >= ON_HOLD_REMINDER_AFTER && onHoldMs < ON_HOLD_REMINDER_UNTIL;
