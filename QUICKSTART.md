# Quick Start

Holocron Standalone can run locally or be hosted on Railway. The Railway
deployment serves the app and sync API together over one HTTPS origin.

## Start locally

Install Node.js 24 or newer, then run:

```powershell
npm ci
npm run build
npm start
```

Open <http://127.0.0.1:41731/>.

The app and bundled catalog work offline. Changes are saved in the browser
profile; use **Options → Backup workspace** to keep an independent JSON
backup.

## Optional card values (personal proof of concept)

Create a free account at https://tcgapi.dev/ and configure `TCG_API_KEY` in the
environment of the Holocron server before starting it. Do not put the key in
the repository, a browser setting, or a backup. For Railway, add it as a
service variable and redeploy. Hosted users must sign in to use card values.
Turn on **Options → Show card values**, then choose **Check owned card values**
in My collection; individual cards also have a **Check value** button.

Values are USD estimates, not appraisals. The provider may mislabel finishes,
so its labels are shown as reported and missing or mismatched finishes are
excluded from the collection total. The free account is limited to 100 API
requests per day and may need multiple days to cover a collection. The app
caches checked prices on this device for offline use and does not refresh them
more than once per 24 hours. Some sets or printings cannot be matched and are
shown as unavailable.

This integration is intended for personal, noncommercial use. Before broader
or commercial use, review the provider's current license, marketplace rights,
pricing, and redistribution restrictions. The provider's license requires
removing cached provider records after its license ends; use **Clear saved
values** in My collection on every device and restart the server to clear its
in-memory cache when required.

## Deploy on Railway

1. In Railway, create a project from this GitHub repository and connect the
   service to the `main` branch. Railway builds and deploys new commits pushed
   to the connected branch. See Railway's guide to
   [services from GitHub](https://docs.railway.com/services#deploying-from-a-github-repo).
2. In the service settings, set **Build Command** to `npm run build`,
   **Start Command** to `npm run start:cloud`, and **Healthcheck Path** to
   `/healthz`. Railway provides the `PORT` environment variable; the app
   listens on it. See [build and start commands](https://docs.railway.com/builds/build-and-start-commands)
   and [healthchecks](https://docs.railway.com/deployments/healthchecks).
3. Generate a public domain under **Settings → Networking → Public Networking**.
   Railway provisions HTTPS automatically. See [public networking](https://docs.railway.com/networking/public-networking).
4. Add a volume to the service, mount it at `/data`, and set the service
   variable `HOLOCRON_SYNC_DATABASE=/data/holocron-sync.sqlite`. The volume
   persists account workspaces across deployments. See [volumes](https://docs.railway.com/volumes).
5. Set `HOLOCRON_REGISTRATION_CODE` to a long, random invite code and share it
   privately with the people you want to allow to create accounts. New
   registrations are disabled if this variable is empty. Existing accounts can
   still sign in.
6. Review and deploy the staged changes. Open the public HTTPS domain when
   deployment is healthy.

If you use a custom domain, set `HOLOCRON_ALLOWED_HOSTS` to include both the
Railway domain and custom hostname, and `HOLOCRON_ALLOWED_ORIGINS` to include
both HTTPS origins, comma-separated. Set `HOLOCRON_TRUST_PROXY=true` only if
the proxy is configured to overwrite untrusted `X-Forwarded-For` values;
otherwise leave it unset. Review and deploy these variable changes as well.
The authentication rate limits are process-local; keep one app replica unless
you add a shared rate-limit store or an edge-level limit.

Each person should create a separate account and collection. Use the same
credentials only across that person's own devices. A shared login gives every
device full access to that account's collection.

**Important:** This repository contains a legacy `railway.json`. Railway's
current documentation says Config as Code is deprecated, existing services
stop reading these files on **December 1, 2026**, and the file overrides
dashboard settings until migration cutover. Railway may also discover a config
file at the repository root. Do not delete the file or assume dashboard changes
take effect while the service still uses it. Follow Railway's [migration
instructions](https://docs.railway.com/infrastructure-as-code#migrating-from-config-as-code)
with the Railway CLI, migrate and cut over, then remove `railway.json` as
directed. New services should use Railway's current Infrastructure as Code or
service settings rather than Config as Code.

## Connect a device

1. Open the Railway HTTPS URL on the device.
2. Choose **Options → Sync & card updates**.
3. Enter the same HTTPS URL as the sync server URL.
4. On the first device, choose **Create a new account**, then set a username
   and password.
5. On each other device, enter the same username and password and choose
   **Sign in**.
6. Choose **Sync workspace** to send this device's workspace.

If a device is already signed in to your collection, set its username and
password in **Sync & card updates** first. This keeps the existing collection
and lets every other device sign in to it. The app remembers each device's
sign-in for 30 days; if its browser data is cleared or the sign-in expires,
sign in again with your username and password. Passwords are not stored in the
app. Save yours in a password manager; there is no email-based password reset.

Sync is manual by default. In **Sync & card updates**, opt into automatic sync
on this device to check on startup and after local changes. If sync fails,
use **Sync workspace** to retry. When the device and cloud copies differ,
choose which copy to keep; automatic sync never chooses for you. Export a
workspace backup before resolving a conflict.

## Backups and updates

- Save independent backups from **Options → Backup workspace**. The Railway
  volume stores the sync database, but is not a substitute for backups.
- **Sync & card updates** also offers a backup export and shows the time since
  the last export on this browser. The browser download flow may not confirm
  where the file was saved; check your chosen location.
- Configure manual or scheduled Railway volume backups in the service's
  **Backups** tab. See [Railway volume backups](https://docs.railway.com/volumes/backups).
- Keep using the same app URL and browser profile. Clearing browser site data
  removes the local workspace and device sign-in; use **Options → Refresh site**
  to apply app updates without clearing them.
- The sync database and browser workspace are not encrypted by the app. Protect
  each device with its OS screen lock and disk encryption, restrict access to
  the Railway project, volume, and backups, and verify the host's at-rest
  encryption and backup access settings.
- Existing signed-in collections can add a username and password without
  replacing their cloud workspace.
- Previously issued pairing codes and private codes remain accepted by the
  sync API for older app versions.
- Legacy email/password accounts from versions before pairing-code sign-in are
  not migrated to this login; their stored cloud workspaces remain on the
  server but are not accessible through the current app.
- **Play on ForceTable** sends the selected deck in an external link; the app
  asks for confirmation before opening it. When you return, enter the result
  and notes to add it to match history. ForceTable does not send results back
  automatically; a pending result is retained in the current browser tab.
- Railway deploys code updates when changes reach its connected branch. The
  bundled rules remain snapshots; **Get latest card info** fetches current card
  data from SWU-DB and caches it on this device. The sync dialog shows the
  catalog date and flags saved decks containing changed card information for
  the current session; format rules still need separate verification.
- Choose **Options → Refresh site** to check for and apply the latest web app
  build without clearing your sign-in or local collection.
