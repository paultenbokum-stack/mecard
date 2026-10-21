import "server-only";
import { and, eq, inArray, isNull, lt, gte, ne, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { cards, carts, entitlements, orderNotes, orders, users } from "@/db/schema";
import {
  basketAction,
  type BasketReminder,
  DAY,
  markSent,
  ON_HOLD_REMINDER_AFTER,
  ON_HOLD_REMINDER_UNTIL,
  ORPHAN_CARDS_AFTER,
  REMINDER_PRODUCTS,
} from "./automation-rules";
import { cardCartKeysFor, removeLine } from "./cart";
import { sendEmail } from "./email";
import { BANK_ACCOUNT } from "./invoice-settings";
import { rands } from "./money";
import { siteUrl } from "./site";

// The AutomateWoo workflows as one job, run on a schedule (see /api/cron/automations).
// Safe to run as often as you like: every step records what it did.

const ORPHAN_SWEEP_WINDOW = 90 * DAY;

function basketEmail(r: BasketReminder, firstName: string) {
  const basket = siteUrl("/basket/");
  const checkout = siteUrl("/checkout/");
  const shop = siteUrl("/");
  if (r === "checkout") {
    return {
      subject: "Confirm your MeCard Order",
      text: [
        `Hi ${firstName || "MeCard Fan"},`,
        "",
        "Congrats on joining the growing movement of people who say \"No!\" to wasteful, expensive and not very smart paper business cards.",
        "",
        "Technology has moved on and so have you.",
        "",
        "Next steps",
        "- Confirm you have everything you need in your shopping basket",
        "- Check out and pay by credit/debit card or EFT (direct bank transfer). Make sure your order and shipping details are correct, as your invoice and waybills are generated automatically.",
        "",
        `Review your basket: ${basket}`,
        "",
        "Then",
        "- Add your logo and fill in the name and job title for your Classic MeCards",
        "- Upload your custom design and position the QR code for your Custom MeCards",
        "- Click \"Submit design\" when you are happy everything looks good.",
        "",
        "That's it! Now you can sit back and wait for the MeCard team to review your order and begin manufacturing. If we pick up any problems with your design we will let you know and you'll be able to make adjustments.",
        "",
        `When you are ready, go ahead and check out: ${checkout}`,
        "",
        "Thanks and chat soon,",
        "The MeCard Team",
      ].join("\n"),
    };
  }
  if (r === "day1") {
    return {
      subject: `Still thinking it over, ${firstName || "friend"}?`,
      text: [
        `Hi ${firstName || "there"},`,
        "",
        `It looks like you didn't get to finish checking out on ${shop}, so we saved your cards in your basket for you.`,
        "",
        "Your basket will stay active for another 6 days.",
        "",
        "Remember, once your order is placed you can take as long as you like to submit your card designs. We know it can take time to perfect your design, so no rush.",
        "",
        "At MeCard we like to keep things neat and tidy, so if you haven't checked out after a week we will automatically remove your cards and other items in your basket.",
        "",
        `Complete your order: ${basket}`,
        "",
        "See you soon,",
        "The team at MeCard",
      ].join("\n"),
    };
  }
  return {
    subject: "Complete your MeCard order",
    text: [
      `Hi ${firstName || "there"},`,
      "",
      `We've noticed that you added cards to your account on ${shop} 5 days ago, but still haven't completed your order.`,
      "",
      "Remember, once your order is placed you can take as long as you like to submit your card designs. We know it can take time to perfect your design, so no rush.",
      "",
      "At MeCard we like to keep things neat and tidy, so if you haven't checked out within 48 hours we will automatically remove your cards and other items in your basket. If this happens and you still want to upgrade your business cards to smart ones, you can always place another order.",
      "",
      `Complete your order: ${basket}`,
      "",
      "See you soon,",
      "The team at MeCard",
    ].join("\n"),
  };
}

/** Abandoned baskets: the three reminders, then emptied after 7 days. */
async function runBaskets(now: Date, log: string[]) {
  const counts = { checkout: 0, day1: 0, day5: 0, expired: 0 };
  const rows = await db
    .select({ c: carts, email: users.email, firstName: users.firstName })
    .from(carts)
    .innerJoin(users, eq(users.id, carts.userId))
    .where(sql`jsonb_array_length(${carts.items}) > 0`);
  for (const { c, email, firstName } of rows) {
    const action = basketAction({
      ageMs: now.getTime() - c.updatedAt.getTime(),
      sent: c.remindersSent,
      hasCards: c.items.some((l) => REMINDER_PRODUCTS.includes(l.productId)),
      empty: !c.items.length,
    });
    if (!action) continue;
    if (action === "expire") {
      // Removing each line archives its cards and cancels its entitlement rows, as removing it by hand does.
      for (const l of c.items) await removeLine(c.userId, l.key);
      counts.expired++;
      log.push(`basket of user ${c.userId}: emptied after 7 days (${c.items.length} line(s))`);
      continue;
    }
    const msg = basketEmail(action, firstName);
    const sent = await sendEmail({ to: email, ...msg });
    if (!sent.ok) {
      log.push(`basket of user ${c.userId}: ${action} reminder failed: ${sent.error}`);
      continue;
    }
    // Recorded without touching updated_at, which is when the basket last changed
    // (any change to the basket resets reminders_sent).
    await db.update(carts).set({ remindersSent: markSent(c.remindersSent, action) }).where(eq(carts.userId, c.userId));
    counts[action]++;
    log.push(`basket of user ${c.userId}: ${action} reminder sent to ${email}`);
  }
  return counts;
}

/** Trash Abandoned Tags: cards still marked as in a basket that no longer has them. */
async function runOrphanCards(now: Date, log: string[]) {
  const live = new Set<string>();
  for (const c of await db.select({ userId: carts.userId, items: carts.items }).from(carts)) for (const k of cardCartKeysFor(c.items, c.userId)) live.add(k);
  const candidates = await db
    .select({ id: cards.id, key: cards.cartItemKey })
    .from(cards)
    .where(
      and(
        sql`${cards.cartItemKey} is not null and ${cards.cartItemKey} <> ''`,
        isNull(cards.orderId),
        eq(cards.archived, false),
        lt(cards.createdAt, new Date(now.getTime() - ORPHAN_CARDS_AFTER)),
        // Older leftovers from WordPress are a one-off decision, not this job's.
        gte(cards.createdAt, new Date(now.getTime() - ORPHAN_SWEEP_WINDOW)),
      ),
    );
  const orphans = candidates.filter((c) => !live.has(c.key!));
  if (!orphans.length) return 0;
  const ids = orphans.map((c) => c.id);
  const keys = [...new Set(orphans.map((c) => c.key!))];
  await db.transaction(async (tx) => {
    await tx.update(cards).set({ archived: true, updatedAt: now }).where(inArray(cards.id, ids));
    // Their entitlement rows use the basket line key (the card key without "-<user id>").
    const lineKeys = keys.map((k) => k.replace(/-\d+$/, ""));
    await tx
      .update(entitlements)
      .set({ status: "cancelled", updatedAt: now })
      .where(and(eq(entitlements.status, "in_cart"), inArray(entitlements.cartItemKey, [...new Set([...keys, ...lineKeys])])));
  });
  log.push(`archived ${ids.length} card(s) left from abandoned baskets: ${ids.join(", ")}`);
  return ids.length;
}

const ON_HOLD_NOTE = "On-hold payment reminder sent.";

/** Order on hold: an EFT reminder 2 days after, if it still isn't paid. */
async function runOnHold(now: Date, log: string[]) {
  // When it went on hold: the status change in its history, or when it was placed.
  const since = sql<Date>`coalesce((select max(n.created_at) from order_notes n where n.order_id = "orders"."id" and n.body like '%to On hold.%'), ${orders.createdAt})`;
  const rows = await db
    .select({ o: orders, since })
    .from(orders)
    .where(
      and(
        eq(orders.status, "on-hold"),
        ne(orders.billingEmail, ""),
        sql`not exists (select 1 from order_notes n where n.order_id = "orders"."id" and n.body = ${ON_HOLD_NOTE})`,
        // ISO strings: inside sql`` a Date would be sent as its toString().
        sql`${since} <= ${new Date(now.getTime() - ON_HOLD_REMINDER_AFTER).toISOString()}::timestamptz`,
        sql`${since} > ${new Date(now.getTime() - ON_HOLD_REMINDER_UNTIL).toISOString()}::timestamptz`,
      ),
    );
  let n = 0;
  for (const { o } of rows) {
    const sent = await sendEmail({
      to: o.billingEmail,
      subject: "Your MeCard order is on hold",
      text: [
        `Hi ${o.billingFirstName || "there"},`,
        "",
        "Thanks for placing your MeCard order!",
        "",
        "We haven't picked up a payment from you yet, so just a friendly reminder to make your payment by EFT into this bank account:",
        "",
        `  ${BANK_ACCOUNT.accountName}`,
        `  ${BANK_ACCOUNT.bank}`,
        `  Account number: ${BANK_ACCOUNT.accountNumber}`,
        `  Branch code: ${BANK_ACCOUNT.branchCode}`,
        `  Reference: ${o.id}`,
        "",
        `Amount: ${rands(o.totalCents)}`,
        "",
        "If you have already paid and believe you have received this in error, please reply and if possible attach your proof of payment so we can check and update our records.",
        "",
        "Have a great day further :)",
        "",
        "The MeCard Team",
      ].join("\n"),
    });
    if (!sent.ok) {
      log.push(`order ${o.id}: on-hold reminder failed: ${sent.error}`);
      continue;
    }
    await db.insert(orderNotes).values({ orderId: o.id, body: ON_HOLD_NOTE });
    n++;
    log.push(`order ${o.id}: on-hold reminder sent to ${o.billingEmail}`);
  }
  return n;
}

export async function runAutomations(now = new Date()) {
  const log: string[] = [];
  const baskets = await runBaskets(now, log);
  const orphanCards = await runOrphanCards(now, log);
  const onHoldReminders = await runOnHold(now, log);
  return { ranAt: now.toISOString(), baskets, orphanCards, onHoldReminders, log };
}
