import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

// IDs are kept from WordPress on import (users = wp_users.ID, companies, profiles,
// cards, links and orders = their post ID) so old links, order numbers and the
// entitlements table line up without a mapping table.
// Toolset relationships become plain foreign keys: every MeCard relationship is
// one-to-many, so no join tables are needed.

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

export const users = pgTable(
  "users",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    email: varchar("email", { length: 255 }).notNull(),
    // WordPress user_login; people can sign in with it as well as their email.
    username: varchar("username", { length: 60 }),
    // WordPress hash ($wp$2y$…, $P$…) until first login, then bcrypt.
    passwordHash: text("password_hash"),
    firstName: varchar("first_name", { length: 100 }).notNull().default(""),
    lastName: varchar("last_name", { length: 100 }).notNull().default(""),
    displayName: varchar("display_name", { length: 250 }).notNull().default(""),
    phone: varchar("phone", { length: 50 }).notNull().default(""),
    isAdmin: boolean("is_admin").notNull().default(false),
    // WooCommerce wc_last_active; used to decide which data is "active".
    lastActiveAt: timestamp("last_active_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("users_email_lower").on(sql`lower(${t.email})`),
    uniqueIndex("users_username_lower").on(sql`lower(${t.username})`),
  ],
);

// A company (team) owns branding shared by its profiles and cards.
export const companies = pgTable(
  "companies",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 200 }).notNull().unique(),
    ownerId: integer("owner_id").references(() => users.id, { onDelete: "set null" }),
    phone: varchar("phone", { length: 100 }).notNull().default(""),
    website: varchar("website", { length: 500 }).notNull().default(""),
    address: text("address").notNull().default(""),
    supportEmail: varchar("support_email", { length: 255 }).notNull().default(""),
    descriptionHtml: text("description_html").notNull().default(""),
    // Original upload path (/wp-content/uploads/…); served through the image route.
    logoPath: text("logo_path"),
    // Branding. Fonts keep the WordPress option values (opensans, Montserrat, …).
    headingFont: varchar("heading_font", { length: 50 }).notNull().default(""),
    headingColour: varchar("heading_colour", { length: 20 }).notNull().default(""),
    bodyFont: varchar("body_font", { length: 50 }).notNull().default(""),
    bodyColour: varchar("body_colour", { length: 20 }).notNull().default(""),
    accentColour: varchar("accent_colour", { length: 20 }).notNull().default(""),
    buttonTextColour: varchar("button_text_colour", { length: 20 }).notNull().default(""),
    downloadColour: varchar("download_colour", { length: 20 }).notNull().default(""),
    downloadTextColour: varchar("download_text_colour", { length: 20 }).notNull().default(""),
    // Scoped to the profile container when rendered.
    customCss: text("custom_css").notNull().default(""),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("companies_owner").on(t.ownerId)],
);

export const profiles = pgTable(
  "profiles",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    // Public URL /mecard-profile/<slug>/ — never changes once issued.
    slug: varchar("slug", { length: 200 }).notNull().unique(),
    // The person the profile belongs to (me_profile_owner_user_id).
    ownerId: integer("owner_id").references(() => users.id, { onDelete: "set null" }),
    // Who administers it (WordPress post_author): the owner, or a team admin.
    managerId: integer("manager_id").references(() => users.id, { onDelete: "set null" }),
    companyId: integer("company_id").references(() => companies.id, { onDelete: "set null" }),
    type: varchar("type", { length: 20 }).notNull().default("standard"), // standard | pro
    firstName: varchar("first_name", { length: 100 }).notNull().default(""),
    lastName: varchar("last_name", { length: 100 }).notNull().default(""),
    jobTitle: varchar("job_title", { length: 200 }).notNull().default(""),
    email: varchar("email", { length: 255 }).notNull().default(""),
    mobile: varchar("mobile", { length: 50 }).notNull().default(""),
    whatsapp: varchar("whatsapp", { length: 50 }).notNull().default(""),
    workPhone: varchar("work_phone", { length: 50 }).notNull().default(""),
    // Shown when the profile has no company record (free and standard profiles).
    companyName: varchar("company_name", { length: 255 }).notNull().default(""),
    website: varchar("website", { length: 500 }).notNull().default(""),
    // { facebook, twitter, linkedin, instagram, youtube, tiktok } as full URLs.
    socials: jsonb("socials").$type<Record<string, string>>().notNull().default({}),
    photoPath: text("photo_path"),
    companyLogoPath: text("company_logo_path"),
    hideProfileLinkOnVcard: boolean("hide_profile_link_on_vcard").notNull().default(false),
    // { stage, started, completed, installDone, installSkipped }
    onboarding: jsonb("onboarding").$type<Record<string, string>>().notNull().default({}),
    archived: boolean("archived").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("profiles_owner").on(t.ownerId),
    index("profiles_manager").on(t.managerId),
    index("profiles_company").on(t.companyId),
  ],
);

// "More links" buttons, on a profile or company-wide.
export const profileLinks = pgTable(
  "profile_links",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    profileId: integer("profile_id").references(() => profiles.id, { onDelete: "cascade" }),
    companyId: integer("company_id").references(() => companies.id, { onDelete: "cascade" }),
    label: varchar("label", { length: 255 }).notNull().default(""),
    url: text("url").notNull().default(""),
    icon: varchar("icon", { length: 100 }).notNull().default(""),
    sortOrder: integer("sort_order").notNull().default(0),
    // The Toolset views ordered company links by last change, profile links by creation.
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("links_profile").on(t.profileId), index("links_company").on(t.companyId)],
);

// Physical cards and NFC tags (WordPress post type `t`).
export const cards = pgTable(
  "cards",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    // Printed on the chip and QR code as /t/<slug>/ — never changes.
    slug: varchar("slug", { length: 200 }).notNull().unique(),
    title: varchar("title", { length: 255 }).notNull().default(""),
    ownerId: integer("owner_id").references(() => users.id, { onDelete: "set null" }),
    profileId: integer("profile_id").references(() => profiles.id, { onDelete: "set null" }),
    companyId: integer("company_id").references(() => companies.id, { onDelete: "set null" }),
    orderId: integer("order_id"),
    // classiccard | contactcard | keyring | phonetag | iotag
    type: varchar("type", { length: 30 }).notNull().default(""),
    label: varchar("label", { length: 255 }).notNull().default(""),
    nameOnCard: varchar("name_on_card", { length: 255 }).notNull().default(""),
    jobTitleOnCard: varchar("job_title_on_card", { length: 255 }).notNull().default(""),
    frontPath: text("front_path"),
    backPath: text("back_path"),
    qrX: varchar("qr_x", { length: 20 }).notNull().default(""),
    qrY: varchar("qr_y", { length: 20 }).notNull().default(""),
    qrWidth: varchar("qr_width", { length: 20 }).notNull().default(""),
    qrCodeColour: varchar("qr_code_colour", { length: 20 }).notNull().default(""),
    qrFillColour: varchar("qr_fill_colour", { length: 20 }).notNull().default(""),
    autoDownloadVcard: boolean("auto_download_vcard").notNull().default(false),
    // Production workflow flags, in order.
    designSubmitted: boolean("design_submitted").notNull().default(false),
    designReceived: boolean("design_received").notNull().default(false),
    printJobSetUp: boolean("print_job_set_up").notNull().default(false),
    printed: boolean("printed").notNull().default(false),
    encoded: boolean("encoded").notNull().default(false),
    packaged: boolean("packaged").notNull().default(false),
    shipped: boolean("shipped").notNull().default(false),
    status: varchar("status", { length: 30 }).notNull().default(""),
    cartItemKey: varchar("cart_item_key", { length: 191 }),
    archived: boolean("archived").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("cards_owner").on(t.ownerId),
    index("cards_profile").on(t.profileId),
    index("cards_company").on(t.companyId),
    index("cards_order").on(t.orderId),
  ],
);

// Invitations for someone to take over a profile (WordPress `request` posts).
export const profileInvites = pgTable(
  "profile_invites",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    profileId: integer("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 255 }).notNull(),
    status: varchar("status", { length: 20 }).notNull().default("pending"), // pending | accepted | declined
    invitedBy: integer("invited_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("invites_profile").on(t.profileId)],
);

export const products = pgTable("products", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 200 }).notNull().unique(),
  description: text("description").notNull().default(""), // HTML
  priceCents: integer("price_cents").notNull(),
  // Shown struck through next to the price when higher (WooCommerce sale price).
  regularPriceCents: integer("regular_price_cents"),
  imagePath: text("image_path"),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const orders = pgTable(
  "orders",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    // pending | on-hold | processing | shipped | completed | cancelled | refunded | failed
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    subtotalCents: integer("subtotal_cents").notNull().default(0),
    shippingCents: integer("shipping_cents").notNull().default(0),
    discountCents: integer("discount_cents").notNull().default(0),
    couponCode: varchar("coupon_code", { length: 50 }).notNull().default(""),
    totalCents: integer("total_cents").notNull(),
    shippingMethod: varchar("shipping_method", { length: 100 }).notNull().default(""),
    shippingServiceCode: varchar("shipping_service_code", { length: 100 }).notNull().default(""),
    bobgoOrderId: varchar("bobgo_order_id", { length: 64 }),
    bobgoStatus: varchar("bobgo_status", { length: 20 }),
    bobgoError: text("bobgo_error"),
    // The courier's shipment, from Bob Go tracking or typed by staff.
    trackingReference: varchar("tracking_reference", { length: 64 }).notNull().default(""),
    courierName: varchar("courier_name", { length: 100 }).notNull().default(""),
    shippedAt: timestamp("shipped_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    paymentMethod: varchar("payment_method", { length: 50 }).notNull().default("payfast"),
    payfastPaymentId: varchar("payfast_payment_id", { length: 64 }),
    billingFirstName: varchar("billing_first_name", { length: 100 }).notNull().default(""),
    billingLastName: varchar("billing_last_name", { length: 100 }).notNull().default(""),
    billingCompany: varchar("billing_company", { length: 200 }).notNull().default(""),
    billingEmail: varchar("billing_email", { length: 255 }).notNull().default(""),
    billingPhone: varchar("billing_phone", { length: 50 }).notNull().default(""),
    address1: varchar("address_1", { length: 255 }).notNull().default(""),
    address2: varchar("address_2", { length: 255 }).notNull().default(""),
    suburb: varchar("suburb", { length: 100 }).notNull().default(""),
    city: varchar("city", { length: 100 }).notNull().default(""),
    province: varchar("province", { length: 100 }).notNull().default(""),
    postcode: varchar("postcode", { length: 20 }).notNull().default(""),
    country: varchar("country", { length: 2 }).notNull().default("ZA"),
    notes: text("notes").notNull().default(""),
    createdAt: createdAt(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
  },
  (t) => [index("orders_user").on(t.userId), index("orders_status").on(t.status)],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: integer("product_id").notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    quantity: integer("quantity").notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
    // Card customisation captured at checkout (product add-ons, design choices).
    meta: jsonb("meta").$type<Record<string, string>>().notNull().default({}),
  },
  (t) => [index("order_items_order").on(t.orderId)],
);

// Order history, like WooCommerce order notes.
export const orderNotes = pgTable(
  "order_notes",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    customerNote: boolean("customer_note").notNull().default(false),
    authorId: integer("author_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("order_notes_order").on(t.orderId, t.createdAt)],
);

export const coupons = pgTable(
  "coupons",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    code: varchar("code", { length: 50 }).notNull(),
    description: text("description").notNull().default(""),
    // "percent": amount is a whole percentage; "fixed_cart": amount is cents off the basket
    discountType: varchar("discount_type", { length: 20 }).notNull().default("percent"),
    amount: integer("amount").notNull().default(0),
    freeShipping: boolean("free_shipping").notNull().default(false),
    minSpendCents: integer("min_spend_cents"),
    productIds: integer("product_ids").array().notNull().default(sql`'{}'::integer[]`),
    allowedUserIds: integer("allowed_user_ids").array().notNull().default(sql`'{}'::integer[]`),
    usageLimit: integer("usage_limit"),
    usageLimitPerUser: integer("usage_limit_per_user"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("coupons_code_lower").on(sql`lower(${t.code})`)],
);

// Paid order items unlock upgrades (pro profile, classic or custom card, phone
// tag). Copied as is from wp_mecard_entitlements.
export const entitlements = pgTable(
  "entitlements",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    ownerId: integer("owner_id").notNull(),
    teamId: integer("team_id"),
    // pro_upgrade | classic_card | custom_card | phone_tag
    type: varchar("type", { length: 32 }).notNull(),
    // in_cart | paid_unassigned | paid_assigned | consumed | cancelled
    status: varchar("status", { length: 32 }).notNull(),
    groupKey: varchar("group_key", { length: 64 }),
    sourceOrderId: integer("source_order_id"),
    sourceOrderItemId: integer("source_order_item_id"),
    sourceProductId: integer("source_product_id"),
    cartItemKey: varchar("cart_item_key", { length: 191 }),
    assignedProfileId: integer("assigned_profile_id"),
    assignedCardId: integer("assigned_card_id"),
    assignedTagId: integer("assigned_tag_id"),
    meta: jsonb("meta").$type<Record<string, unknown>>(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
  },
  (t) => [
    index("entitlements_owner").on(t.ownerId, t.status, t.type),
    index("entitlements_order_item").on(t.sourceOrderItemId),
    index("entitlements_profile").on(t.assignedProfileId),
  ],
);

// Analytics events (wp_mecard_events): profile views, vCard downloads, funnel steps.
export const events = pgTable(
  "events",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    name: varchar("name", { length: 64 }).notNull(),
    sessionId: varchar("session_id", { length: 64 }),
    userId: integer("user_id"),
    profileId: integer("profile_id"),
    companyId: integer("company_id"),
    source: varchar("source", { length: 32 }),
    referrer: text("referrer"),
    country: varchar("country", { length: 2 }),
    uaHash: varchar("ua_hash", { length: 64 }),
    // phone | tablet | desktop, from the user agent at the time (none before October 2026).
    device: varchar("device", { length: 10 }),
    ipHash: varchar("ip_hash", { length: 64 }),
    meta: jsonb("meta").$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [index("events_profile_time").on(t.profileId, t.createdAt), index("events_name_time").on(t.name, t.createdAt)],
);

// Every image the app serves. Rows are created by the image migration and by
// the automatic restore from the archive bucket.
export const media = pgTable("media", {
  // Original WordPress upload path, e.g. 2024/03/photo.jpg
  legacyPath: text("legacy_path").primaryKey(),
  storageKey: text("storage_key").notNull(),
  width: integer("width"),
  height: integer("height"),
  bytes: integer("bytes"),
  restoredFromArchive: boolean("restored_from_archive").notNull().default(false),
  createdAt: createdAt(),
});

export const passwordResets = pgTable("password_resets", {
  token: varchar("token", { length: 64 }).primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

// The basket, kept on the server (WooCommerce kept it in its session table) so
// it follows the customer between devices and abandoned-basket reminders can
// find it. One per user: checkout needs an account, as on WordPress.
export interface CartLine {
  /** Like WooCommerce's cart item key: ties the line to the cards and entitlements it created. */
  key: string;
  productId: number;
  qty: number;
  /** The profile a Pro upgrade or bundle is for (mecard_profile_id). */
  profileId: number | null;
  /** Lines from an accepted quote keep the quoted price. */
  unitPriceCents?: number;
  quoteId?: number;
}

export const carts = pgTable("carts", {
  userId: integer("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  items: jsonb("items").$type<CartLine[]>().notNull().default([]),
  couponCode: varchar("coupon_code", { length: 50 }).notNull().default(""),
  // Abandoned-basket reminders sent for the current contents (1 day, 5 days).
  remindersSent: integer("reminders_sent").notNull().default(0),
  updatedAt: updatedAt(),
});

export interface QuoteLine {
  productId: number;
  name: string;
  qty: number;
  unitPriceCents: number;
}

// Quotes (replacing YITH Request a Quote): asked for at /request-quote/, sent
// as an email with a PDF and a link to accept (into the basket, at the quoted
// prices, then checkout) or reject. Valid for 10 days, as YITH was set up.
export const quotes = pgTable(
  "quotes",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    // new | sent | accepted | rejected | expired
    status: varchar("status", { length: 20 }).notNull().default("new"),
    name: varchar("name", { length: 200 }).notNull().default(""),
    email: varchar("email", { length: 255 }).notNull(),
    phone: varchar("phone", { length: 50 }).notNull().default(""),
    company: varchar("company", { length: 255 }).notNull().default(""),
    message: text("message").notNull().default(""),
    items: jsonb("items").$type<QuoteLine[]>().notNull().default([]),
    subtotalCents: integer("subtotal_cents").notNull().default(0),
    discountCents: integer("discount_cents").notNull().default(0),
    totalCents: integer("total_cents").notNull().default(0),
    // Shown to the customer on the quote (the admin's note when editing it).
    note: text("note").notNull().default(""),
    orderId: integer("order_id"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("quotes_user").on(t.userId), index("quotes_email").on(sql`lower(${t.email})`)],
);

// Who changed what in the staff screens (users, companies, profiles, tags).
export const adminLog = pgTable(
  "admin_log",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    actorId: integer("actor_id").references(() => users.id, { onDelete: "set null" }),
    // user | company | profile | card
    entity: varchar("entity", { length: 20 }).notNull(),
    entityId: integer("entity_id").notNull(),
    action: varchar("action", { length: 40 }).notNull(),
    detail: text("detail").notNull().default(""),
    createdAt: createdAt(),
  },
  (t) => [index("admin_log_entity").on(t.entity, t.entityId, t.createdAt)],
);

// An account's images: what the media picker and My images show (WordPress's
// media library, which customers saw filtered to their own uploads). The file is
// in the image store under `path`; a `media` row means its WebP master is in the
// active bucket, no row means the original is still only in the archive bucket.
// Where each image is used is read from the records themselves (mediaUsage()),
// so it can't drift.
export const mediaLibrary = pgTable(
  "media_library",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    ownerId: integer("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Shared with the company's admins (uploaded from, or used by, the company).
    companyId: integer("company_id").references(() => companies.id, { onDelete: "set null" }),
    // "/wp-content/uploads/2024/03/logo.png", as stored on profiles, companies and cards.
    path: text("path").notNull(),
    filename: varchar("filename", { length: 255 }).notNull().default(""),
    title: varchar("title", { length: 255 }).notNull().default(""),
    mimeType: varchar("mime_type", { length: 100 }).notNull().default(""),
    width: integer("width"),
    height: integer("height"),
    bytes: integer("bytes"),
    wpAttachmentId: integer("wp_attachment_id"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("media_library_owner_path").on(t.ownerId, t.path),
    index("media_library_owner_time").on(t.ownerId, t.createdAt),
    index("media_library_company").on(t.companyId),
  ],
);
