import { test } from "node:test";
import assert from "node:assert/strict";
import { cardProgress, cardStage, type CardFlags } from "./admin-cards";

const none: CardFlags = { designSubmitted: false, designReceived: false, printJobSetUp: false, printed: false, encoded: false, packaged: false, shipped: false };

test("custom cards go design → check → print → encode → pack → ship", () => {
  const c = { ...none, type: "contactcard" };
  assert.equal(cardStage(c), "design");
  assert.equal(cardStage({ ...c, designSubmitted: true }), "check");
  assert.equal(cardStage({ ...c, designSubmitted: true, designReceived: true }), "print");
  assert.equal(cardStage({ ...c, designSubmitted: true, designReceived: true, printed: true }), "encode");
  assert.equal(cardStage({ ...c, designSubmitted: true, designReceived: true, printed: true, encoded: true }), "pack");
  assert.equal(cardStage({ ...c, packaged: true }, "processing"), "ship");
  assert.equal(cardStage({ ...c, packaged: true }, "completed"), "done");
  assert.equal(cardStage({ ...c, packaged: true }), "done", "cards from before orders: packaged was the last step");
  assert.equal(cardStage({ ...c, packaged: true, shipped: true }, "processing"), "done");
});

test("phone tags skip design and printing; key rings only need packing", () => {
  assert.equal(cardStage({ ...none, type: "phonetag" }), "encode");
  assert.equal(cardStage({ ...none, type: "phonetag", encoded: true }), "pack");
  assert.equal(cardStage({ ...none, type: "keyring" }), "pack");
});

test("progress names the furthest step reached", () => {
  assert.equal(cardProgress(none), "Awaiting design");
  assert.equal(cardProgress({ ...none, designSubmitted: true, printed: true }), "Printed");
});
