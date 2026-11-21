# Quick Start

Holocron Standalone can run locally or be hosted on Railway. The Railway
deployment serves the app and sync API together over one HTTPS origin.

## Start locally

Install Node.js 24 or newer, then run:

```powershell
npm install
npm run build
npm start
```

Open <http://127.0.0.1:41731/>.

The app and bundled catalog work offline. Changes are saved in the browser
profile; use **Options → Backup workspace** to keep an independent JSON
backup.

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
5. Review and deploy the staged changes. Open the public HTTPS domain when
   deployment is healthy.

If you use a custom domain, set `HOLOCRON_ALLOWED_HOSTS` to include both the
Railway domain and custom hostname, and `HOLOCRON_ALLOWED_ORIGINS` to include
both HTTPS origins, comma-separated. Set `HOLOCRON_TRUST_PROXY=true` so account
rate limits use the client address provided by Railway. Review and deploy
these variable changes as well.

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
4. On the first device, choose **Create collection**.
5. While signed in, choose **Generate pairing code**.
6. On each new device, enter the 8-digit code and choose **Connect with code**.
   Pairing codes expire after 10 minutes and can be used once; generate one for
   each device.
7. Choose **Sync workspace** to send this device's workspace.

Sync is manual; changes are not sent until you choose **Sync workspace**.
When the device and cloud copies differ, choose which copy to keep. Export a
workspace backup before resolving a conflict.

## Backups and updates

- Save independent backups from **Options → Backup workspace**. The Railway
  volume stores the sync database, but is not a substitute for backups.
- Configure manual or scheduled Railway volume backups in the service's
  **Backups** tab. See [Railway volume backups](https://docs.railway.com/volumes/backups).
- Pairing codes are short-lived and single-use. A signed-in device can generate
  another code whenever you need to connect a new device. Devices keep their
  own 30-day sign-in session and do not need the pairing code again to sync.
- Previously issued long private codes can be used once to reconnect; after
  that, generate one-time pairing codes for additional devices.
- Existing email/password accounts are not migrated to pairing-code sign-in.
  Their remote workspaces remain stored but cannot be accessed with the new
  sign-in method.
- Railway deploys code updates when changes reach its connected branch. The
  bundled rules remain snapshots; **Get latest card info** fetches current card
  data from SWU-DB and caches it on this device.
- Choose **Options → Refresh site** to check for and apply the latest web app
  build without clearing your sign-in or local collection.
