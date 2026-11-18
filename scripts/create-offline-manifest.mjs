import {createHash} from 'node:crypto';
import {readFile, readdir, writeFile} from 'node:fs/promises';

const dist = new URL('../dist/', import.meta.url);
const names = async path => (await readdir(new URL(path, dist))).sort();
const shell = ['./','index.html','catalog.json','manifest.webmanifest',
  'standalone-icon-32.png','standalone-icon-180.png','standalone-icon-192.png','standalone-icon-512.png',
  ...(await names('assets/')).map(file=>'assets/'+file),
  ...(await names('battle/')).map(file=>'battle/'+file)];
const art = (await names('art/')).map(file=>'art/'+file);
const hash = createHash('sha256');
for (const file of shell.slice(1)) hash.update(await readFile(new URL(file, dist)));
hash.update(JSON.stringify(art));
const key = 'holocron-standalone-' + hash.digest('hex').slice(0,16);
await writeFile(new URL('offline-manifest.json',dist),JSON.stringify({key,shell,art}));
const worker = await readFile(new URL('offline-worker.js',import.meta.url),'utf8');
await writeFile(new URL('sw.js',dist),'const cacheKey = '+JSON.stringify(key)+';\n'+worker);
