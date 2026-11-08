import assert from "node:assert/strict";
import { test } from "node:test";
import { joinToken, parseTeamList, verifyJoinToken } from "./team-people-rules";

test("a pasted list gives one person per line", () => {
  const people = parseTeamList("Thandi Mokoena, Operations manager, thandi@riverside.example\nMegan Van der Merwe\tSales\n\n");
  assert.deepEqual(people, [
    { firstName: "Thandi", lastName: "Mokoena", jobTitle: "Operations manager", email: "thandi@riverside.example" },
    { firstName: "Megan", lastName: "Van der Merwe", jobTitle: "Sales", email: "" },
  ]);
});

test("a header row and a missing job title are handled", () => {
  assert.deepEqual(parseTeamList("Name,Job title,Email\nAisha Patel,aisha@riverside.example"), [{ firstName: "Aisha", lastName: "Patel", jobTitle: "", email: "aisha@riverside.example" }]);
});

test("a long list stops at the limit", () => {
  assert.equal(parseTeamList("A\nB\nC", 2).length, 2);
});

test("a join link works only for its own company", () => {
  const token = joinToken(12);
  assert.equal(verifyJoinToken(12, token), true);
  assert.equal(verifyJoinToken(13, token), false);
  assert.equal(verifyJoinToken(12, "short"), false);
});
