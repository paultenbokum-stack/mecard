// Sets a local-only password on imported accounts so you can sign in as a real
// customer on your laptop. Refuses to run against anything but a local database.
//
//   npm run dev:password -- jacques@nxtlevelcoach.co.za tvanzyl@entersekt.com
//
// Default password: mecard-local-test (or pass --password=…). Re-importing
// (npm run import:wp) puts the real WordPress hashes back.

import { config } from "dotenv";
import postgres from "postgres";
import bcrypt from "bcryptjs";

config({ path: ".env.local" });

const url = process.env.DATABASE_URL ?? "";
const host = (() => {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
})();
if (!["127.0.0.1", "localhost", "::1"].includes(host)) {
  console.error(`Refusing to change passwords: DATABASE_URL points at "${host || "nothing"}", not a local database.`);
  process.exit(1);
}

const args = process.argv.slice(2);
const password = args.find((a) => a.startsWith("--password="))?.slice(11) || "mecard-local-test";
const logins = args.filter((a) => !a.startsWith("--"));
if (!logins.length) {
  console.error("Usage: npm run dev:password -- <email or username> […]");
  process.exit(1);
}

async function main() {
  const sql = postgres(url, { max: 1 });
  const hash = await bcrypt.hash(password, 10);
  for (const login of logins) {
    const rows = await sql`UPDATE users SET password_hash = ${hash} WHERE lower(email) = ${login.toLowerCase()} OR lower(username) = ${login.toLowerCase()} RETURNING id, email`;
    console.log(rows.length ? `✓ ${rows[0].email} (user ${rows[0].id})` : `✗ no user ${login}`);
  }
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
