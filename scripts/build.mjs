import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {cp, mkdir, readFile, readdir, rename, stat, writeFile} from 'node:fs/promises';
import {resolve, join} from 'node:path';
import {pathToFileURL, fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = join(root, 'dist');
const assetCache = resolve(process.env.HOLOCRON_ART_CACHE || join(root, '.art-cache'));
const require = createRequire(process.env.HOLOCRON_BUILD_DEPS || import.meta.url);
const vite = await import(pathToFileURL(require.resolve('vite')));
const sharp = require(process.env.HOLOCRON_BUILD_SHARP || 'sharp');
const readJson = async path => JSON.parse(await readFile(path, 'utf8'));
const writeJson = (path, data) => writeFile(path, JSON.stringify(data));

const catalog = await readJson(join(root, 'public/catalog.json'));
const battle = await readJson(join(root, 'public/battle/cards.json'));
const byId = new Map(catalog.cards.map(card => [card.id, card]));
const artwork = new Map();
function localArt(url) {
  if (!url) return '';
  const hash = createHash('sha256').update(url).digest('hex');
  artwork.set(hash, url);
  return 'art/' + hash + '.webp';
}

for (const cards of Object.values(battle)) {
  for (const card of cards) {
    const printing = byId.get(card.id);
    card.art = '../' + localArt(printing?.image || card.art);
    if (printing?.back) card.backArt = '../' + localArt(printing.back);
  }
}
battle.leaderArt = {
  luke: '../' + localArt(byId.get('SOR_005').back),
  vader: '../' + localArt(byId.get('SOR_010').back),
};
for (const card of catalog.cards) {
  card.image = localArt(card.image);
  card.back = localArt(card.back);
}

async function buildShell(emptyOutDir){
await vite.build({
  root,
  configFile: false,
  base: './',
  publicDir: false,
  resolve: {
    alias: Object.fromEntries(['react', 'react-dom', 'lucide-react'].map(name => [
      name, name === 'lucide-react' ? resolve(require.resolve(name), '../../esm/lucide-react.mjs') : resolve(require.resolve(name), '..'),
    ])),
  },
  oxc: {jsx: {runtime:'automatic'}},
  build: {outDir: output, emptyOutDir},
});

}
const shellOnly = process.argv.includes('--shell-only');
await buildShell(!shellOnly);
await mkdir(join(output, 'art'), {recursive: true});
await mkdir(assetCache, {recursive:true});
for (const file of await readdir(join(root, 'public'))) {
  if (file !== 'catalog.json') await cp(join(root, 'public', file), join(output, file), {recursive:true});
}
await writeJson(join(output, 'catalog.json'), catalog);
await writeJson(join(output, 'battle/cards.json'), battle);
if (shellOnly) {
  await import('./create-offline-manifest.mjs');
  process.exit(0);
}

async function sourceImage(hash, url) {
  const path = join(assetCache, hash + '.img');
  try {
    return await readFile(path);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const response = await fetch(url, {signal:AbortSignal.timeout(30000)});
  if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) {
    throw Error('Could not fetch artwork: ' + url + ' (HTTP ' + response.status + ')');
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  await writeFile(path + '.part', bytes);
  await rename(path + '.part', path);
  return bytes;
}

const jobs = artwork.entries();
let done = 0;
await Promise.all(Array.from({length: 10}, async () => {
  for (const [hash, url] of jobs) {
    const bytes = await sourceImage(hash, url);
    await sharp(bytes).rotate().resize({width:450,height:660,fit:'inside',withoutEnlargement:true})
      .webp({quality:78}).toFile(join(output, 'art', hash + '.webp'));
    if (++done % 1000 === 0) console.log(done + ' artwork files ready');
  }
}));
console.log('Bundled ' + catalog.cards.length + ' catalog entries and ' + done + ' artwork files.');

await import('./create-offline-manifest.mjs');
