import {spawn} from 'node:child_process';
const env={...process.env,NODE_ENV:'test',DATA_DIR:'memory://',DATABASE_URL:'',DEMO_MODE:'true',MAIL_MODE:'capture',PORT:'3011',APP_ORIGIN:'http://127.0.0.1:5174',API_TARGET:'http://127.0.0.1:3011'};
const children=[spawn(process.execPath,['--import','tsx','server/index.ts'],{env,stdio:'inherit',windowsHide:true}),spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5174'],{env,stdio:'inherit',windowsHide:true})];
for(const child of children)child.on('exit',code=>{if(code)process.exitCode=code;});
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{for(const child of children)child.kill();process.exit();});
