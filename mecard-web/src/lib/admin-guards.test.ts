import { test } from "node:test";
import assert from "node:assert/strict";
import { cardArchiveGuard, companyDeleteGuard, profileArchiveGuard, userDeleteGuard } from "./admin-guards";

const empty = { orders: 0, profiles: 0, companies: 0, cards: 0, isSelf: false };

test("a user with nothing linked can be deleted; orders, live items or yourself block it", () => {
  assert.deepEqual(userDeleteGuard(empty), { ok: true, blockers: [] });
  const g = userDeleteGuard({ ...empty, orders: 2, profiles: 1, cards: 3 });
  assert.equal(g.ok, false);
  assert.equal(g.blockers.length, 3);
  assert.match(g.blockers[0], /2 orders/);
  assert.match(g.blockers[1], /1 live profile owned/);
  assert.match(g.blockers[2], /3 live tags/);
  assert.equal(userDeleteGuard({ ...empty, isSelf: true }).ok, false);
  assert.match(userDeleteGuard({ ...empty, companies: 1 }).blockers[0], /1 company owned/);
});

test("only an empty company can be deleted", () => {
  assert.equal(companyDeleteGuard({ profiles: 0, cards: 0 }).ok, true);
  assert.equal(companyDeleteGuard({ profiles: 4, cards: 0 }).ok, false);
  assert.match(companyDeleteGuard({ profiles: 0, cards: 2 }).blockers[0], /2 live tags/);
});

test("a profile with live tags pointing at it can't be archived", () => {
  assert.equal(profileArchiveGuard({ cards: 0 }).ok, true);
  assert.match(profileArchiveGuard({ cards: 1 }).blockers[0], /1 live tag point/);
});

test("a tag on a live order or assigned to a profile can't be archived", () => {
  assert.equal(cardArchiveGuard({ orderStatus: null, profileId: null }).ok, true);
  assert.equal(cardArchiveGuard({ orderStatus: "cancelled", profileId: null }).ok, true);
  assert.equal(cardArchiveGuard({ orderStatus: "processing", profileId: null }).ok, false);
  assert.equal(cardArchiveGuard({ orderStatus: null, profileId: 5 }).ok, false);
  assert.equal(cardArchiveGuard({ orderStatus: "completed", profileId: 5 }).blockers.length, 2);
});
