# Holocron Standalone

An offline Star Wars: Unlimited collection manager, deck builder, and play companion based on Holocron v2.9.5 (upstream commit `d760e67686edd659a667f1f87c810332d914155d`).

## Start the prebuilt app

- **Windows x64** - Extract the entire archive and double-click `Start-Holocron.cmd`. Keep the launcher window open while using Holocron. The archive includes Node.js and opens your browser at `http://127.0.0.1:41731/`.
- **Steam Deck or Linux** - In Desktop Mode, open a terminal in the extracted folder and run `sh start-holocron.sh`. The launcher uses Node.js when installed, with Python 3 as a fallback. Open the displayed localhost address.
- **macOS** - Run `sh start-holocron.sh` with Node.js or Python 3 available.

The catalog, all bundled card artwork, starter decks, collection tools, deck tools, guides, tracker, and Battle Lab work without internet access. ForceTable and external reference links open their respective websites when selected. The catalog and Premier rules are a snapshot. Live news, hosted catalog refresh, accounts, and cross-device sync are absent.

## iPhone and iPad

Serve the contents of the prebuilt package's dist folder from a static HTTPS host of your choice. Open that address in Safari and use **Share  Add to Home Screen**. From the Home Screen app, open **Options  Save for offline use** and leave it open until it says **Ready for offline use**. The initial download needs a connection to the host. This release has no signed native iOS installer.

## Bring over your workspace

1. In hosted Holocron, choose **Options  Backup workspace**.
2. Open Standalone and choose **My collection  Options  Import collection  Full backup**. Select the JSON file, preview it, and confirm the restore.

Your collection, decks, lists, favorites, preferences, and supported play records are stored in this browser profile. Use the same browser profile and localhost address each time. Clearing its site data removes the local workspace. Use **Backup workspace** to keep a separate copy or move it to another device.

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

