import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { phpUrlencode, signature } from "./payfast";

const samples = ["Tag Pack x 10", "Ann-Marie O'Neil", "a~b!c*(d)e", "R25.00 & more", "café/ü?=", "  padded  "];

test("phpUrlencode matches PHP urlencode()", (t) => {
  let php: string;
  try {
    php = execFileSync("php", ["-r", 'foreach (json_decode($argv[1]) as $s) echo urlencode($s), "\\n";', JSON.stringify(samples)]).toString();
  } catch {
    t.skip("php not installed");
    return;
  }
  assert.deepEqual(samples.map(phpUrlencode), php.trimEnd().split("\n"));
});

test("signature matches PayFast's PHP reference implementation", (t) => {
  const fields: [string, string][] = [
    ["merchant_id", "10000100"],
    ["merchant_key", "46f0cd694581a"],
    ["return_url", "https://nextag.co/checkout/order-received/1234/"],
    ["name_first", "Ann-Marie"],
    ["email_address", "a@b.co"],
    ["m_payment_id", "1234"],
    ["amount", "250.00"],
    ["item_name", "MeCard 25x40 x 10"],
    ["item_description", ""],
  ];
  const ref = `
    $data = json_decode($argv[1], true); $pass = $argv[2]; $out = '';
    foreach ($data as $p) { if ($p[1] !== '') $out .= $p[0].'='.urlencode(trim($p[1])).'&'; }
    $s = substr($out, 0, -1); if ($pass !== '') $s .= '&passphrase='.urlencode(trim($pass));
    echo md5($s);`;
  let php: string;
  try {
    php = execFileSync("php", ["-r", ref, JSON.stringify(fields), "jt7NOE43FZPn"]).toString();
  } catch {
    t.skip("php not installed");
    return;
  }
  assert.equal(signature(fields, "jt7NOE43FZPn"), php);
});
