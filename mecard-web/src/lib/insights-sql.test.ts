import assert from "node:assert/strict";
import { test } from "node:test";
import { checkQuery, limited, MAX_ROWS } from "./insights-sql";

const ok = (sql: string) => {
  const r = checkQuery(sql);
  assert.equal(r.ok, true, `expected ok: ${sql} (${!r.ok ? r.error : ""})`);
};
const refused = (sql: unknown) => assert.equal(checkQuery(sql).ok, false, `expected refused: ${String(sql)}`);

test("plain SELECTs and CTEs on the views pass", () => {
  ok("select * from insights.signups");
  ok("SELECT intent, count(*) FROM signups GROUP BY 1;");
  ok("with w as (select user_id from insights.user_journeys where event = 'page_viewed') select count(*) from w");
  ok("select updated_count, created_day from insights.engagement_daily"); // words inside names are fine
  ok("select 'drop table users; --' as s from insights.orders"); // inside a string
  ok("(select 1)");
});

test("anything that isn't one read-only SELECT is refused", () => {
  refused("");
  refused(null);
  refused("delete from insights.signups");
  refused("select 1; select 2");
  refused("select 1; drop table users");
  refused("update users set is_admin = true");
  refused("with x as (delete from events returning *) select * from x");
  refused("select * into temp t from insights.signups");
  refused("explain analyze select 1");
  refused("set statement_timeout = 0");
  refused("select set_config('statement_timeout', '0', true)");
  refused("select pg_sleep(30)");
  refused("select current_setting('role')");
});

test("only the insights schema", () => {
  refused("select * from public.users");
  refused("select * from pg_catalog.pg_roles");
  refused("select * from information_schema.tables");
});

test("comments can't hide a second statement", () => {
  refused("select 1 /* ; */ ; drop table users");
  ok("select 1 -- a note; with a semicolon\n");
});

test("the limit wraps the query", () => {
  assert.match(limited("select 1"), new RegExp(`limit ${MAX_ROWS + 1}$`));
});
