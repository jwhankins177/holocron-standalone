import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const url = 'http://127.0.0.1:41731/';
const server = spawn(process.execPath, [fileURLToPath(new URL('./server.mjs', import.meta.url))], {stdio:['ignore','pipe','inherit']});
let opened = false;
server.stdout.on('data', chunk => {
  process.stdout.write(chunk);
  if (opened) return;
  opened = true;
  const [command, ...args] = process.platform === 'win32'
    ? ['rundll32.exe','url.dll,FileProtocolHandler',url]
    : process.platform === 'darwin' ? ['open',url] : ['xdg-open',url];
  const browser = spawn(command,args,{stdio:'ignore',windowsHide:true});
  browser.on('error', () => console.log('Open ' + url + ' in your browser.'));
});
server.on('exit', code => {process.exitCode = code ?? 0});
