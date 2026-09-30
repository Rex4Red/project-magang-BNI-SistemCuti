// Run manually: node scripts/public-demo.mjs
import {spawn} from 'node:child_process';
import {existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const executable=resolve('.data/tools/cloudflared.exe');
if(!existsSync(executable)||!existsSync('dist/index.html'))throw new Error('Cloudflared atau build belum tersedia. Jalankan npm run build dan siapkan cloudflared.');
mkdirSync('.data/public-tunnel',{recursive:true});
const tunnel=spawn(executable,['tunnel','--no-autoupdate','--url','http://127.0.0.1:3002'],{windowsHide:true,stdio:['ignore','pipe','pipe']});
let api;let started=false;let output='';
function stop(){api?.kill();tunnel.kill();}
async function receive(chunk){
  const text=chunk.toString();process.stdout.write(text);output=(output+text).slice(-20000);
  const url=output.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/)?.[0];
  if(!url||started)return;started=true;
  const env={...process.env,NODE_ENV:'development',DATABASE_URL:'',DATA_DIR:resolve('.data/public-demo'),DEMO_MODE:'true',MAIL_MODE:'capture',PORT:'3002',APP_ORIGIN:url,TRUST_LOCAL_PROXY:'true'};
  api=spawn(process.execPath,['--import','tsx','server/index.ts'],{env,windowsHide:true,stdio:'inherit'});
  api.on('error',e=>{console.error(e.message);stop();process.exitCode=1;});
  api.on('exit',()=>tunnel.kill());
  writeFileSync('.data/public-tunnel/url.txt',url+'\n');
  for(let n=0;n<60;n++){
    await new Promise(r=>setTimeout(r,1000));
    try{const health=await fetch('http://127.0.0.1:3002/api/health');if(health.ok){console.log('\nLINK DEMO: '+url+'\nAkun: karyawan@demo.bni.local atau sdm@demo.bni.local\nPassword: BniCuti!2026\nBiarkan terminal ini terbuka. Ctrl+C untuk menutup akses publik.\n');return;}}catch{}
  }
  console.error('Aplikasi belum siap. Periksa pesan error di atas.');stop();process.exitCode=1;
}
tunnel.stdout.on('data',receive);tunnel.stderr.on('data',receive);
tunnel.on('error',e=>{console.error(e.message);stop();process.exitCode=1;});
tunnel.on('exit',()=>api?.kill());
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{stop();process.exit();});
