import { test } from "node:test";
import assert from "node:assert/strict";
import { addressFromFields, billingLinesOf, deliveryOf, formatAddress, sameLines, shipsElsewhere } from "./addresses";

const lines = { address1: "1 Main Road", address2: "", suburb: "Rosebank", city: "Johannesburg", province: "Gauteng", postcode: "2196" };
const order = { ...lines, billingFirstName: "Thandi", billingLastName: "Nkosi", billingCompany: "Acme", shippingFirstName: "", shippingLastName: "", shippingCompany: "", billingAddress: {} };

test("addressFromFields reads a prefix and spells out WooCommerce province codes", () => {
  const form: Record<string, string> = { shipping_first_name: " Sipho ", shipping_address_1: "2 Long St", shipping_state: "WC", shipping_city: "Cape Town" };
  const a = addressFromFields((k) => form[k] ?? "", "shipping");
  assert.equal(a.firstName, "Sipho");
  assert.equal(a.province, "Western Cape");
  assert.equal(a.address1, "2 Long St");
  assert.equal(a.company, "");
});

test("an order without a separate delivery address bills and delivers to the same place", () => {
  assert.equal(shipsElsewhere(order), false);
  assert.deepEqual(billingLinesOf(order), lines);
  assert.equal(deliveryOf(order).firstName, "Thandi");
});

test("an order shipped elsewhere keeps the billing lines and the recipient apart", () => {
  const billing = { ...lines, address1: "9 Office Park", suburb: "Sandton" };
  const o = { ...order, shippingFirstName: "Sipho", shippingLastName: "Dube", billingAddress: billing };
  assert.equal(shipsElsewhere(o), true);
  assert.equal(billingLinesOf(o).address1, "9 Office Park");
  assert.equal(deliveryOf(o).firstName, "Sipho");
  assert.equal(deliveryOf(o).address1, "1 Main Road");
  assert.equal(deliveryOf(o).company, "");
});

test("sameLines ignores case and spacing; formatAddress drops blanks", () => {
  assert.ok(sameLines(lines, { ...lines, city: " johannesburg " }));
  assert.ok(!sameLines(lines, { ...lines, postcode: "2000" }));
  assert.deepEqual(formatAddress({ firstName: "Thandi", lastName: "", company: "", ...lines }), ["Thandi", "1 Main Road", "Rosebank", "Johannesburg", "Gauteng 2196"]);
});
