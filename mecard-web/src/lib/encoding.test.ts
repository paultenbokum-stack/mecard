import { test } from "node:test";
import assert from "node:assert/strict";
import { inflateRawSync } from "node:zlib";
import { artworkFilename, encodingRow, inFile, selectedIds, toCsv, type EncodingCard } from "./encoding";
import { zip } from "./zip";

const card: EncodingCard = {
  id: 83715,
  slug: "contactcard-9858-65608",
  type: "contactcard",
  label: "Chantel",
  nameOnCard: "",
  jobTitleOnCard: "",
  frontPath: "/wp-content/uploads/mecard/2026/10/front%20one.png",
  backPath: "/wp-content/uploads/2024/07/back.jpg",
  firstName: "Chantel",
  lastName: "Cromer-Wilson",
  jobTitle: "Director, Brand",
  orderId: 501,
  companyName: "Acme",
};
const url = (slug: string) => `https://mecard.co.za/t/${slug}/`;

test("an encoding row has the old export's columns", () => {
  assert.deepEqual(encodingRow(card, url), [
    "https://mecard.co.za/t/contactcard-9858-65608/",
    "TRUE",
    "83715",
    "Chantel - Chantel Cromer-Wilson",
    "Chantel Cromer-Wilson",
    "Director, Brand",
    "front one.png",
    "back.jpg",
  ]);
});

test("classic cards print the name and title typed for the card; phone tags print nothing", () => {
  const classic = encodingRow({ ...card, type: "classiccard", nameOnCard: "C. Wilson", jobTitleOnCard: "CEO" }, url);
  assert.deepEqual(classic.slice(4, 6), ["C. Wilson", "CEO"]);
  assert.deepEqual(encodingRow({ ...card, type: "phonetag", frontPath: null, backPath: null }, url).slice(4), ["", "", "", ""]);
});

test("encoding file has custom, classic and phone tags; print file only cards", () => {
  assert.deepEqual(["contactcard", "classiccard", "phonetag", "keyring"].map((t) => inFile("encoding", t)), [true, true, true, false]);
  assert.deepEqual(["contactcard", "classiccard", "phonetag"].map((t) => inFile("print", t)), [true, true, false]);
});

test("CSV quotes only cells that need it", () => {
  assert.equal(toCsv([["a", 'say "hi"', "x, y"]]), 'a,"say ""hi""","x, y"\n');
  assert.equal(artworkFilename(null), "");
});

test("zip entries can be read back", () => {
  const data = Buffer.from("hello hello hello hello");
  const z = zip([{ name: "a.txt", data, date: new Date(2026, 9, 21, 10, 0, 0) }]);
  assert.equal(z.readUInt32LE(0), 0x04034b50);
  const method = z.readUInt16LE(8);
  const size = z.readUInt32LE(18);
  const nameLen = z.readUInt16LE(26);
  const body = z.subarray(30 + nameLen, 30 + nameLen + size);
  assert.deepEqual(method === 8 ? inflateRawSync(body) : body, data);
  assert.equal(z.readUInt32LE(z.length - 22), 0x06054b50);
  assert.equal(z.readUInt16LE(z.length - 22 + 10), 1);
});

test("selectedIds: ticked cards from the query string", () => {
  assert.deepEqual(selectedIds(["3", "5"]), [3, 5]);
  assert.deepEqual(selectedIds(["3,5", "5", " 7 "]), [3, 5, 7]);
  assert.deepEqual(selectedIds(["", "x", "-1", "2.5", "0"]), []);
  assert.deepEqual(selectedIds([]), []);
});
