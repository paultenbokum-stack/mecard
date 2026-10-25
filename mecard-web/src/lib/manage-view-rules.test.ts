import { test } from "node:test";
import assert from "node:assert/strict";
import { canGoIndividual, manageView, shouldMarkTeams } from "./manage-view-rules";

test("manageView: one profile of your own is the single view", () => {
  assert.equal(manageView({ ownProfiles: 1, ownsCompany: false }), "single");
  assert.equal(manageView({ mode: "individual", ownProfiles: 1, ownsCompany: false }), "single");
});

test("manageView: none, several, or a company of your own is the team view", () => {
  assert.equal(manageView({ ownProfiles: 0, ownsCompany: false }), "team");
  assert.equal(manageView({ ownProfiles: 2, ownsCompany: false }), "team");
  assert.equal(manageView({ ownProfiles: 1, ownsCompany: true }), "team");
  assert.equal(manageView({ ownProfiles: 0, ownsCompany: true }), "team");
});

test("manageView: a company that is only your own profile's branding keeps the single view", () => {
  assert.equal(manageView({ ownProfiles: 1, ownsCompany: true, companyIsOwnBranding: true }), "single");
  assert.equal(manageView({ ownProfiles: 2, ownsCompany: true, companyIsOwnBranding: true }), "team");
  assert.equal(manageView({ ownProfiles: 1, ownsCompany: true, companyIsOwnBranding: false }), "team");
});

test("manageView: teams mode is the team view, even with one profile or none", () => {
  assert.equal(manageView({ mode: "teams", ownProfiles: 0, ownsCompany: false }), "team");
  assert.equal(manageView({ mode: "teams", ownProfiles: 1, ownsCompany: false }), "team");
  assert.equal(manageView({ mode: "teams", ownProfiles: 1, ownsCompany: true, companyIsOwnBranding: true }), "team");
});

test("manageView: individual mode can't hide a team", () => {
  assert.equal(manageView({ mode: "individual", ownProfiles: 2, ownsCompany: false }), "team");
  assert.equal(manageView({ mode: "individual", ownProfiles: 1, ownsCompany: true, companyIsOwnBranding: false }), "team");
  assert.equal(manageView({ mode: "individual", ownProfiles: 1, ownsCompany: true, companyIsOwnBranding: true }), "single");
});

test("shouldMarkTeams: having a team sets teams mode, once", () => {
  assert.equal(shouldMarkTeams({ ownProfiles: 2, ownsCompany: false }), true);
  assert.equal(shouldMarkTeams({ mode: "individual", ownProfiles: 1, ownsCompany: true, companyIsOwnBranding: false }), true);
  assert.equal(shouldMarkTeams({ mode: "teams", ownProfiles: 2, ownsCompany: false }), false);
  assert.equal(shouldMarkTeams({ ownProfiles: 1, ownsCompany: false }), false);
  assert.equal(shouldMarkTeams({ ownProfiles: 1, ownsCompany: true, companyIsOwnBranding: true }), false);
  assert.equal(shouldMarkTeams({ ownProfiles: 0, ownsCompany: false }), false);
});

test("canGoIndividual: only teams mode with one profile and no company used by others", () => {
  assert.equal(canGoIndividual({ mode: "teams", ownProfiles: 1, ownsCompany: false }), true);
  assert.equal(canGoIndividual({ mode: "teams", ownProfiles: 1, ownsCompany: true, companyIsOwnBranding: true }), true);
  assert.equal(canGoIndividual({ mode: "teams", ownProfiles: 1, ownsCompany: true, companyIsOwnBranding: false }), false);
  assert.equal(canGoIndividual({ mode: "teams", ownProfiles: 2, ownsCompany: false }), false);
  assert.equal(canGoIndividual({ mode: "teams", ownProfiles: 0, ownsCompany: false }), false);
  assert.equal(canGoIndividual({ ownProfiles: 1, ownsCompany: false }), false);
});
