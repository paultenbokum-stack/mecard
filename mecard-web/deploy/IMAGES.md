# Moving the uploads (wp-content/uploads → Cloud Storage)

The app serves every old `/wp-content/uploads/…` URL itself. Behind it are two private
buckets made by `1-setup-project.ps1`:

| Bucket | Holds | Filled by |
| --- | --- | --- |
| `<project>-uploads` (Archive class) | every original image, under its WordPress path (`2024/03/photo.jpg`) | this runbook |
| `<project>-media` (Standard) | the WebP version of each image the site shows | the app, the first time an image is asked for; `images:warm` does it ahead of visitors |

The laptop's own `wp-content/uploads` stops around August 2026 and lacks most customer
images (on 22 October: 4,413 of the 5,302 images the data uses were missing), so the
real copy comes from the live site at Xneelo.

## Once, beforehand

1. In konsoleH, check SFTP is on for the site's FTP user (Hosting > mecard.co.za > FTP
   Users). Put the user name in `deploy/config.ps1` (`$XneeloUser`), and the server name
   if konsoleH shows one other than mecard.co.za (`$XneeloHost`).
2. Full copy to the laptop (an hour or more the first time; the password is asked for,
   hidden, and never saved):

   ```
   .\deploy\pull-uploads.ps1
   ```

   It goes to `C:\mecard-cutover\uploads` and skips the folders that hold customer data
   rather than images (CSV and invite exports, invoices, quote PDFs, logs, private
   downloads).
3. Check it against the data (with the latest WordPress import in the local database):

   ```
   npm run images:plan -- --source C:\mecard-cutover\uploads
   ```

   The report (path shown) lists every image the data refers to that the copy lacks.
   A handful of missing ones are expected (images deleted long ago in WordPress); a lot
   means the copy is incomplete.

## Before cutover, once Google Cloud is set up (steps 1 to 4)

4. Lay out the upload (hard links: no extra disk space) and send it:

   ```
   npm run images:plan -- --source C:\mecard-cutover\uploads --stage C:\mecard-cutover\stage-1
   .\deploy\9-images.ps1 -Stage C:\mecard-cutover\stage-1 -DryRun
   .\deploy\9-images.ps1 -Stage C:\mecard-cutover\stage-1
   ```

   Only originals go up (WordPress's resized copies are left out; the app makes its own
   sizes). `9-images.ps1` uses `gcloud storage rsync`: re-running sends only what's new and
   never deletes from the bucket.
5. Warm the media bucket against the Cloud Run address (shown by `4-deploy.ps1`):

   ```
   npm run images:warm -- --url https://mecard-…run.app
   ```

## Cutover day (see CUTOVER.md for the order)

6. With WordPress in maintenance mode (nothing new can be uploaded), the delta:

   ```
   .\deploy\pull-uploads.ps1
   npm run images:plan -- --source C:\mecard-cutover\uploads --stage C:\mecard-cutover\stage-2
   .\deploy\9-images.ps1 -Stage C:\mecard-cutover\stage-2
   npm run images:warm -- --url https://mecard-…run.app
   ```

   Each stage folder must be new or empty; rsync skips what the bucket already has.
7. Right before the DNS switch, one last `pull-uploads.ps1` (it should copy nothing) and,
   if it found anything, steps 6's `images:plan` / `9-images.ps1` again with a `stage-3`.

## Rolling back

Nothing here changes the live site: the copy is read-only and the buckets are separate.
If the cutover is rolled back, WordPress still has every file.

## Locally

`npm run dev:all` seeds a local bucket (Cloud Storage emulator) with the images the data
uses from `../wp-content/uploads`, so the app reads originals and writes WebP versions the
way it will on Cloud Run. Delete `.gcs-seed/` to re-seed after a new import.
