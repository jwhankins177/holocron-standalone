# Holocron Standalone

An offline Star Wars: Unlimited collection manager, deck builder, and play
companion based on Holocron v2.9.5 (upstream commit
`d760e67686edd659a667f1f87c810332d914155d`).

## Quick start

See [QUICKSTART.md](QUICKSTART.md) for the supported setup: run the app locally
or host the app and sync API together on Railway.

The prebuilt Windows package includes Node.js:

1. Extract the entire archive.
2. Double-click `Start-Holocron.cmd`.
3. Keep the launcher window open and use
   <http://127.0.0.1:41731/>.

The bundled catalog, card artwork, starter decks, collection tools, deck
tools, guides, tracker, and Battle Lab work without internet access.

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
npm install
npm test
npm run build
npm start
```

The build uses the checked-in catalog and downloads its card artwork once. Set `HOLOCRON_ART_CACHE` to an existing directory of original images named by the SHA-256 hash of each source URL plus `.img` to build without downloading. The build writes optimized WebP artwork and a static app to `dist/`. The launcher serves those files on loopback only.

Holocron is an unofficial fan project. Card artwork and Star Wars: Unlimited marks belong to their respective rights holders. The prebuilt Windows package includes the Node.js license in `runtime/LICENSE.txt`.

