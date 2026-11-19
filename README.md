# Holocron Standalone

An offline Star Wars: Unlimited collection manager, deck builder, and play companion based on Holocron v2.9.5 (upstream commit `d760e67686edd659a667f1f87c810332d914155d`).

## Start the prebuilt app

- **Windows x64** - Extract the entire archive and double-click `Start-Holocron.cmd`. Keep the launcher window open while using Holocron. The archive includes Node.js and opens your browser at `http://127.0.0.1:41731/`.
- **Steam Deck or Linux** - For local-only use, in Desktop Mode open a terminal in the extracted folder and run `sh start-holocron.sh`. To use the home server and sync, follow **Connect a Steam Deck** below instead.
- **macOS** - Run `sh start-holocron.sh` with Node.js or Python 3 available.

The catalog, all bundled card artwork, starter decks, collection tools, deck tools, guides, tracker, and Battle Lab work without internet access. ForceTable and external reference links open their respective websites when selected. The bundled catalog and Premier rules are a snapshot. Optional account-based workspace sync and hosted catalog refresh are available when you connect a sync server.

## iPhone and iPad

For home-server sync, install [Tailscale from the App Store](https://apps.apple.com/app/tailscale/id1470499037), sign in to the same Tailnet as your home server, and connect. In Safari, open `https://<homebase-magicdns-name>/`, then use **Share → Add to Home Screen**. Open the Home Screen app, choose **Options → Save for offline use**, and leave it open until it says **Ready for offline use**. In **Options → Sync & card updates**, set the API URL to `https://<homebase-magicdns-name>:8443` and sign in to your Holocron account.

The first install and sync need a connection to the home server. Afterward, the app's shell and card artwork can be used offline; local edits remain on that device until you reconnect to Tailscale and manually sync. This release has no signed native iOS installer.

## Bring over your workspace

1. In hosted Holocron, choose **Options → Backup workspace**.
2. Open Standalone and choose **My collection → Options → Import collection → Full backup**. Select the JSON file, preview it, and confirm the restore.

Without sync, your collection, decks, lists, favorites, preferences, and supported play records are stored only in this browser profile. With sync configured, a copy is also stored on your sync server. Clearing browser site data removes the local copy. Use **Backup workspace** to keep an independent recovery copy.

## Set up cross-device sync

Holocron can use a self-hosted Node.js sync API. The API stores an account, one revisioned workspace per account, and serves the card catalog. The app still saves locally and works offline; syncing is manual. For personal use, Tailscale Serve can expose both the app and API over private HTTPS to your Tailnet without a public hosting service, domain, or router port forwarding. Devices need to be signed in to your Tailnet.

### Run the app privately on a Tailscale home server (recommended for personal use)

On the always-on computer, install Node.js 24 or newer and clone this repository. In PowerShell, build the app:

```powershell
npm install
npm run build
```

Enable HTTPS certificates for your Tailnet in the Tailscale admin console if they are not already enabled. Find the computer's MagicDNS name (for example, `homebase.example-tailnet.ts.net`) in `tailscale status`, then substitute your actual name for `$tailnetHost` below.

Open two PowerShell windows in the repository. In the first, start the app and allow its Tailnet hostname in the existing Host-header check:

```powershell
$tailnetHost = "homebase.example-tailnet.ts.net"
$env:HOLOCRON_ALLOWED_HOSTS = "127.0.0.1:41731,localhost:41731,$tailnetHost"
npm start
```

In the second, start the sync API. Keep its database in a durable location:

```powershell
$tailnetHost = "homebase.example-tailnet.ts.net"
New-Item -ItemType Directory -Force "C:\holocron-data"
$env:HOLOCRON_ALLOWED_ORIGINS = "https://$tailnetHost"
$env:HOLOCRON_SYNC_DATABASE = "C:\holocron-data\holocron-sync.sqlite"
$env:HOLOCRON_SYNC_HOST = "127.0.0.1"
$env:HOLOCRON_SYNC_PORT = "41732"
npm run start:sync
```

The API reads `public/catalog.json` by default. To serve a separately maintained catalog, set `HOLOCRON_SYNC_CATALOG` to its absolute path. The API rereads that file for each request, so replacing it publishes updated card details without restarting the server. Keep the SQLite database and any separately maintained catalog outside the public static site.

In PowerShell, configure Tailscale Serve to provide HTTPS for both local services:

```powershell
tailscale serve --bg 41731
tailscale serve --bg --https=8443 41732
tailscale serve status
```

Check `tailscale serve status` before configuring these routes so you don't replace an existing home-server service on the same HTTPS port. The first command serves the app at `https://<homebase-magicdns-name>/`; the second privately serves the API at `https://<homebase-magicdns-name>:8443/`. Tailscale Serve may prompt you to enable HTTPS for the Tailnet. These services are available to Tailnet devices only. Do not run `tailscale funnel`, add router port forwards, or bind the Node services to a public interface. Serve's background configuration survives Tailscale restarts; start both Node commands again after the home computer reboots (or configure them to start at login).

On each device, open the app URL and choose **Options → Sync & card updates**. Enter the API URL including `:8443`, then create an account on the first device. On another device, sign in with that account and choose **Use cloud copy on this device** when prompted. The first device's initial sync uploads its local workspace; always review the conflict choice and export a backup if unsure. Tailscale limits network access to your Tailnet, while the app account protects the workspace.

For private Tailnet hosting, omit `HOLOCRON_TRUST_PROXY`; rate limiting uses the server's local connection address. Keep the API bound to loopback and make regular backups of the SQLite database, for example by stopping the API and copying the database file to a separate protected drive.

### Share access or run a separate copy

To let another person use your hosted app, use Tailscale's [device sharing](https://tailscale.com/docs/features/sharing) for the home server. They install Tailscale, accept your invitation, and open the same app URL. Sharing grants access to that machine, subject to your Tailnet access rules; review those rules and the other services reachable on the machine before sharing it.

Each Holocron account has its own workspace. The other person can create an account for a separate collection. To see the same workspace on both people's devices, they would have to sign in to the same Holocron account; this is manual sync, not live collaboration, and conflicting edits require choosing which copy to keep. Holocron does not currently have shared workspaces or per-user collaboration.

If they want their own private instance, they can clone this repository, build it, and follow the home-server instructions with their own Tailscale server and SQLite database. They will then get updates when they pull and deploy new commits themselves.

### Deploy code updates to your home server

Pushing a commit to GitHub does not automatically change the app running at home. After an update is merged into `main`, update the repository on the home server. Stop the app server with **Ctrl+C** first; stop the sync API too if the update changes its server code. From the repository directory:

```powershell
git pull --ff-only origin main
npm install
npm run build
```

Restart `npm start` with the same `HOLOCRON_ALLOWED_HOSTS` setting, and restart `npm run start:sync` with the same database, origin, host, and port settings. The Tailscale Serve routes remain configured in the background. If only `public/catalog.json` changed, the API rereads it on each request; connected apps fetch updated card information when they launch or when **Get latest card info** is selected.

On iPhone, Steam Deck, and other clients, reconnect to Tailscale, reopen or refresh the app URL, and let the browser load the new version. Holocron's service worker updates the cached app shell when a new build is available. If you use **Save for offline use**, run it again while online to download newly added artwork. Device workspaces remain saved locally; use **Sync workspace** to send or receive changes.

### Connect a Steam Deck

The Deck is a client, not the sync server. Switch to **Desktop Mode**, open Konsole, and install the Tailscale client using the [Tailscale-maintained Steam Deck install helper](https://github.com/tailscale-dev/deck-tailscale):

```sh
git clone https://github.com/tailscale-dev/deck-tailscale.git ~/deck-tailscale
sudo -i
cd ~deck/deck-tailscale
bash tailscale.sh
source /etc/profile.d/tailscale.sh
tailscale up --qr --operator=deck
```

Scan the login QR code with a phone signed in to your Tailscale account and approve the Deck. Then leave the root shell with `exit`. The helper configures Tailscale to start at boot; verify the Deck appears in `tailscale status`. This helper changes the SteamOS system installation and is community-maintained; keep its instructions handy in case a SteamOS update requires reinstalling Tailscale.

In Desktop Mode's browser, open `https://<homebase-magicdns-name>/`, then use **Options → Save for offline use** if you want to play without a network. In **Options → Sync & card updates**, enter `https://<homebase-magicdns-name>:8443` and sign in. For Gaming Mode, add Firefox to Steam as a non-Steam game from Desktop Mode (**Steam → Games → Add a Non-Steam Game to My Library**), then open the same URL. Keep Tailscale connected to sync; local changes can be synced later when the Deck is back on your Tailnet.

### Optional: publish the app and API publicly

If you later want devices outside your Tailnet to connect, build the static app and serve `dist/` over HTTPS. Put the API behind a TLS reverse proxy and route `/api/*` to the Node process. For example, Caddy can serve the app and proxy the API on one origin:

```caddyfile
holocron.example.com {
    handle /api/* {
        reverse_proxy 127.0.0.1:41732
    }
    handle {
        root * /srv/holocron/dist
        file_server
    }
}
```

Set `HOLOCRON_ALLOWED_HOSTS` to include the public app hostname, and set `HOLOCRON_ALLOWED_ORIGINS` to the exact HTTPS app origin (no trailing slash). Keep the API bound to loopback behind the proxy; do not expose its unencrypted port. For a trusted reverse proxy, set `HOLOCRON_TRUST_PROXY=true` so authentication rate limits use the forwarded client IP. Use a process manager to restart the API after server reboots. Restrict filesystem access to the service account and protect database backups.

For either setup, **Sync workspace** transfers collection, decks, lists, favorites, settings, and supported play records. If both copies have changed, Holocron asks which one to keep. Resolve conflicts only after backing up any local data you want to retain. Sign out on shared devices.

The app checks the configured server for a newer card catalog when it starts and caches the result for offline browsing. Use **Get latest card info** to refresh on demand. To publish updated card details, replace the server's catalog file with the updated `catalog.json`; use a trusted Holocron catalog build/source. Existing local artwork remains in use, while newly added cards can use the image URLs in the refreshed catalog.

Accounts use password hashing and expiring bearer tokens. Use unique, strong passwords, keep the deployment on HTTPS, and do not share the API with untrusted users. This self-hosted service does not provide email verification, password recovery, or multi-user sharing of a workspace. Keep using **Backup workspace** as an independent recovery copy.

## Build from source

With Node.js 24 and npm, run:

```sh
npm install
npm test
npm run build
npm start
```

The build uses the checked-in catalog and downloads its card artwork once. Set `HOLOCRON_ART_CACHE` to an existing directory of original images named by the SHA-256 hash of each source URL plus `.img` to build without downloading. The build writes optimized WebP artwork and a static app to `dist/`. The launcher serves those files on loopback only.

Holocron is an unofficial fan project. Card artwork and Star Wars: Unlimited marks belong to their respective rights holders. The prebuilt Windows package includes the Node.js license in `runtime/LICENSE.txt`.

