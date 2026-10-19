import { test } from "node:test";
import assert from "node:assert/strict";
import { verifyPassword } from "./password";

test("phpass portable hash (phpass reference vector)", async () => {
  assert.equal(await verifyPassword("test12345", "$P$9IQRaTwmfeRo7ud9Fh4E2PdI0S3r.L0"), true);
  assert.equal(await verifyPassword("test12346", "$P$9IQRaTwmfeRo7ud9Fh4E2PdI0S3r.L0"), false);
});

test("WordPress 6.8 $wp bcrypt hash", async () => {
  // php -r 'echo "\$wp".password_hash(base64_encode(hash_hmac("sha384","s3cret!","wp-sha384",true)),PASSWORD_BCRYPT);'
  const h = "$wp$2y$10$9feP8frlZt4F134e29jAv.9eo9vYFG/NxmPoRL6BKnMgw4HSGsb2i";
  assert.equal(await verifyPassword("s3cret!", h), true);
  assert.equal(await verifyPassword("wrong", h), false);
});
