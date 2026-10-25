// One-off import from the WordPress database into Postgres. Safe to re-run.
//
//   WP_DATABASE_URL=mysql://user:pass@127.0.0.1:3306/dbname npm run import:wp
//
// Empties every app table first, then copies users, companies, profiles, links,
// cards, invites, products, orders, quotes, coupons, entitlements and events. IDs are
// kept, so order numbers and the entitlements table stay valid. Toolset
// relationships become foreign keys. Riscura, the blog and contact form
// submissions are left behind on purpose.
// Passwords keep their WordPress hash and are upgraded to bcrypt on first login.
import { config } from "dotenv";
config({ path: ".env.local" });

import mysql from "mysql2/promise";
import type { OrderAddressLines, SavedAddress } from "../src/db/schema";
import { provinceName } from "../src/lib/address-split";

const WP_URL = process.env.WP_DATABASE_URL;
if (!WP_URL) throw new Error("WP_DATABASE_URL is not set (see .env.example)");

type R = Record<string, unknown>;
const str = (v: unknown) => (v == null ? "" : String(v));
const int = (v: unknown) => (v == null || v === "" || Number.isNaN(Number(v)) ? null : Number(v));
const flag = (v: unknown) => str(v) === "1";
const cents = (v: unknown) => Math.round(Number(v || 0) * 100);
// DATETIME columns WordPress fills with UTC (post_date_gmt, user_registered, …).
const utc = (v: unknown) => (v && !String(v).startsWith("0000") ? new Date(String(v).replace(" ", "T") + "Z") : null);
// Local-time DATETIMEs written by the plugin (current_time('mysql')), SAST = UTC+2.
const sast = (v: unknown) => (v && !String(v).startsWith("0000") ? new Date(String(v).replace(" ", "T") + "+02:00") : null);
// Full upload URL → site-relative path, served by the image route.
const uploadPath = (url: string) => {
  const m = url.match(/\/wp-content\/uploads\/.+$/);
  return m ? m[0] : null;
};
const clip = (v: unknown, n: number) => str(v).slice(0, n);
// WordPress stored post titles (company names, card titles) and some fields HTML-
// escaped ("H&amp;M", "Matt&#8217;s") and its templates printed them as HTML.
// Plain text here: React escapes on output.
const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", hellip: "…", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“" };
const decode = (v: unknown) =>
  str(v).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) =>
    e[0] === "#" ? String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : (ENTITIES[e.toLowerCase()] ?? m),
  );
const text = (v: unknown, n: number) => decode(v).slice(0, n);

// WooCommerce's address meta (billing_* / shipping_* on the user, _billing_* / _shipping_* on the order).
const ADDRESS_META = ["first_name", "last_name", "company", "phone", "address_1", "address_2", "suburb", "city", "state", "postcode"];
const orderLines = (m: Record<string, string>, p: "_billing" | "_shipping" | "billing" | "shipping"): OrderAddressLines => ({
  address1: clip(m[`${p}_address_1`], 255),
  address2: clip(m[`${p}_address_2`], 255),
  suburb: clip(m[`${p}_suburb`], 100),
  city: clip(m[`${p}_city`], 100),
  province: provinceName(str(m[`${p}_state`])) || clip(m[`${p}_state`], 100),
  postcode: clip(m[`${p}_postcode`], 20),
});
/** A user's saved address (My Account → Addresses), or null when there is no street. */
const savedAddress = (m: Record<string, string>, p: "billing" | "shipping"): SavedAddress | null => {
  const lines = orderLines(m, p);
  if (!lines.address1.trim()) return null;
  return { firstName: clip(m[`${p}_first_name`], 100), lastName: clip(m[`${p}_last_name`], 100), company: clip(m[`${p}_company`], 200), phone: clip(m[`${p}_phone`], 50), ...lines };
};

async function main() {
  const { db } = await import("../src/db/client");
  const s = await import("../src/db/schema");
  const { sql } = await import("drizzle-orm");

  const wp = await mysql.createConnection({ uri: WP_URL, timezone: "Z", dateStrings: ["DATETIME", "DATE"] });
  await wp.query("SET time_zone = '+00:00'");
  const q = async (text: string, params: unknown[] = []) => (await wp.query(text, params))[0] as R[];

  const meta = async (postTypes: string[]) => {
    const rows = await q(
      `SELECT m.post_id, m.meta_key, m.meta_value FROM wp_postmeta m JOIN wp_posts p ON p.ID = m.post_id WHERE p.post_type IN (?)`,
      [postTypes],
    );
    const out = new Map<number, Record<string, string>>();
    for (const r of rows) {
      const id = Number(r.post_id);
      if (!out.has(id)) out.set(id, {});
      out.get(id)![str(r.meta_key)] = str(r.meta_value);
    }
    return out;
  };

  // Toolset relationship → Map(child post ID → parent post ID). Every MeCard
  // relationship allows one parent per child.
  const parentOf = async (slug: string) => {
    const rows = await q(
      `SELECT pe.element_id AS parent, ce.element_id AS child
         FROM wp_toolset_associations a
         JOIN wp_toolset_relationships r ON r.id = a.relationship_id
         JOIN wp_toolset_connected_elements pe ON pe.group_id = a.parent_id
         JOIN wp_toolset_connected_elements ce ON ce.group_id = a.child_id
        WHERE r.slug = ?`,
      [slug],
    );
    return new Map(rows.map((r) => [Number(r.child), Number(r.parent)]));
  };

  // Attachment ID → upload path.
  const attached = new Map(
    (await q(`SELECT post_id, meta_value FROM wp_postmeta WHERE meta_key = '_wp_attached_file'`)).map((r) => [
      Number(r.post_id),
      `/wp-content/uploads/${str(r.meta_value)}`,
    ]),
  );
  const attachment = (id: unknown) => (int(id) ? (attached.get(Number(id)) ?? null) : null);

  async function insert<T>(table: Parameters<typeof db.insert>[0], rows: T[], label: string) {
    for (let i = 0; i < rows.length; i += 500) await db.insert(table).values(rows.slice(i, i + 500) as never);
    console.log(`${label.padEnd(16)} ${rows.length}`);
  }

  await db.execute(sql`TRUNCATE password_resets, media, events, entitlements, coupons, quotes, order_notes, order_items, orders,
    products, profile_invites, cards, profile_links, profiles, companies, users RESTART IDENTITY CASCADE`);

  // Users
  const users = await q(`SELECT ID, user_login, user_email, user_pass, display_name, user_registered FROM wp_users`);
  const umeta = await q(
    `SELECT user_id, meta_key, meta_value FROM wp_usermeta
      WHERE meta_key IN ('first_name', 'last_name', 'wp_capabilities', 'wc_last_active')
         OR meta_key IN (${ADDRESS_META.flatMap((k) => [`'billing_${k}'`, `'shipping_${k}'`]).join(", ")})`,
  );
  const um = new Map<number, Record<string, string>>();
  for (const r of umeta) {
    const id = Number(r.user_id);
    if (!um.has(id)) um.set(id, {});
    um.get(id)![str(r.meta_key)] = str(r.meta_value);
  }
  // WordPress allows duplicate emails differing in case; keep the first (oldest) account.
  const seenEmails = new Set<string>();
  const userRows = users
    .filter((u) => {
      const e = str(u.user_email).trim().toLowerCase();
      if (!e || seenEmails.has(e)) return false;
      seenEmails.add(e);
      return true;
    })
    .map((u) => {
      const m = um.get(Number(u.ID)) ?? {};
      const active = Number(m.wc_last_active || 0);
      return {
        id: Number(u.ID),
        email: str(u.user_email).trim(),
        username: str(u.user_login) || null,
        passwordHash: str(u.user_pass) || null,
        firstName: clip(m.first_name, 100),
        lastName: clip(m.last_name, 100),
        displayName: clip(u.display_name, 250),
        phone: clip(m.billing_phone, 50),
        billingAddress: savedAddress(m, "billing"),
        shippingAddress: savedAddress(m, "shipping"),
        isAdmin: (m.wp_capabilities ?? "").includes('"administrator";b:1'),
        lastActiveAt: active > 0 ? new Date(active * 1000) : null,
        createdAt: utc(u.user_registered) ?? new Date(),
      };
    });
  await insert(s.users, userRows, "users");
  const userIds = new Set(userRows.map((u) => u.id));
  const user = (v: unknown) => (int(v) && userIds.has(Number(v)) ? Number(v) : null);
  if (users.length !== userRows.length) console.log(`  skipped ${users.length - userRows.length} users with a blank or duplicate email`);

  // Companies
  const companyPosts = await q(
    `SELECT ID, post_title, post_name, post_author, post_date_gmt, post_modified_gmt FROM wp_posts
      WHERE post_type = 'company' AND post_status = 'publish'`,
  );
  const cm = await meta(["company"]);
  const slugs = new Set<string>();
  const uniqueSlug = (slug: string, id: number) => {
    let out = slug || `company-${id}`;
    if (slugs.has(out)) out = `${out}-${id}`;
    slugs.add(out);
    return out;
  };
  await insert(
    s.companies,
    companyPosts.map((p) => {
      const m = cm.get(Number(p.ID)) ?? {};
      return {
        id: Number(p.ID),
        name: text(p.post_title, 255),
        slug: uniqueSlug(str(p.post_name), Number(p.ID)),
        ownerId: user(p.post_author),
        phone: clip(m["wpcf-company-telephone-number"], 100),
        website: clip(m["wpcf-company-website"], 500),
        address: decode(m["wpcf-company-address"]),
        supportEmail: clip(m["wpcf-support-email"], 255),
        descriptionHtml: str(m["wpcf-company-description"]),
        logoPath: attachment(m._thumbnail_id),
        headingFont: clip(m["wpcf-heading-font"], 50),
        headingColour: clip(m["wpcf-heading-font-colour"], 20),
        bodyFont: clip(m["wpcf-normal-font"], 50),
        bodyColour: clip(m["wpcf-normal-font-colour"], 20),
        accentColour: clip(m["wpcf-accent-colour"], 20),
        buttonTextColour: clip(m["wpcf-button-text-colour"], 20),
        downloadColour: clip(m["wpcf-download-button-colour"], 20),
        downloadTextColour: clip(m["wpcf-download-button-text-colour"], 20),
        customCss: decode(m["wpcf-custom-css"]),
        createdAt: utc(p.post_date_gmt) ?? new Date(),
        updatedAt: utc(p.post_modified_gmt) ?? new Date(),
      };
    }),
    "companies",
  );
  const companyIds = new Set(companyPosts.map((p) => Number(p.ID)));
  const company = (v: unknown) => (int(v) && companyIds.has(Number(v)) ? Number(v) : null);

  // Profiles. Archiving a profile trashed it in WordPress, so trash = archived.
  const profilePosts = await q(
    `SELECT ID, post_name, post_author, post_status, post_date_gmt, post_modified_gmt FROM wp_posts
      WHERE post_type = 'mecard-profile' AND post_status IN ('publish', 'trash')`,
  );
  const pm = await meta(["mecard-profile"]);
  const profileCompany = await parentOf("company-mecard-profile");
  slugs.clear();
  const instagram = (u: string) => (!u ? "" : /^https?:/i.test(u) ? u : `https://instagram.com/${u.replace(/^@/, "")}`);
  await insert(
    s.profiles,
    profilePosts.map((p) => {
      const id = Number(p.ID);
      const m = pm.get(id) ?? {};
      const type = (m["wpcf-profile-type"] || "standard").toLowerCase();
      const socials = Object.fromEntries(
        Object.entries({
          facebook: m["wpcf-facebook-url"] || m["wpcf-facebook"] || "",
          twitter: m["wpcf-twitter-url"] || "",
          linkedin: m["wpcf-linkedin-url"] || "",
          instagram: instagram(m["wpcf-instagram-user"] || m["wpcf-instagram"] || ""),
          youtube: m["wpcf-youtube-url"] || "",
          tiktok: m["wpcf-tiktok-url"] || "",
        }).filter(([, v]) => v),
      );
      const onboarding = Object.fromEntries(
        Object.entries({
          stage: m.me_onboarding_stage,
          started: m.me_onboarding_started,
          completed: m.me_onboarding_completed,
          installDone: m.me_onboarding_install_done,
          installSkipped: m.me_onboarding_install_skipped,
        }).filter(([, v]) => v),
      ) as Record<string, string>;
      return {
        id,
        slug: uniqueSlug(str(p.post_name).replace(/__trashed$/, ""), id),
        ownerId: user(m.me_profile_owner_user_id),
        managerId: user(p.post_author),
        companyId: company(profileCompany.get(id) ?? m.company_parent),
        type: type === "professional" ? "pro" : type,
        firstName: text(m["wpcf-first-name"], 100),
        lastName: text(m["wpcf-last-name"], 100),
        jobTitle: text(m["wpcf-job-title"], 200),
        email: clip(m["wpcf-email-address"] || m["wpcf-email_address"], 255),
        mobile: clip(m["wpcf-mobile-number"], 50),
        whatsapp: clip(m["wpcf-whatsapp-number"], 50),
        workPhone: clip(m["wpcf-work-phone-number"], 50),
        companyName: text(m["wpcf-company-r"] || m["wpcf-company_name"], 255),
        website: clip(m["wpcf-website"], 500),
        socials,
        photoPath: attachment(m._thumbnail_id),
        companyLogoPath: attachment(m.me_profile_company_logo_id),
        hideProfileLinkOnVcard: flag(m["wpcf-hide-profile-link-on-vcard"]),
        onboarding,
        archived: p.post_status === "trash",
        createdAt: utc(p.post_date_gmt) ?? new Date(),
        updatedAt: utc(p.post_modified_gmt) ?? new Date(),
      };
    }),
    "profiles",
  );
  const profileIds = new Set(profilePosts.map((p) => Number(p.ID)));
  const profile = (v: unknown) => (int(v) && profileIds.has(Number(v)) ? Number(v) : null);

  // More links: per profile (more-links) and company-wide (more-links-company)
  const linkPosts = await q(
    `SELECT ID, post_type, post_title, menu_order, post_date_gmt, post_modified_gmt FROM wp_posts
      WHERE post_type IN ('more-links', 'more-links-company') AND post_status = 'publish'`,
  );
  const lm = await meta(["more-links", "more-links-company"]);
  const linkProfile = await parentOf("more-links");
  const linkCompany = await parentOf("more-links-company");
  await insert(
    s.profileLinks,
    linkPosts
      .map((p) => {
        const id = Number(p.ID);
        const m = lm.get(id) ?? {};
        return {
          id,
          profileId: p.post_type === "more-links" ? profile(linkProfile.get(id)) : null,
          companyId: p.post_type === "more-links-company" ? company(linkCompany.get(id)) : null,
          label: text(m["wpcf-site-name"] || m["wpcf-button-text"] || p.post_title, 255),
          url: str(m["wpcf-site-url"] || m["wpcf-button-url"]),
          icon: clip(m["wpcf-button-icon"], 100),
          // The live views ignored toolset-post-sortorder; 0 means "not reordered
          // yet", which keeps their order (see public-profile.ts).
          sortOrder: 0,
          createdAt: utc(p.post_date_gmt) ?? new Date(),
          updatedAt: utc(p.post_modified_gmt) ?? new Date(),
        };
      })
      .filter((l) => l.profileId || l.companyId),
    "links",
  );

  // Orders are needed before cards (cards point at their order).
  const allOrderPosts = await q(
    `SELECT ID, post_status, post_excerpt, post_date_gmt FROM wp_posts WHERE post_type = 'shop_order' AND post_status <> 'trash'`,
  );
  // YITH Request a Quote kept its quotes as orders (wc-ywraq-* statuses): they become quotes.
  const isQuote = (o: R) => str(o.post_status).includes("ywraq");
  const orderPosts = allOrderPosts.filter((o) => !isQuote(o));
  const quotePosts = allOrderPosts.filter(isQuote);
  const om = await meta(["shop_order"]);
  const orderIds = new Set(orderPosts.map((o) => Number(o.ID)));
  const items = await q(`SELECT order_item_id, order_id, order_item_type, order_item_name FROM wp_woocommerce_order_items`);
  const imeta = new Map<number, Record<string, string>>();
  for (const r of await q(`SELECT order_item_id, meta_key, meta_value FROM wp_woocommerce_order_itemmeta`)) {
    const id = Number(r.order_item_id);
    if (!imeta.has(id)) imeta.set(id, {});
    imeta.get(id)![str(r.meta_key)] = str(r.meta_value);
  }
  const itemsByOrder = new Map<number, R[]>();
  for (const i of items) {
    const id = Number(i.order_id);
    if (!itemsByOrder.has(id)) itemsByOrder.set(id, []);
    itemsByOrder.get(id)!.push(i);
  }
  await insert(
    s.orders,
    orderPosts.map((o) => {
      const id = Number(o.ID);
      const m = om.get(id) ?? {};
      const ship = m._shipping_address_1 ? "_shipping" : "_billing";
      const its = itemsByOrder.get(id) ?? [];
      const lines = its.filter((i) => i.order_item_type === "line_item");
      const shipItem = its.find((i) => i.order_item_type === "shipping");
      const paid = Number(m._date_paid || 0);
      return {
        id,
        userId: user(m._customer_user),
        status: str(o.post_status).replace(/^wc-/, "").slice(0, 20),
        subtotalCents: lines.reduce((t, i) => t + cents(imeta.get(Number(i.order_item_id))?._line_subtotal), 0),
        shippingCents: cents(m._order_shipping),
        discountCents: cents(m._cart_discount),
        couponCode: clip(its.filter((i) => i.order_item_type === "coupon").map((i) => str(i.order_item_name)).join(", "), 50),
        totalCents: cents(m._order_total),
        shippingMethod: clip(shipItem?.order_item_name, 100),
        shippingServiceCode: clip(shipItem ? imeta.get(Number(shipItem.order_item_id))?.uafrica_service_code : "", 100),
        paymentMethod: clip(m._payment_method, 50),
        payfastPaymentId: m._transaction_id ? clip(m._transaction_id, 64) : null,
        billingFirstName: clip(m._billing_first_name, 100),
        billingLastName: clip(m._billing_last_name, 100),
        billingCompany: clip(m._billing_company, 200),
        billingEmail: clip(m._billing_email, 255),
        billingPhone: clip(m._billing_phone, 50),
        address1: clip(m[`${ship}_address_1`], 255),
        address2: clip(m[`${ship}_address_2`], 255),
        suburb: clip(m[`${ship}_suburb`], 100),
        city: clip(m[`${ship}_city`], 100),
        province: clip(m[`${ship}_state`], 100),
        postcode: clip(m[`${ship}_postcode`], 20),
        country: clip(m[`${ship}_country`] || "ZA", 2),
        // Shipped to a different address or person: keep the recipient and the billing lines too.
        ...(ship === "_shipping" && (orderLines(m, "_shipping").address1 !== orderLines(m, "_billing").address1 || str(m._shipping_first_name) !== str(m._billing_first_name))
          ? {
              shippingFirstName: clip(m._shipping_first_name, 100),
              shippingLastName: clip(m._shipping_last_name, 100),
              shippingCompany: clip(m._shipping_company, 200),
              billingAddress: orderLines(m, "_billing"),
            }
          : {}),
        notes: str(o.post_excerpt),
        createdAt: utc(o.post_date_gmt) ?? new Date(),
        paidAt: paid > 0 ? new Date(paid * 1000) : null,
      };
    }),
    "orders",
  );
  await insert(
    s.orderItems,
    items
      .filter((i) => i.order_item_type === "line_item" && orderIds.has(Number(i.order_id)))
      .map((i) => {
        const m = imeta.get(Number(i.order_item_id)) ?? {};
        const qty = Number(m._qty || 0);
        // Keep the customer-visible item meta (add-ons, card details); drop WooCommerce internals.
        const extra = Object.fromEntries(Object.entries(m).filter(([k]) => !k.startsWith("_")));
        return {
          id: Number(i.order_item_id),
          orderId: Number(i.order_id),
          productId: Number(m._product_id || 0),
          name: clip(i.order_item_name, 255),
          quantity: qty,
          unitPriceCents: qty ? Math.round(cents(m._line_subtotal) / qty) : 0,
          meta: extra,
        };
      }),
    "order items",
  );

  // Order notes (WooCommerce keeps them as comments on the order)
  const noteRows = await q(
    `SELECT c.comment_ID, c.comment_post_ID, c.comment_content, c.comment_date_gmt, c.user_id,
            MAX(CASE WHEN cm.meta_key = 'is_customer_note' THEN cm.meta_value END) AS is_customer_note
       FROM wp_comments c LEFT JOIN wp_commentmeta cm ON cm.comment_id = c.comment_ID
      WHERE c.comment_type = 'order_note'
      GROUP BY c.comment_ID, c.comment_post_ID, c.comment_content, c.comment_date_gmt, c.user_id`,
  );
  await insert(
    s.orderNotes,
    noteRows
      .filter((n) => orderIds.has(Number(n.comment_post_ID)))
      .map((n) => ({
        id: Number(n.comment_ID),
        orderId: Number(n.comment_post_ID),
        body: str(n.comment_content),
        customerNote: flag(n.is_customer_note),
        authorId: user(n.user_id),
        createdAt: utc(n.comment_date_gmt) ?? new Date(),
      })),
    "order notes",
  );

  // Quotes (YITH), numbered as before. Statuses: new (asked), pending (sent), expired, accepted, rejected.
  const QUOTE_STATUS: Record<string, string> = { new: "new", pending: "sent", expired: "expired", accepted: "accepted", rejected: "rejected" };
  await insert(
    s.quotes,
    quotePosts.map((o) => {
      const id = Number(o.ID);
      const m = om.get(id) ?? {};
      const qItems = (itemsByOrder.get(id) ?? [])
        .filter((i) => i.order_item_type === "line_item")
        .map((i) => {
          const im = imeta.get(Number(i.order_item_id)) ?? {};
          const qty = Number(im._qty || 0);
          return { productId: Number(im._product_id || 0), name: str(i.order_item_name), qty, unitPriceCents: qty ? Math.round(cents(im._line_subtotal) / qty) : 0 };
        });
      const subtotal = qItems.reduce((t, i) => t + i.qty * i.unitPriceCents, 0);
      const expire = str(m._ywcm_request_expire);
      return {
        id,
        userId: user(m._customer_user),
        status: QUOTE_STATUS[str(o.post_status).replace(/^wc-ywraq-/, "")] ?? "new",
        name: clip(m.ywraq_customer_name || `${str(m._billing_first_name)} ${str(m._billing_last_name)}`.trim(), 200),
        email: clip(m.ywraq_customer_email || m._billing_email, 255),
        phone: clip(m._billing_phone, 50),
        company: clip(m._billing_company, 255),
        message: str(m.ywraq_customer_message),
        items: qItems,
        subtotalCents: subtotal,
        discountCents: cents(m._cart_discount),
        totalCents: cents(m._order_total),
        note: str(m._ywcm_request_response),
        expiresAt: /^\d{4}-\d{2}-\d{2}/.test(expire) ? new Date(`${expire.slice(0, 10)}T23:59:59+02:00`) : null,
        createdAt: utc(o.post_date_gmt) ?? new Date(),
      };
    }),
    "quotes",
  );

  // Cards and tags (post type `t`). Trashed ones are kept as archived so their
  // printed URLs still resolve to something sensible.
  const cardPosts = await q(
    `SELECT ID, post_title, post_name, post_author, post_status, post_date_gmt, post_modified_gmt FROM wp_posts
      WHERE post_type = 't' AND post_status IN ('publish', 'trash')`,
  );
  const tm = await meta(["t"]);
  const cardProfile = await parentOf("mecard-profile-mecard-tag");
  const cardCompany = await parentOf("company-mecard-tag");
  const cardOrder = await parentOf("order-mecard-tag");
  slugs.clear();
  await insert(
    s.cards,
    cardPosts.map((p) => {
      const id = Number(p.ID);
      const m = tm.get(id) ?? {};
      const order = cardOrder.get(id);
      return {
        id,
        slug: uniqueSlug(str(p.post_name).replace(/__trashed$/, ""), id),
        title: text(p.post_title, 255),
        ownerId: user(p.post_author),
        profileId: profile(cardProfile.get(id)),
        companyId: company(cardCompany.get(id)),
        orderId: order && orderIds.has(order) ? order : null,
        type: clip(m["wpcf-tag-type"], 30),
        label: text(m["wpcf-card-label"], 255),
        nameOnCard: text(m["wpcf-name-on-card"], 255),
        jobTitleOnCard: text(m["wpcf-job-title-on-card"], 255),
        frontPath: uploadPath(m["wpcf-card-front"] ?? ""),
        backPath: uploadPath(m["wpcf-card-back"] ?? ""),
        qrX: clip(m["wpcf-qr-x"], 20),
        qrY: clip(m["wpcf-qr-y"], 20),
        qrWidth: clip(m["wpcf-qr-width"], 20),
        qrCodeColour: clip(m["wpcf-qr-code-colour"], 20),
        qrFillColour: clip(m["wpcf-qr-fill-colour"], 20),
        autoDownloadVcard: flag(m["wpcf-auto_download_vcard"] || m.auto_download_vcard),
        designSubmitted: flag(m["wpcf-design-submitted"]),
        designReceived: flag(m["wpcf-design-received"]),
        printJobSetUp: flag(m["wpcf-print-job-set-up"]),
        printed: flag(m["wpcf-printed"]),
        encoded: flag(m["wpcf-encoded"]),
        packaged: flag(m["wpcf-packaged"]),
        shipped: flag(m["wpcf-shipped"]),
        status: clip(m["wpcf-card-status"], 30),
        cartItemKey: m["wpcf-cart-item-key"] ? clip(m["wpcf-cart-item-key"], 191) : null,
        archived: p.post_status === "trash",
        createdAt: utc(p.post_date_gmt) ?? new Date(),
        updatedAt: utc(p.post_modified_gmt) ?? new Date(),
      };
    }),
    "cards",
  );

  // Profile invites (`request` posts under a profile)
  const requestPosts = await q(`SELECT ID, post_author, post_date_gmt FROM wp_posts WHERE post_type = 'request' AND post_status = 'publish'`);
  const rm = await meta(["request"]);
  const requestProfile = await parentOf("mecard-profile-request");
  await insert(
    s.profileInvites,
    requestPosts
      .map((p) => {
        const id = Number(p.ID);
        const m = rm.get(id) ?? {};
        return {
          id,
          profileId: profile(requestProfile.get(id))!,
          email: clip(m["wpcf-recipient-email"], 255),
          status: clip(m["wpcf-request-status"] || "pending", 20),
          invitedBy: user(p.post_author),
          createdAt: utc(p.post_date_gmt) ?? new Date(),
        };
      })
      .filter((r) => r.profileId && r.email),
    "invites",
  );

  // Products
  const prodPosts = await q(
    `SELECT ID, post_title, post_name, post_content, post_status, menu_order FROM wp_posts
      WHERE post_type = 'product' AND post_status IN ('publish', 'private', 'draft')`,
  );
  const prm = await meta(["product"]);
  await insert(
    s.products,
    prodPosts.map((p) => {
      const m = prm.get(Number(p.ID)) ?? {};
      const price = cents(m._price);
      const regular = m._regular_price ? cents(m._regular_price) : null;
      return {
        id: Number(p.ID),
        name: clip(p.post_title, 255),
        slug: str(p.post_name) || `product-${p.ID}`,
        description: str(p.post_content),
        priceCents: price,
        regularPriceCents: regular && regular > price ? regular : null,
        imagePath: attachment(m._thumbnail_id),
        active: p.post_status === "publish",
        sortOrder: Number(p.menu_order ?? 0),
      };
    }),
    "products",
  );

  // Coupons (shop_coupon posts); trashed coupons are skipped.
  const couponPosts = await q(
    `SELECT ID, post_title, post_excerpt, post_status, post_date_gmt FROM wp_posts
      WHERE post_type = 'shop_coupon' AND post_status IN ('publish', 'draft', 'pending', 'future')`,
  );
  const ccm = await meta(["shop_coupon"]);
  const idByEmail = new Map(userRows.map((u) => [u.email.toLowerCase(), u.id]));
  const allowedIds = (serialized?: string) =>
    [...(serialized ?? "").matchAll(/s:\d+:"([^"]*)"/g)]
      .map((x) => idByEmail.get(x[1].trim().toLowerCase()))
      .filter((id): id is number => !!id);
  const seenCodes = new Set<string>();
  await insert(
    s.coupons,
    couponPosts
      .filter((c) => {
        const code = str(c.post_title).trim().toLowerCase();
        if (!code || seenCodes.has(code)) return false;
        seenCodes.add(code);
        return true;
      })
      .map((c) => {
        const m = ccm.get(Number(c.ID)) ?? {};
        const percent = m.discount_type === "percent";
        const expires = Number(m.date_expires || 0);
        const limit = (v?: string) => (Number(v) > 0 ? Number(v) : null);
        return {
          id: Number(c.ID),
          code: clip(str(c.post_title).trim(), 50),
          description: str(c.post_excerpt),
          discountType: percent ? "percent" : "fixed_cart",
          amount: percent ? Math.round(Number(m.coupon_amount || 0)) : cents(m.coupon_amount),
          freeShipping: m.free_shipping === "yes",
          minSpendCents: Number(m.minimum_amount) > 0 ? cents(m.minimum_amount) : null,
          productIds: (m.product_ids ?? "").split(",").map(Number).filter((n) => n > 0),
          allowedUserIds: allowedIds(m.customer_email),
          usageLimit: limit(m.usage_limit),
          usageLimitPerUser: limit(m.usage_limit_per_user),
          expiresAt: expires > 0 ? new Date(expires * 1000) : null,
          active: c.post_status === "publish",
          createdAt: utc(c.post_date_gmt) ?? new Date(),
        };
      }),
    "coupons",
  );

  // Entitlements, copied as is. Times were written with current_time('mysql').
  const ents = await q(`SELECT * FROM wp_mecard_entitlements ORDER BY id`);
  const json = (v: unknown) => {
    try {
      return v ? JSON.parse(str(v)) : null;
    } catch {
      return null;
    }
  };
  await insert(
    s.entitlements,
    ents.map((e) => ({
      id: Number(e.id),
      ownerId: Number(e.owner_user_id),
      teamId: int(e.team_id),
      type: str(e.type),
      status: str(e.status),
      groupKey: e.group_key == null ? null : str(e.group_key),
      sourceOrderId: int(e.source_order_id),
      sourceOrderItemId: int(e.source_order_item_id),
      sourceProductId: int(e.source_product_id),
      cartItemKey: e.cart_item_key == null ? null : str(e.cart_item_key),
      assignedProfileId: int(e.assigned_profile_id),
      assignedCardId: int(e.assigned_card_id),
      assignedTagId: int(e.assigned_tag_id),
      meta: json(e.meta_json),
      createdAt: sast(e.created_at) ?? new Date(),
      updatedAt: sast(e.updated_at) ?? new Date(),
      consumedAt: sast(e.consumed_at),
    })),
    "entitlements",
  );

  // Analytics events
  const evs = await q(`SELECT * FROM wp_mecard_events ORDER BY id`);
  await insert(
    s.events,
    evs.map((e) => ({
      id: Number(e.id),
      name: clip(e.event_name, 64),
      sessionId: e.session_id == null ? null : clip(e.session_id, 64),
      userId: int(e.user_id) || null,
      profileId: int(e.profile_id) || null,
      companyId: int(e.company_id) || null,
      source: e.source == null ? null : clip(e.source, 32),
      referrer: e.referrer == null ? null : str(e.referrer),
      country: e.country == null ? null : clip(e.country, 2),
      uaHash: e.ua_hash == null ? null : clip(e.ua_hash, 64),
      ipHash: e.ip_hash == null ? null : clip(e.ip_hash, 64),
      meta: json(e.meta),
      // CURRENT_TIMESTAMP on the database server, which runs in UTC.
      createdAt: utc(e.created_at) ?? new Date(),
    })),
    "events",
  );

  // Continue numbering after the imported IDs.
  for (const t of [
    "users", "companies", "profiles", "profile_links", "cards", "profile_invites", "products",
    "orders", "order_items", "order_notes", "quotes", "coupons", "entitlements", "events",
  ]) {
    await db.execute(sql.raw(`SELECT setval(pg_get_serial_sequence('${t}', 'id'), COALESCE((SELECT max(id) FROM ${t}), 0) + 1, false)`));
  }

  // Each account's images (the media picker and My images).
  const { importMedia } = await import("./import-media");
  await importMedia(wp);

  await wp.end();
  console.log("Done.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
