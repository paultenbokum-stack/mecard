import { test } from "node:test";
import assert from "node:assert/strict";
import { splitAddress } from "./address-split";

test("splitAddress reads street, suburb, city and postcode", () => {
  assert.deepEqual(splitAddress("1D Study Road, Glenhazel, Johannesburg, 2192"), {
    address1: "1D Study Road",
    address2: "",
    suburb: "Glenhazel",
    city: "Johannesburg",
    state: "",
    postcode: "2192",
  });
});

test("splitAddress keeps unit names apart and finds the province", () => {
  assert.deepEqual(splitAddress("Unit 9 and 10 Arma Park, 27 Bond Street, Randburg, Gauteng, South Africa"), {
    address1: "27 Bond Street",
    address2: "Unit 9 and 10 Arma Park",
    suburb: "",
    city: "Randburg",
    state: "Gauteng",
    postcode: "",
  });
  assert.equal(splitAddress("Unit 1 Afriscan Park, 21 Shepstone Road, New Germany, Kwa-Zulu Natal").state, "KwaZulu-Natal");
});

test("splitAddress copes with no street number and one-part addresses", () => {
  assert.deepEqual(splitAddress("Zululami Coastal Estate, Sheffield Beach"), {
    address1: "Zululami Coastal Estate",
    address2: "",
    suburb: "",
    city: "Sheffield Beach",
    state: "",
    postcode: "",
  });
  assert.equal(splitAddress("92 Rivonia Road").address1, "92 Rivonia Road");
  assert.equal(splitAddress("Bree Street, Cape Town 8001").postcode, "8001");
  assert.equal(splitAddress("Bree Street, Cape Town 8001").city, "Cape Town");
  assert.equal(splitAddress("").address1, "");
});
