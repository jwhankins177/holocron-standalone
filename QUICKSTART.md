# Quick Start

Holocron Standalone runs a static app and an optional sync API on the
same computer.

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

## Run the sync server

The sync server is optional. It stores one account workspace and serves the
card catalog. The app is still local-first and does not sync automatically.

In a second PowerShell window, create a data directory and start the API:

```powershell
New-Item -ItemType Directory -Force "C:\holocron-data"
$env:HOLOCRON_SYNC_DATABASE = "C:\holocron-data\holocron-sync.sqlite"
$env:HOLOCRON_SYNC_HOST = "127.0.0.1"
$env:HOLOCRON_SYNC_PORT = "41732"
npm run start:sync
```

Keep the static app running in its original PowerShell window.

## Connect a device

1. Open <http://127.0.0.1:41731/> from a browser on the server.
2. Choose **Options → Sync & card updates**.
3. Enter `http://127.0.0.1:41732` as the sync server URL.
4. Create an account.
5. Choose **Sync workspace**.

The app detects different device and server workspaces and asks you to choose
whether to keep the device copy or the cloud copy. Export a workspace backup
before resolving a conflict.

## Run privately on another device

For access from other devices, install Tailscale on the server and the client,
join both devices to the same Tailnet, and enable HTTPS certificates in the
Tailscale admin console.

Set an allowed host before starting the app:

```powershell
$tailnetHost = "homebase.example-tailnet.ts.net"
$env:HOLOCRON_ALLOWED_HOSTS = "127.0.0.1:41731,localhost:41731,$tailnetHost"
npm start
```

Set an allowed origin before starting the sync API:

```powershell
$tailnetHost = "homebase.example-tailnet.ts.net"
$env:HOLOCRON_ALLOWED_ORIGINS = "https://$tailnetHost"
$env:HOLOCRON_SYNC_DATABASE = "C:\holocron-data\holocron-sync.sqlite"
$env:HOLOCRON_SYNC_HOST = "127.0.0.1"
$env:HOLOCRON_SYNC_PORT = "41732"
npm run start:sync
```

Configure both services:

```powershell
tailscale serve --bg 41731
tailscale serve --bg --https=8443 41732
tailscale serve status
```

On each Tailnet device, open:

- App: `https://<homebase-magicdns-name>/`
- Sync API: `https://<homebase-magicdns-name>:8443`

Enter the HTTPS sync API URL, including port `8443`, in **Sync & card
updates**.

## Backups and maintenance

- Back up `C:\holocron-data\holocron-sync.sqlite` while the sync server is
  stopped.
- Back up the browser workspace with **Options → Backup workspace**.
- Keep the sync API bound to `127.0.0.1` unless a reverse proxy explicitly
  exposes it.
- To update the app, stop both Node processes, run `git pull --ff-only`,
  `npm install`, and `npm run build`, then restart both processes.
- To publish a newer bundled catalog, replace `public/catalog.json` and rebuild
  the app. The sync API rereads `public/catalog.json` for every catalog
  request unless `HOLOCRON_SYNC_CATALOG` points to another file.
