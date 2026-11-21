# Holocron Standalone

An offline Star Wars: Unlimited collection manager, deck builder, and play
companion based on Holocron v2.9.5 (upstream commit
`d760e67686edd659a667f1f87c810332d914155d`).

Holocron Standalone stores your workspace locally in the browser and can add
account-based cloud sync or Battle Lab hosting. The app ships with a bundled
card catalog, artwork, starter decks, and rules snapshots.

## Included tools

- Collection tracking, ownership review, highlights, achievements, and set
  completion.
- Deck assembly, sideboards, saved deck versions, comparisons, practice plans,
  format checks, and guides.
- Match records, matchup insights, and a live game table with damage controls.
- Battle Lab against an AI opponent.
- Manual and optional automatic workspace sync across signed-in devices.
- Independent JSON backup and restore, offline site updates, and PWA artwork
  caching.
- Release updates and current-card-data checks through **Sync & card updates**.

## Quick start

See [QUICKSTART.md](QUICKSTART.md) for local setup or current Railway
deployment steps. Railway hosting serves the app and sync API together from a
single service; set its build, start, healthcheck, public domain, and persistent
volume in Railway service settings. Services deploying this repository must
migrate the deprecated `railway.json` configuration before relying on
dashboard settings.

The prebuilt Windows package includes Node.js:

1. Extract the entire archive.
2. Double-click `Start-Holocron.cmd`.
3. Keep the launcher window open and use
   <http://127.0.0.1:41731/>.

The bundled catalog, card artwork, starter decks, collection tools, deck
tools, guides, tracker, and Battle Lab work without internet access.

## Workspace data

Workspaces, device sign-in, and downloaded card data are stored in browser
storage. Clearing site data removes the local workspace and sign-in.

- Use **My collection → Options → Backup workspace** for a complete JSON
  backup.
- Use **Sync & card updates** to export a backup, sign in, and sync between
  devices.
- Use **Options → Refresh site** to apply app updates without clearing browser
  storage.

## Bring over a workspace

1. In hosted Holocron, choose **Options → Backup workspace**.
2. In Standalone, choose **My collection → Options → Import collection →
   Full backup**.
3. Select the JSON file, preview it, and confirm the restore.

Clearing browser site data removes the local copy. Use **Backup workspace**
for an independent recovery copy.

## Build from source

With Node.js 24 and npm, run:

```sh
npm ci
npm run build
npm test
npm start
```

The build uses the checked-in catalog and downloads card artwork once. Set
`HOLOCRON_ART_CACHE` to a directory containing original image files named by
the SHA-256 hash of each source URL plus `.img` to build without downloading.
The build writes optimized WebP artwork and the static app to `dist/`.
`npm start` serves those files only on `127.0.0.1:41731`. `npm run
start:sync` runs the separate loopback sync API on `127.0.0.1:41732`, and
`npm run start:cloud` runs the static app and sync API together on `PORT`
(default `41731`).

Useful environment variables:

| Variable | Purpose |
| --- | --- |
| `HOLOCRON_SYNC_DATABASE` | SQLite database path for account workspaces. |
| `HOLOCRON_REGISTRATION_CODE` | Private invite code required to create accounts. |
| `HOLOCRON_ALLOWED_HOSTS` | Comma-separated HTTP host values accepted by the server. |
| `HOLOCRON_ALLOWED_ORIGINS` | Comma-separated browser origins accepted by the sync API. |
| `HOLOCRON_TRUST_PROXY` | Set `true` only behind a proxy that overwrites `X-Forwarded-For`. |
| `HOLOCRON_ART_CACHE` | Existing cache directory used during builds. |

On macOS and Linux, `./start-holocron.sh` starts the local launcher when Node.js
is available and falls back to a basic loopback HTTP server otherwise.

Holocron is an unofficial fan project. Card artwork and Star Wars: Unlimited marks belong to their respective rights holders. The prebuilt Windows package includes the Node.js license in `runtime/LICENSE.txt`.

