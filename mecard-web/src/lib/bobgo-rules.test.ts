import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addressComplete,
  bobgoStatusFor,
  orderRequest,
  orderStatusRequest,
  orderUpdateRequest,
  parseRates,
  paymentStatusFor,
  ratesRequest,
} from "./bobgo-rules";

const address = { street: "1 Mvula Street", suburb: "Zululami", city: "Ballito", province: "KwaZulu-Natal", postcode: "4420" };
const lines = [
  { productId: 978, name: "35mm Round sticker - with QR Code", qty: 10, unitPriceCents: 2995 },
  { productId: 1472, name: "Epoxy Waterproof Tag 60x37.5mm", qty: 10, unitPriceCents: 7500 },
];

test("rates request: province becomes Bob Go's zone code, prices in Rands, parcel sizes per product", () => {
  const body = ratesRequest(address, lines, 90000);
  assert.deepEqual(body.delivery_address, {
    company: "",
    street_address: "1 Mvula Street",
    local_area: "Zululami",
    city: "Ballito",
    zone: "KZN",
    country: "ZA",
    code: "4420",
  });
  assert.equal(body.declared_value, 1049.5);
  assert.equal(body.order_total_price, 900);
  // One 20 x 20 x 20 cm box for the whole order, weighing the tags (10 x 5 g + 10 x 10 g).
  assert.equal(body.items.length, 1);
  assert.deepEqual(
    { ...body.items[0], description: undefined },
    {
      description: undefined,
      sku: "mecard-order",
      price: 1049.5,
      quantity: 1,
      length_cm: 20,
      width_cm: 15,
      height_cm: 5,
      weight_kg: 0.2, // 20 items × 10 g (MeCard's per-item weight)
    },
  );
  assert.equal(ratesRequest(address, [lines[0]], 0).items[0].weight_kg, 0.1); // never below the packaging minimum
  assert.equal(body.collection_address.zone, "KZN");
});

test("parseRates keeps valid rates (in cents) and skips malformed ones", () => {
  const rates = parseRates({
    rates: [
      { service_name: "Courier Guy Economy", service_code: "ECO", total_price: 99.5, description: "2-3 days" },
      { service_name: "", service_code: "X", total_price: 10 },
      { service_name: "No code", total_price: 10 },
      { service_name: "Bad price", service_code: "B", total_price: "abc" },
    ],
  });
  assert.deepEqual(rates, [{ serviceCode: "ECO", label: "Courier Guy Economy", cents: 9950, description: "2-3 days" }]);
  assert.deepEqual(parseRates({}), []);
  assert.deepEqual(parseRates(null), []);
});

test("order request matches Bob Go's create order fields", () => {
  const body = orderRequest({
    id: 723,
    firstName: "Pat",
    lastName: "Doe",
    email: "pat@example.com",
    phone: "0821234567",
    address,
    shippingMethod: "Courier Guy Economy",
    shippingCents: 9950,
    lines,
  });
  assert.equal(body.channel_order_number, "723");
  assert.equal(body.buyer_selected_shipping_cost, 99.5);
  assert.equal(body.payment_status, "paid");
  assert.deepEqual(body.order_items[0], { description: lines[0].name, sku: "978", unit_price: 29.95, qty: 10, unit_weight_kg: 0.01 });
});

test("addressComplete needs street, suburb, city, province and postcode", () => {
  assert.equal(addressComplete(address), true);
  assert.equal(addressComplete({ ...address, suburb: " " }), false);
});

test("discount, service code, date and note are sent like the plugin; updates leave the items alone", () => {
  const o = {
    id: 723,
    firstName: "Pat",
    lastName: "Doe",
    email: "pat@example.com",
    phone: "0821234567",
    address,
    shippingMethod: "Standard shipping",
    shippingCents: 7185,
    serviceCode: "bobgo_250862_629_0",
    discountCents: 23960,
    placedAt: new Date("2026-10-18T09:00:00Z"),
    note: "Leave at reception",
    lines: [{ productId: 978, name: "35mm Round sticker - with QR Code", qty: 40, unitPriceCents: 2995 }],
  };
  const body = orderRequest(o);
  // R1198.00 of goods − R239.60 discount + R71.85 shipping = R1030.25, what the buyer paid.
  assert.equal(body.total_discount, 239.6);
  assert.equal(body.buyer_selected_service_code, "bobgo_250862_629_0");
  assert.equal(body.date_placed_on_channel, "2026-10-18T09:00:00.000Z");
  assert.equal(body.note, "Leave at reception");
  assert.equal(body.channel_ref_id, "723");
  const upd = orderUpdateRequest(61473112, o);
  assert.equal(upd.id, 61473112);
  assert.equal("order_items" in upd, false);
  assert.equal(upd.total_discount, 239.6);
  // No discount or service code: the fields are left out.
  const plain = orderRequest({ ...o, discountCents: 0, serviceCode: "", note: "" });
  assert.equal("total_discount" in plain, false);
  assert.equal("buyer_selected_service_code" in plain, false);
  assert.equal("note" in plain, false);
});

test("status changes: cancel/complete/re-open request and Bob Go payment status", () => {
  const o = {
    id: 723,
    firstName: "Pat",
    lastName: "Doe",
    email: "p@e.com",
    phone: "1",
    address,
    shippingMethod: "Standard",
    shippingCents: 7185,
    lines,
  };
  const cancel = orderStatusRequest(61473112, { ...o, status: "cancelled" }, "cancelled");
  assert.equal(cancel.id, 61473112);
  assert.equal(cancel.status, "cancelled");
  assert.equal(cancel.payment_status, "unpaid");
  assert.equal("order_items" in cancel, false);
  assert.equal(paymentStatusFor("processing"), "paid");
  assert.equal(paymentStatusFor("completed"), "paid");
  assert.equal(paymentStatusFor("on-hold"), "pending");
  assert.equal(paymentStatusFor("refunded"), "refunded");
  assert.equal(paymentStatusFor("pending"), "unpaid");
});

test("bobgoStatusFor: cancelled, failed and refunded cancel; a refund after completed doesn't", () => {
  assert.equal(bobgoStatusFor("cancelled", "processing"), "cancelled");
  assert.equal(bobgoStatusFor("failed", "processing"), "cancelled");
  assert.equal(bobgoStatusFor("refunded", "processing"), "cancelled");
  assert.equal(bobgoStatusFor("refunded", "on-hold"), "cancelled");
  assert.equal(bobgoStatusFor("refunded", "completed"), null);
  assert.equal(bobgoStatusFor("completed", "processing"), "completed");
  assert.equal(bobgoStatusFor("processing", "cancelled"), "processing");
  assert.equal(bobgoStatusFor("on-hold", "processing"), null);
  assert.equal(bobgoStatusFor("pending"), null);
});
