import assert from "node:assert/strict";
import { test } from "node:test";
import { parseTeamList } from "./team-people-rules";

test("a pasted list gives one person per line", () => {
  const people = parseTeamList("Thandi Mokoena, Operations manager, thandi@riverside.example, 082 000 0000\nMegan Van der Merwe\tSales\n\n");
  assert.deepEqual(people, [
    { firstName: "Thandi", lastName: "Mokoena", jobTitle: "Operations manager", email: "thandi@riverside.example", mobile: "082 000 0000" },
    { firstName: "Megan", lastName: "Van der Merwe", jobTitle: "Sales", email: "", mobile: "" },
  ]);
});

test("a header row and a missing job title are handled", () => {
  assert.deepEqual(parseTeamList("Name,Job title,Email\nAisha Patel,aisha@riverside.example"), [{ firstName: "Aisha", lastName: "Patel", jobTitle: "", email: "aisha@riverside.example", mobile: "" }]);
});

test("columns can come in any order after the name", () => {
  const [p] = parseTeamList("Johan Botha\t+27 82 000 0000\tjohan@riverside.example\tSales manager");
  assert.equal(p.mobile, "+27 82 000 0000");
  assert.equal(p.email, "johan@riverside.example");
  assert.equal(p.jobTitle, "Sales manager");
});

test("a long list stops at the limit", () => {
  assert.equal(parseTeamList("A\nB\nC", 2).length, 2);
});
