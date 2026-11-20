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

1. Create a Railway project from this GitHub repository and deploy the
   `main` branch. The checked-in `railway.json` builds the app, starts the
   combined app and sync server, and configures the `/healthz` health check.
2. In the service's **Settings → Networking**, generate a public domain.
   Railway configures the allowed host and HTTPS origin from that domain.
3. Add a Railway volume mounted at `/data`, then set the service variable
   `HOLOCRON_SYNC_DATABASE=/data/holocron-sync.sqlite`. This keeps account
   workspaces across deploys and restarts.
4. Deploy the service and open its public HTTPS URL.

If you use a custom domain, set `HOLOCRON_ALLOWED_HOSTS` to include both the
Railway domain and custom hostname, and `HOLOCRON_ALLOWED_ORIGINS` to include
both HTTPS origins, comma-separated. Set `HOLOCRON_TRUST_PROXY=true` so account
rate limits use the client address provided by Railway.

## Connect a device

1. Open the Railway HTTPS URL on the device.
2. Choose **Options → Sync & card updates**.
3. Enter the same HTTPS URL as the sync server URL.
4. Create an account on the first device, or sign in to an existing account.
5. Choose **Sync workspace** to send this device's workspace.

Sync is manual; changes are not sent until you choose **Sync workspace**.
When the device and cloud copies differ, choose which copy to keep. Export a
workspace backup before resolving a conflict.

## Backups and updates

- Save independent backups from **Options → Backup workspace**. The Railway
  volume stores the sync database, but is not a substitute for backups.
- Registration is available to anyone who can reach the public site. Use a
  strong, unique password; there is no email verification or password recovery.
- Railway deploys code updates when changes reach its connected branch. The
  bundled rules and catalog remain snapshots; update the catalog source and
  redeploy to publish changed card information.
