# Cutover: mecard.co.za from WordPress (Xneelo) to Cloud Run

DNS for mecard.co.za is at Xneelo (nameservers ns1/ns2.host-h.net and ns1/ns2.dns-h.com),
edited in konsoleH: Hosting > mecard.co.za > DNS (Manage DNS / Edit zone).

## The records as they are now (looked up 22 October 2026: write these down for rollback)

| Name | Type | Value | Changes at cutover |
| --- | --- | --- | --- |
| `mecard.co.za` | A | `156.38.203.33` | **yes**: to the load balancer IP |
| `www.mecard.co.za` | A | `156.38.203.33` | **yes**: to the load balancer IP |
| `mail.mecard.co.za` | A | `156.38.203.33` | no: mail stays with Xneelo |
| `mecard.co.za` | MX | `10 mail.mecard.co.za` | no |
| `mecard.co.za` | TXT | `v=spf1 mx a include:spf.host-h.net ?all` | no (mail still passes: `mx` and the Xneelo include cover the mail server) |

Zone default TTL: 86400 seconds (1 day). Check in konsoleH that nothing else (AAAA, other
CNAMEs) exists for `mecard.co.za` or `www`; if it does, note it too.

## Mail

For now every email goes to and from Taggable addresses (`src/lib/mail-settings.ts`,
the one place to change them), sent through Resend. So **taggable.co.za** must be added and
verified in Resend (resend.com > Domains: the DKIM/SPF records it shows go in the DNS of
taggable.co.za, wherever that is hosted). `keys.ps1` warns until it is verified. Nothing
about mecard.co.za's own mail changes.

## A week or more before

1. Google Cloud set up and the app deployed on its Cloud Run address (deploy/README.md
   steps 1 to 4 and 8), keys with `.\deploy\keys.ps1 -Cloud`.
2. Images copied and warmed (IMAGES.md steps 1 to 5).
3. `.\deploy\6-domain.ps1`: makes the load balancer and prints its IP. Then
   `.\deploy\6b-dns-cert.ps1`: prints two CNAME records (`_acme-challenge…`). Add those in
   konsoleH now; they don't affect the live site, and they let the https certificate be
   issued before the switch. Run `6b-dns-cert.ps1` again until it says ACTIVE.
4. Test on the Cloud Run address: log in as staff and a customer, a card page, a quote, a
   sandbox order.

## Two days before

5. In konsoleH, lower the TTL of the `mecard.co.za` and `www` A records (or the zone
   default) to **300** seconds. The old 1-day TTL has to run out first, which is why this
   is done at least a day ahead.

## Cutover (about an hour; quiet time, e.g. a weekday evening)

6. WordPress into maintenance mode (no new orders, sign-ups or uploads).
7. Fresh WordPress database export into the local MySQL, then
   `.\deploy\5-migrate-import.ps1` (type IMPORT): migrations, the import, archiving the
   abandoned basket cards. Check the counts it prints.
8. Images delta: IMAGES.md step 6, then the last check in step 7.
8b. If the test deploy (TEST-DEPLOY.md) is still in place: `.\deploy\keys.ps1 -Cloud` for the
    live PayFast and Bob Go keys, then `.\deploy-deploy.ps1` **without** `-Test`. That drops the
    email redirect, sandboxes and noindex and builds for https://mecard.co.za.
9. In konsoleH change the two A records (`mecard.co.za`, `www.mecard.co.za`) to the load
   balancer IP from step 3. Leave `mail.mecard.co.za`, MX and TXT alone.
10. Check from outside: `nslookup mecard.co.za 8.8.8.8` shows the new IP; https works (the
    certificate from step 3); log in; a card page `/t/…`; an image; the contact form.
11. `.\deploy\8-scheduler.ps1` if not done yet (hourly reminders and Bob Go tracking), and
    point PayFast's notify URL at the new site if it is set in the PayFast dashboard
    (orders send their own `notify_url`, so usually nothing to do).
12. A day later, raise the TTL back to 86400.

## Rolling back

Within the first hours, if something is badly wrong:

1. In konsoleH set both A records back to `156.38.203.33` (with the TTL at 300 this takes
   effect within minutes).
2. Take WordPress out of maintenance mode.
3. Orders placed on the new site in between are in Cloud SQL: list them in `/admin/orders/`
   (still reachable on the Cloud Run address) and enter them in WooCommerce by hand.

Nothing in the cutover changes WordPress's own database or files, so it is exactly as it
was when maintenance mode went on.
