import assert from "node:assert/strict";
import { test } from "node:test";
import { salesMayOpen } from "./admin-paths";

test("a salesperson opens quotes and commissions only", () => {
  for (const p of ["/admin/quotes/", "/admin/quotes/12/", "/admin/commissions/"]) assert.equal(salesMayOpen(p), true, p);
  for (const p of ["/admin/", "/admin/orders/", "/admin/users/5/", "/admin/quotes-old/", "/admin/encoding/x/", "/admin/commissionsx/"]) assert.equal(salesMayOpen(p), false, p);
});
