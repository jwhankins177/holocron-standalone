# Holocron Standalone

An offline Star Wars: Unlimited collection manager, deck builder, and play companion based on Holocron v2.9.5 (upstream commit `d760e67686edd659a667f1f87c810332d914155d`).

## Start the prebuilt app

- **Windows x64** - Extract the entire archive and double-click `Start-Holocron.cmd`. Keep the launcher window open while using Holocron. The archive includes Node.js and opens your browser at `http://127.0.0.1:41731/`.
- **Steam Deck or Linux** - In Desktop Mode, open a terminal in the extracted folder and run `sh start-holocron.sh`. The launcher uses Node.js when installed, with Python 3 as a fallback. Open the displayed localhost address.
- **macOS** - Run `sh start-holocron.sh` with Node.js or Python 3 available.

The catalog, all bundled card artwork, starter decks, collection tools, deck tools, guides, tracker, and Battle Lab work without internet access. ForceTable and external reference links open their respective websites when selected. The bundled catalog and Premier rules are a snapshot. Optional account-based workspace sync and hosted catalog refresh are available when you connect a sync server.

## iPhone and iPad

Serve the contents of the prebuilt package's dist folder from a static HTTPS host of your choice. Open that address in Safari and use **Share  Add to Home Screen**. From the Home Screen app, open **Options  Save for offline use** and leave it open until it says **Ready for offline use**. The initial download needs a connection to the host. This release has no signed native iOS installer.

## Bring over your workspace

1. In hosted Holocron, choose **Options  Backup workspace**.
2. Open Standalone and choose **My collection  Options  Import collection  Full backup**. Select the JSON file, preview it, and confirm the restore.

Your collection, decks, lists, favorites, preferences, and supported play records are stored in this browser profile. Use the same browser profile and localhost address each time. Clearing its site data removes the local workspace. Use **Backup workspace** to keep a separate copy or move it to another device.

## Set up cross-device sync

Holocron can use a self-hosted Node.js sync API. The API stores an account, one revisioned workspace per account, and serves the card catalog. The app still saves locally and works offline; syncing is manual. A public HTTPS deployment is required for devices outside the machine running the server.

### Run the API

Use Node.js 24 or newer. From the repository root, set an allowed app origin and a durable database location, then start the API:

```powershell
New-Item -ItemType Directory -Force "C:\holocron-data"
$env:HOLOCRON_ALLOWED_ORIGINS = "https://holocron.example.com"
$env:HOLOCRON_SYNC_DATABASE = "C:\holocron-data\holocron-sync.sqlite"
$env:HOLOCRON_SYNC_HOST = "127.0.0.1"
$env:HOLOCRON_SYNC_PORT = "41732"
$env:HOLOCRON_TRUST_PROXY = "true"
npm run start:sync
```

On Linux/macOS, for example:

```sh
mkdir -p /var/lib/holocron
HOLOCRON_ALLOWED_ORIGINS=https://holocron.example.com \
HOLOCRON_SYNC_DATABASE=/var/lib/holocron/holocron-sync.sqlite \
HOLOCRON_SYNC_HOST=127.0.0.1 \
HOLOCRON_SYNC_PORT=41732 \
HOLOCRON_TRUST_PROXY=true \
npm run start:sync
```

The default catalog is `public/catalog.json`. To serve a separately maintained catalog file, set `HOLOCRON_SYNC_CATALOG` to its absolute path. The API rereads that file for each catalog request, so replacing it publishes the new card information without restarting the server. Keep database and catalog files outside the public static site.

### Publish the app and API over HTTPS

Build the static app with `npm install` and `npm run build`, then serve `dist/` from a static host. Put the API behind a TLS reverse proxy and route `/api/*` to the Node process. For example, a Caddy site can serve the app and proxy the API on the same origin:

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

Set `HOLOCRON_ALLOWED_ORIGINS` to the exact HTTPS origin serving the app (no trailing slash). With a trusted reverse proxy, set `HOLOCRON_TRUST_PROXY=true` so authentication rate limits use the client IP forwarded by Caddy; only enable this while the API is bound to loopback behind that proxy. Do not expose the unencrypted API port to the internet. Use a process manager to restart `npm run start:sync` after server reboots. Restrict filesystem access to the service account and make regular, encrypted backups of the SQLite database. Anyone can register an account on this API, so protect the host and its data accordingly.

When the server is available, open **Options → Sync & card updates** on each device, enter the HTTPS origin, then create an account or sign in with the same account. Choose **Sync workspace** to transfer collection, decks, lists, favorites, settings, and supported play records. On a new device with an existing cloud workspace, choose the cloud copy; if both copies have changed, Holocron asks which one to keep. Resolve conflicts only after backing up any local data you want to retain. Sign out on shared devices.

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

