import { test } from "node:test";
import assert from "node:assert/strict";
import { manageView } from "./manage-view-rules";

test("manageView: one profile of your own is the single view", () => {
  assert.equal(manageView({ ownProfiles: 1, ownsCompany: false }), "single");
});

test("manageView: none, several, or a company of your own is the team view", () => {
  assert.equal(manageView({ ownProfiles: 0, ownsCompany: false }), "team");
  assert.equal(manageView({ ownProfiles: 2, ownsCompany: false }), "team");
  assert.equal(manageView({ ownProfiles: 1, ownsCompany: true }), "team");
  assert.equal(manageView({ ownProfiles: 0, ownsCompany: true }), "team");
});
