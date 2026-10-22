# Deploy settings: the one place to change them. Dot-sourced by _common.ps1.

# The Google Cloud project MeCard runs in (the empty "Mecard" project) and the billing account
# 1-setup-project.ps1 links it to (Taggable). The scripts use these, never gcloud's own default
# project, so a NexTag or other project can't be deployed to by mistake. -Project overrides.
$DefaultProject = 'mecard-1728033727914'
$BillingAccount = '01A155-4693EF-CBE86E'   # "Taggable"

$SiteUrl = 'https://mecard.co.za'
$SiteDomains = @('mecard.co.za', 'www.mecard.co.za')

# Mail addresses are not here: the app keeps them in src/lib/mail-settings.ts (Taggable for now).

# The live WordPress site at Xneelo, for copying wp-content/uploads (pull-uploads.ps1).
# konsoleH > [mecard.co.za] > FTP Users shows the user; SFTP must be on for it.
$XneeloHost = 'mecard.co.za'                       # or the server name konsoleH shows, e.g. dedi1234.jnb1.host-h.net
$XneeloUser = ''                                   # asked for when blank
$XneeloUploadsPath = 'public_html/wp-content/uploads'
# Where the copy goes on this laptop (outside the repo; it holds every customer image).
$UploadsCopy = 'C:\mecard-cutover\uploads'
