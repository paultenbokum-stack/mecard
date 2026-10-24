import { test } from "node:test";
import assert from "node:assert/strict";
import { cardProgress, cardsListHref, cardTab, manageBack, type CardTabInput } from "./card-tabs";

const card = (o: Partial<CardTabInput>): CardTabInput => ({
  archived: false,
  type: "contactcard",
  linked: true,
  inBasket: false,
  orderStatus: "completed",
  designSubmitted: false,
  shipped: false,
  ...o,
});

test("cardTab: archived cards and dead orders go to Archived", () => {
  assert.equal(cardTab(card({ archived: true })), "archived");
  assert.equal(cardTab(card({ orderStatus: "cancelled" })), "archived");
  assert.equal(cardTab(card({ orderStatus: "refunded", designSubmitted: true })), "archived");
});

test("cardTab: basket cards and cards still to be designed are Design pending", () => {
  assert.equal(cardTab(card({ orderStatus: null, inBasket: true, linked: false })), "design");
  assert.equal(cardTab(card({ orderStatus: null, inBasket: true, type: "phonetag" })), "design");
  assert.equal(cardTab(card({ orderStatus: "pending" })), "design");
  assert.equal(cardTab(card({ orderStatus: "processing" })), "design");
});

test("cardTab: ordered but not delivered is In progress", () => {
  assert.equal(cardTab(card({ orderStatus: "on-hold", type: "phonetag" })), "progress");
  assert.equal(cardTab(card({ orderStatus: "processing", designSubmitted: true })), "progress");
  assert.equal(cardTab(card({ orderStatus: "processing", type: "phonetag" })), "progress");
  assert.equal(cardTab(card({ orderStatus: "shipped", shipped: true })), "progress");
});

test("cardTab: completed and older cards are live, split by whether they open a profile", () => {
  // Imported cards: order completed but the design/shipped flags were never set.
  assert.equal(cardTab(card({ orderStatus: "completed" })), "live");
  assert.equal(cardTab(card({ orderStatus: "completed", linked: false })), "unassigned");
  assert.equal(cardTab(card({ orderStatus: null })), "live");
  assert.equal(cardTab(card({ orderStatus: null, linked: false, type: "phonetag" })), "unassigned");
});

test("cardProgress names the stage", () => {
  const base = { orderStatus: "processing", designSubmitted: true, designReceived: false, printed: false, encoded: false, packaged: false, shipped: false };
  assert.equal(cardProgress({ ...base, orderStatus: "on-hold" }), "Awaiting payment");
  assert.equal(cardProgress(base), "Artwork review");
  assert.equal(cardProgress({ ...base, designReceived: true, printed: true }), "Printed");
  assert.equal(cardProgress({ ...base, orderStatus: "shipped" }), "Shipped");
});

test("cardsListHref: back to the tab the card was opened from", () => {
  assert.equal(cardsListHref("design", "design"), "/manage/cards/?tab=design");
  assert.equal(cardsListHref("design", null), "/manage/cards/?tab=design");
  assert.equal(cardsListHref(null, "live"), "/manage/cards/?tab=live");
  assert.equal(cardsListHref(null, null), "/manage/cards/");
  assert.equal(cardsListHref("live", "live", { done: "card-saved" }), "/manage/cards/?tab=live&done=card-saved");
});

test("cardsListHref: a save that moved the card opens its new tab with a notice", () => {
  assert.equal(cardsListHref("design", "progress"), "/manage/cards/?tab=progress&moved=progress");
  assert.equal(cardsListHref("unassigned", "live", { done: "card-linked" }), "/manage/cards/?tab=live&moved=live&done=card-linked");
});

test("manageBack keeps /manage/ list URLs only", () => {
  assert.equal(manageBack("/manage/?show=archived&q=ann"), "/manage/?show=archived&q=ann");
  assert.equal(manageBack("/manage/company/7/?tab=team&done=x"), "/manage/company/7/?tab=team");
  assert.equal(manageBack("https://evil.example/manage/"), "/manage/");
  assert.equal(manageBack("//evil.example/"), "/manage/");
  assert.equal(manageBack("/manage//evil.example/"), "/manage/");
  assert.equal(manageBack(undefined), "/manage/");
});
