import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import {compare,hash} from 'bcryptjs';
import {randomBytes,randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
import {z,ZodError} from 'zod';
import type {Database} from './db';
import {directoryRoutes} from './directory';
import {assignedDuring,employeeOutlet,outlets,replacementCheck} from './replacement';
import {AppError,act,audit,canRead,checkEmail,digest,employees,ensure,getPolicy,inputSchema,mutate,preview,requests,saveRequest,submit} from './service';
import {buildExcelReport,buildXlsxReport} from './reports';
import {ACTIVE,HOLIDAYS_2027,PASSWORD_PATTERN,PASSWORD_HINT,positionsFor,blockedDays,dateOnly,evaluate,limitFor,quotaFor,validDate,type Employee,type Leave,type Policy} from '../shared/domain';
declare global {namespace Express {interface Request {actor:Employee;}}}
export function createApp(db:Database,options:{demo:boolean;now?:()=>Date;origin?:string}) {
  const app=express();const now=options.now??(()=>new Date());const production=process.env.NODE_ENV==='production';
  app.disable('x-powered-by');if(process.env.TRUST_LOCAL_PROXY==='true')app.set('trust proxy','loopback');app.use(helmet({contentSecurityPolicy:production?undefined:false}));app.use(express.json({limit:'40kb'}));app.use(cookieParser());
  app.get('/api/health',(_req,res)=>res.json({ok:true}));
  app.get('/api/config',(_req,res)=>res.json({demo:options.demo,today:dateOnly(now()),mailMode:process.env.MAIL_MODE??'capture'}));
  const isAllowedOrigin = (orig?: string) => {
    if (!orig) return true;
    const expected = options.origin ?? 'http://127.0.0.1:5173';
    if (orig === expected) return true;
    if (!production) {
      try {
        const u = new URL(orig);
        if (u.hostname.endsWith('.trycloudflare.com') || u.hostname.endsWith('.loca.lt') || u.hostname === 'localhost' || u.hostname === '127.0.0.1') return true;
      } catch {}
    }
    return false;
  };
  app.use('/api', (req, _res, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const origin = req.get('origin');
      if (origin && !isAllowedOrigin(origin)) return next(new AppError(403, 'Asal permintaan tidak diizinkan.'));
      if (req.get('x-cuti-client') !== 'web') return next(new AppError(403, 'Permintaan tidak valid.'));
    }
    next();
  });
  app.post('/api/login', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false }), async (req, res) => {
    const { email, password } = z.object({ email: z.email().max(200), password: z.string().max(200) }).parse(req.body);
    const row = (await db.query('SELECT data,password_hash FROM employees WHERE email=$1', [email.toLowerCase()])).rows[0];
    ensure(row?.data.active && await compare(password, row.password_hash), 'Email atau kata sandi tidak sesuai.', 401);
    const token = randomBytes(32).toString('hex'); await db.query('INSERT INTO sessions(token,employee_id,expires_at) VALUES($1,$2,$3)', [digest(token), row.data.id, new Date(now().getTime() + 8 * 3600000).toISOString()]);
    const isHttps = production || options.origin?.startsWith('https://') === true || req.get('x-forwarded-proto') === 'https' || req.get('origin')?.startsWith('https://') === true;
    res.cookie('cuti_session', token, { httpOnly: true, sameSite: 'lax', secure: isHttps, maxAge: 8 * 3600000, path: '/' }).json(row.data);
  });
  app.get('/api/verify-certificate', rateLimit({ windowMs: 15 * 60 * 1000, limit: 120, standardHeaders: true, legacyHeaders: false }), async (req, res) => {
    const num = (req.query.num as string | undefined)?.trim();
    const id = (req.query.id as string | undefined)?.trim();
    if (!num && !id) return res.status(400).json({ valid: false, message: 'Nomor atau ID dokumen diperlukan.' });
    const all = await requests(db);
    const found = all.find(r => (id && r.id === id) || (num && r.number.toLowerCase() === num.toLowerCase()));
    if (!found) {
      return res.status(404).json({ valid: false, message: 'Surat keterangan cuti tidak ditemukan dalam sistem perbankan BNI.' });
    }
    const unitRow = (await db.query('SELECT name FROM units WHERE id=$1', [found.unit])).rows[0];
    res.json({
      valid: true,
      id: found.id,
      number: found.number,
      employeeName: found.employeeName,
      unitName: unitRow?.name ?? 'PT Bank Negara Indonesia (Persero) Tbk',
      position: found.positionName ?? found.position,
      category: found.category === 'REGULAR' ? 'Cuti Reguler' : 'Cuti Darurat',
      subtype: found.subtype,
      status: found.status,
      effectiveStart: found.effectiveStart,
      effectiveEnd: found.effectiveEnd,
      duration: found.duration,
      replacement: found.replacement ? {
        employeeName: found.replacement.employeeName,
        position: found.replacement.position,
        outletName: found.replacement.outletName,
      } : undefined,
      verifiedAt: now().toISOString()
    });
  });
  app.use('/api',async(req,_res,next)=>{try{const token=req.cookies.cuti_session;ensure(typeof token==='string','Silakan masuk kembali.',401);const row=(await db.query('SELECT e.data FROM sessions s JOIN employees e ON e.id=s.employee_id WHERE s.token=$1 AND s.expires_at>$2',[digest(token),now().toISOString()])).rows[0];ensure(row?.data.active,'Sesi berakhir. Silakan masuk kembali.',401);req.actor=row.data;next();}catch(e){next(e);}});
  app.get('/api/me',(req,res)=>res.json(req.actor));
  app.post('/api/logout',async(req,res)=>{await db.query('DELETE FROM sessions WHERE token=$1',[digest(req.cookies.cuti_session)]);res.clearCookie('cuti_session').json({ok:true});});
  app.get('/api/dashboard',async(req,res)=>{
    const month=z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/).parse(req.query.month);const actor=req.actor;const all=await requests(db,actor.unit);const policy=await getPolicy(db,actor.unit);const sdm=actor.roles.includes('SDM');
    const staff=sdm?await employees(db):[];
    const visible=all.filter(r=>sdm?r.status!=='DRAFT':(r.employeeId===actor.id||r.replacement?.employeeId===actor.id)).map(r=>{
      if(r.replacement&&!r.replacement.phone){
        const emp=staff.find(e=>e.id===r.replacement!.employeeId);
        if(emp){r.replacement.phone=emp.phone;r.replacement.email=r.replacement.email||emp.email;}
      }
      return r;
    }).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
    const positions=positionsFor(policy);const quotas=positions.filter(p=>sdm||actor.roles.includes('ADMIN')||p[0]===actor.position).map(([code,label])=>({...quotaFor(code,month,all,limitFor(code,month,policy,all),actor.id),label}));
    const calendar=all.filter(r=>ACTIVE.includes(r.status)&&r.effectiveStart.slice(0,7)===month&&(sdm||r.position===actor.position||r.replacement?.employeeId===actor.id)).map(r=>({id:sdm||r.employeeId===actor.id||r.replacement?.employeeId===actor.id?r.id:'',name:sdm||r.employeeId===actor.id||r.replacement?.employeeId===actor.id?r.employeeName:'Rekan satu posisi',position:r.position,status:r.status,days:r.days}));
    res.json({requests:visible,quotas,calendar,positions,blocked:blockedDays(month,policy.calendar),calendarConfig:policy.calendar,today:dateOnly(now()),unitName:(await db.query('SELECT name FROM units WHERE id=$1',[actor.unit])).rows[0].name});
  });
  app.post('/api/leave-requests/preview',async(req,res)=>{const input=inputSchema.parse(req.body);checkEmail(input.email);res.json(await preview(db,req.actor,input,now()));});
  app.post('/api/leave-requests',async(req,res)=>res.status(201).json(await submit(db,req.actor,req.body,req.get('idempotency-key')??'',now())));
  app.get('/api/leave-requests/:id',async(req,res)=>{
    const r=(await requests(db,req.actor.unit)).find(r=>r.id===req.params.id);
    ensure(r&&canRead(req.actor,r),'Pengajuan tidak ditemukan.',404);
    const found=r!;
    if(found.replacement&&!found.replacement.phone){
      const emp=(await employees(db)).find(e=>e.id===found.replacement!.employeeId);
      if(emp){found.replacement.phone=emp.phone;found.replacement.email=found.replacement.email||emp.email;}
    }
    res.json(found);
  });
  app.get('/api/leave-requests/:id/replacements',async(req,res)=>{
    ensure(req.actor.roles.includes('SDM'),'Akses SDM diperlukan.',403);
    const leave=(await requests(db,req.actor.unit)).find(r=>r.id===req.params.id);ensure(leave&&canRead(req.actor,leave),'Pengajuan tidak ditemukan.',404);
    res.json(await replacementCheck(db,leave!,await getPolicy(db,req.actor.unit)));
  });
  app.post('/api/leave-requests/:id/:action',async(req,res)=>res.json(await act(db,req.actor,req.params.id as string,req.params.action as string,req.body,req.get('idempotency-key')??'',now())));
  app.post('/api/drafts',async(req,res)=>{
    const body=z.object({id:z.string().optional(),version:z.number().optional(),category:z.enum(['REGULAR','EMERGENCY']),subtype:z.string().max(120),reason:z.string().max(2000),start:z.string().max(10),end:z.string().max(10),email:z.string().max(200),phone:z.string().max(20)}).parse(req.body);
    res.json(await mutate(db,req.actor,req.get('idempotency-key')??'',{action:'draft',...body},async tx=>{const old=body.id?(await requests(tx,req.actor.unit)).find(r=>r.id===body.id):undefined;if(body.id)ensure(old?.employeeId===req.actor.id&&old?.status==='DRAFT'&&old.version===body.version,'Draft sudah berubah atau tidak ditemukan.',409);
      const {id:_id,version:_version,...input}=body;const r:Leave={...input,id:old?.id??randomUUID(),number:'Draft',employeeId:req.actor.id,employeeName:req.actor.name,unit:req.actor.unit,position:req.actor.position,status:'DRAFT',days:[],effectiveStart:'',effectiveEnd:'',duration:0,submittedAt:'',createdAt:old?.createdAt??now().toISOString(),confirmation:'NOT_CONFIRMED',version:(old?.version??0)+1,calendarVersion:0,limit:0,events:[]};await saveRequest(tx,r);return r;}));
  });
  app.delete('/api/drafts/:id',async(req,res)=>{res.json(await mutate(db,req.actor,req.get('idempotency-key')??'',{action:'deleteDraft',id:req.params.id},async tx=>{const r=(await requests(tx,req.actor.unit)).find(r=>r.id===req.params.id);ensure(r?.employeeId===req.actor.id&&r.status==='DRAFT','Draft tidak ditemukan.',404);await tx.query('DELETE FROM requests WHERE id=$1',[r!.id]);return {ok:true};}));});
  app.get('/api/reports.xlsx',async(req,res)=>{ensure(req.actor.roles.includes('SDM'),'Akses SDM diperlukan.',403);const month=z.union([z.literal('all'),z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/)]).parse(req.query.month);const rows=(await requests(db,req.actor.unit)).filter(r=>(month==='all'||r.effectiveStart.startsWith(month))&&r.status!=='DRAFT');const buf=await buildXlsxReport(rows,req.actor,month,now());await audit(db,req.actor,'EXPORT',month);res.attachment(`monitoring-cuti-${month}.xlsx`).type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').send(buf);});
  app.get('/api/reports.xls',async(req,res)=>{ensure(req.actor.roles.includes('SDM'),'Akses SDM diperlukan.',403);const month=z.union([z.literal('all'),z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/)]).parse(req.query.month);const rows=(await requests(db,req.actor.unit)).filter(r=>(month==='all'||r.effectiveStart.startsWith(month))&&r.status!=='DRAFT');const xls=buildExcelReport(rows,req.actor,month,now());await audit(db,req.actor,'EXPORT',month);res.attachment(`monitoring-cuti-${month}.xls`).type('application/vnd.ms-excel; charset=utf-8').send(xls);});
  app.get('/api/reports.csv',async(req,res)=>{ensure(req.actor.roles.includes('SDM'),'Akses SDM diperlukan.',403);const month=z.union([z.literal('all'),z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/)]).parse(req.query.month);const rows=(await requests(db,req.actor.unit)).filter(r=>(month==='all'||r.effectiveStart.startsWith(month))&&r.status!=='DRAFT');const cell=(v:string|number)=>'"'+String(v).replace(/^[=+@-]/,"'$&").replaceAll('"','""')+'"';const csv=[['Nomor','Nama','Posisi','Kategori','Mulai','Akhir','Hari kerja','Status'],...rows.map(r=>[r.number,r.employeeName,r.position,r.category,r.effectiveStart,r.effectiveEnd,r.duration,r.status])].map(r=>r.map(cell).join(',')).join('\r\n');await audit(db,req.actor,'EXPORT',month);res.attachment(`monitoring-cuti-${month}.csv`).type('text/csv').send('\uFEFF'+csv);});
  app.use('/api/admin',(req,_res,next)=>{try{ensure(req.actor.roles.includes('ADMIN'),'Akses administrator diperlukan.',403);next();}catch(e){next(e);}});
  directoryRoutes(app,db,now);
  app.get('/api/admin',async(req,res)=>{const list=(await employees(db)).filter(e=>e.unit===req.actor.unit);const jobs=(await db.query('SELECT id,kind,due_at,state,attempts,last_error FROM mail_jobs WHERE unit_id=$1 ORDER BY created_at DESC LIMIT 100',[req.actor.unit])).rows;const logs=(await db.query('SELECT * FROM audit WHERE unit_id=$1 ORDER BY at DESC LIMIT 100',[req.actor.unit])).rows;const policy=await getPolicy(db,req.actor.unit);res.json({employees:list,policy,positions:positionsFor(policy),outlets:await outlets(db,req.actor.unit),jobs,audit:logs});});
  app.post('/api/admin/employee',async(req,res)=>{
    const body=z.object({id:z.string().optional(),name:z.string().trim().min(2).max(100),email:z.email().max(200),phone:z.string().min(8).max(20),position:z.string().max(40),outletId:z.string().optional(),roles:z.array(z.enum(['EMPLOYEE','SDM','ADMIN'])).min(1),active:z.boolean(),password:z.string().max(200).regex(PASSWORD_PATTERN,PASSWORD_HINT).optional()}).parse(req.body);
    res.json(await mutate(db,req.actor,req.get('idempotency-key')??'',{action:'employee',...body},async tx=>{const existing=body.id?(await employees(tx)).find(e=>e.id===body.id&&e.unit===req.actor.unit):undefined;if(body.id)ensure(existing,'Pegawai tidak ditemukan.',404);if(!body.id)ensure(body.password,'Kata sandi awal wajib diisi.');if(body.id===req.actor.id)ensure(body.active&&body.roles.includes('ADMIN'),'Anda tidak dapat menonaktifkan akses admin sendiri.');
      const isSdm=body.roles.includes('SDM');
      if(isSdm) body.position='SDM';
      ensure(isSdm||body.position!=='SDM','Posisi SDM hanya untuk peran SDM.',422);
      const policyPositions=positionsFor(await getPolicy(tx,req.actor.unit));
      const position=body.position==='SDM'?(policyPositions.find(p=>p[0]==='SDM')??['SDM','SDM',0] as const):policyPositions.find(p=>p[0]===body.position);
      ensure(position,'Posisi tidak tersedia.');
      const outletId=body.outletId??(existing?employeeOutlet(existing):employeeOutlet(req.actor));ensure((await outlets(tx,req.actor.unit)).some(o=>o.id===outletId),'Outlet tidak tersedia dalam cabang ini.');
      if(existing&&(existing.position!==body.position||employeeOutlet(existing)!==outletId||!body.active||!body.roles.includes('EMPLOYEE'))){const all=await requests(tx,req.actor.unit);ensure(!all.some(r=>r.employeeId===existing.id&&ACTIVE.includes(r.status)&&r.effectiveEnd>=dateOnly(now())),'Selesaikan pengajuan aktif sebelum mengubah posisi/outlet/akses.');ensure(!all.some(r=>assignedDuring(r,existing.id,dateOnly(now()))),'Karyawan masih memiliki tugas PGS aktif.',409);}
      const {password,id,...fields}=body;const e:Employee={...fields,outletId,positionName:position![1],email:body.email.toLowerCase(),id:existing?.id??randomUUID(),unit:req.actor.unit};const pw=password?await hash(password,12):(await tx.query('SELECT password_hash FROM employees WHERE id=$1',[e.id])).rows[0].password_hash;
      await tx.query('INSERT INTO employees(id,email,password_hash,data) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO UPDATE SET email=excluded.email,password_hash=excluded.password_hash,data=excluded.data',[e.id,e.email,pw,e]);await audit(tx,req.actor,'EMPLOYEE_UPDATE',e.id);return e;}));
  });
  app.delete('/api/admin/employee/:id',async(req,res)=>{
    res.json(await mutate(db,req.actor,req.get('idempotency-key')??'',{action:'deleteEmployee',id:req.params.id},async tx=>{
      const employee=(await employees(tx)).find(e=>e.id===req.params.id&&e.unit===req.actor.unit);
      ensure(employee,'Karyawan tidak ditemukan.',404);
      ensure(employee!.id!==req.actor.id,'Anda tidak dapat menghapus akun sendiri.',409);
      const leaves=await requests(tx,req.actor.unit);
      ensure(!leaves.some(r=>assignedDuring(r,employee!.id,dateOnly(now()))),'Karyawan masih memiliki tugas PGS aktif.',409);
      ensure(!leaves.some(r=>r.employeeId===employee!.id&&(r.status==='PENDING_SDM'||(r.status==='APPROVED'&&r.effectiveEnd>=dateOnly(now())))),'Selesaikan pengajuan yang menunggu review atau cuti aktif sebelum menghapus karyawan.',409);
      const deleted={...employee!,active:false,deletedAt:now().toISOString()};
      await tx.query('UPDATE employees SET data=$1 WHERE id=$2',[deleted,deleted.id]);
      await tx.query('DELETE FROM sessions WHERE employee_id=$1',[deleted.id]);
      await audit(tx,req.actor,'EMPLOYEE_DELETE',deleted.id);
      return {ok:true};
    }));
  });
  app.post('/api/admin/calendar',async(req,res)=>{
    const body=z.object({date:z.string().refine(validDate),working:z.boolean(),label:z.string().trim().min(2).max(150),remove:z.boolean().optional()}).parse(req.body);
    res.json(await mutate(db,req.actor,req.get('idempotency-key')??'',{action:'calendar',...body},async tx=>{const policy=await getPolicy(tx,req.actor.unit);ensure(body.date>=dateOnly(now()),'Kalender historis tidak dapat diubah.');const changed=structuredClone(policy);if(body.remove)delete changed.calendar.exceptions[body.date];else changed.calendar.exceptions[body.date]={working:body.working,label:body.label};changed.calendar.version++;
      const all=await requests(tx,req.actor.unit);for(const r of all.filter(r=>ACTIVE.includes(r.status)&&r.effectiveStart.slice(0,7)===body.date.slice(0,7))){const actor=(await employees(tx)).find(e=>e.id===r.employeeId)!;const result=evaluate({...r,category:'EMERGENCY'},actor,[],changed.calendar,999,r.effectiveStart);ensure(result.days.join(',')===r.days.join(','),'Perubahan kalender memengaruhi cuti aktif pada bulan tersebut.',409);}
      await tx.query('UPDATE units SET policy=$1 WHERE id=$2',[changed,req.actor.unit]);await audit(tx,req.actor,'CALENDAR_UPDATE',body.date);return changed;}));
  });
  app.post('/api/admin/calendar/sync-2027',async(req,res)=>{
    res.json(await mutate(db,req.actor,req.get('idempotency-key')??'',{action:'calendar-sync-2027'},async tx=>{
      const policy=await getPolicy(tx,req.actor.unit);
      const changed=structuredClone(policy);
      if(!changed.calendar.exceptions) changed.calendar.exceptions={};
      for(const [d,h] of Object.entries(HOLIDAYS_2027)) changed.calendar.exceptions[d]=h;
      changed.calendar.version++;
      const all=await requests(tx,req.actor.unit);
      for(const r of all.filter(r=>ACTIVE.includes(r.status)&&r.effectiveStart.startsWith('2027-'))){
        const actor=(await employees(tx)).find(e=>e.id===r.employeeId)!;
        const result=evaluate({...r,category:'EMERGENCY'},actor,[],changed.calendar,999,r.effectiveStart);
        ensure(result.days.join(',')===r.days.join(','),'Perubahan kalender memengaruhi cuti aktif pada tahun 2027.',409);
      }
      await tx.query('UPDATE units SET policy=$1 WHERE id=$2',[changed,req.actor.unit]);
      await audit(tx,req.actor,'CALENDAR_UPDATE','HOLIDAYS_2027_SYNC');
      return changed;
    }));
  });
  app.post('/api/admin/quota',async(req,res)=>{const body=z.object({month:z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/),position:z.string(),limit:z.number().int().min(0).max(1000)}).parse(req.body);res.json(await mutate(db,req.actor,req.get('idempotency-key')??'',{action:'quota',...body},async tx=>{ensure(body.month>dateOnly(now()).slice(0,7),'Kuota hanya dapat diubah untuk bulan mendatang.');const all=await requests(tx,req.actor.unit);ensure(!all.some(r=>r.position===body.position&&r.effectiveStart.startsWith(body.month)&&r.status!=='DRAFT'),'Kuota bulan ini sudah memiliki alokasi dan dibekukan.',409);const policy=await getPolicy(tx,req.actor.unit);ensure(positionsFor(policy).some(p=>p[0]===body.position),'Posisi tidak tersedia.');const defaults=Object.fromEntries(positionsFor(policy).map(([p])=>[p,limitFor(p,body.month,policy,[])]));policy.quotas[body.month]={...defaults,...policy.quotas[body.month],[body.position]:body.limit};await tx.query('UPDATE units SET policy=$1 WHERE id=$2',[policy,req.actor.unit]);await audit(tx,req.actor,'QUOTA_UPDATE',body.position+':'+body.month);return policy;}));});
  app.post('/api/admin/jobs/:id/retry',async(req,res)=>{await db.query("UPDATE mail_jobs SET state='QUEUED',attempts=0,due_at=$1,last_error=NULL WHERE id=$2 AND unit_id=$3 AND state='FAILED'",[now().toISOString(),req.params.id,req.actor.unit]);await audit(db,req.actor,'MAIL_RETRY',req.params.id as string);res.json({ok:true});});
  app.use('/api',(_req,_res,next)=>next(new AppError(404,'Endpoint tidak ditemukan.')));
  app.use(express.static(resolve('dist')));app.get('/{*path}',(_req,res)=>res.sendFile(resolve('dist/index.html')));
  app.use((err:any,_req:express.Request,res:express.Response,_next:express.NextFunction)=>{if(err instanceof ZodError)return res.status(422).json({message:'Periksa isian: '+err.issues.map(i=>i.path.join('.')+' '+i.message).join('; ')});if(err.code==='23505')return res.status(409).json({message:'Data sudah terdaftar. Gunakan nilai lain.'});if(err instanceof AppError)return res.status(err.status).json({message:err.message,code:err.code,details:err.details});console.error('Request failed:',err.name,err.code??'INTERNAL');res.status(500).json({message:'Terjadi kesalahan server. Coba kembali.'});});
  return app;
}
