import {createHash,randomUUID} from 'node:crypto';
import {hash} from 'bcryptjs';
import {z} from 'zod';
import type {SQL,Database} from './db';
import {ACTIVE,DEFAULT_CALENDAR,POSITIONS,addMonths,dateOnly,evaluate,limitFor,reminderAt,validDate,type Employee,type Leave,type LeaveInput,type Policy} from '../shared/domain';
export class AppError extends Error { constructor(public status:number,message:string,public code='INVALID',public details?:unknown){super(message);} }
export const ensure=(ok:unknown,message:string,status=422,code='INVALID',details?:unknown)=>{if(!ok)throw new AppError(status,message,code,details);};
export const inputSchema=z.object({category:z.enum(['REGULAR','EMERGENCY']),subtype:z.string().trim().min(2).max(120),reason:z.string().trim().min(10).max(2000),start:z.string().refine(validDate),end:z.string().refine(validDate),email:z.email().max(200),phone:z.string().regex(/^\+?[\d ()-]{8,20}$/)});
export async function employees(db:SQL):Promise<Employee[]> {return (await db.query('SELECT data FROM employees')).rows.map(r=>r.data);}
export async function requests(db:SQL,unit?:string):Promise<Leave[]> {return (await db.query('SELECT data FROM requests'+(unit?' WHERE unit_id=$1':''),unit?[unit]:[])).rows.map(r=>r.data);}
export async function getPolicy(db:SQL,unit:string):Promise<Policy> {const r=(await db.query('SELECT policy FROM units WHERE id=$1',[unit])).rows[0];ensure(r,'Unit tidak tersedia.',404);return r.policy;}
export async function saveRequest(db:SQL,r:Leave) {await db.query(`INSERT INTO requests(id,employee_id,unit_id,position,status,month,data) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO UPDATE SET status=excluded.status,month=excluded.month,data=excluded.data`,[r.id,r.employeeId,r.unit,r.position,r.status,r.effectiveStart.slice(0,7),r]);}
export async function audit(db:SQL,actor:Employee,action:string,id:string) {await db.query('INSERT INTO audit(id,unit_id,actor_id,action,object_id) VALUES($1,$2,$3,$4,$5)',[randomUUID(),actor.unit,actor.id,action,id]);}
export function canRead(actor:Employee,r:Leave) {return r.employeeId===actor.id || (actor.roles.includes('SDM')&&r.unit===actor.unit);}
export function checkEmail(email:string) {const domains=process.env.ALLOWED_EMAIL_DOMAINS?.split(',').map(s=>s.trim().toLowerCase());if(domains?.length)ensure(domains.includes(email.split('@')[1]?.toLowerCase()),'Domain email tidak diizinkan organisasi.');}
export const digest=(o:unknown)=>createHash('sha256').update(JSON.stringify(o)).digest('hex');
export async function preview(db:SQL,actor:Employee,input:LeaveInput,now:Date) {
  const policy=await getPolicy(db,actor.unit);const all=await requests(db);const local=all.filter(r=>r.unit===actor.unit);
  const p=evaluate(input,actor,all,policy.calendar,limitFor(actor.position,input.start.slice(0,7),policy,local),dateOnly(now));
  p.fingerprint=digest({input,days:p.days,calendar:policy.calendar,position:actor.position,unit:actor.unit,today:dateOnly(now)});
  if(p.effectiveStart)p.scheduledAt=reminderAt(p.effectiveStart,input.category,now);
  return p;
}
async function mail(db:SQL,r:Leave,kind:string,due:string) {await db.query('INSERT INTO mail_jobs(id,event_key,unit_id,request_id,kind,due_at) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(event_key) DO NOTHING',[randomUUID(),`${r.id}:${kind}`,r.unit,r.id,kind,due]);}
export async function mutate<T>(db:Database,actor:Employee,key:string,payload:unknown,fn:(tx:SQL)=>Promise<T>):Promise<T> {
  ensure(typeof key==='string'&&key.length>=8&&key.length<=150,'Identitas pengiriman tidak valid.');
  return db.transaction(async tx=>{
    // All mutations serialize on the unit row. Simpler than multiple locks for the initial single-unit scale.
    await tx.query('SELECT id FROM units WHERE id=$1 FOR UPDATE',[actor.unit]);
    const current=(await tx.query('SELECT data FROM employees WHERE id=$1',[actor.id])).rows[0]?.data;
    ensure(current?.active&&JSON.stringify(current.roles)===JSON.stringify(actor.roles)&&current.unit===actor.unit&&current.position===actor.position,'Profil berubah. Masuk kembali.',409);
    const old=(await tx.query('SELECT hash,result FROM operations WHERE actor_id=$1 AND key=$2',[actor.id,key])).rows[0];
    if(old){ensure(old.hash===digest(payload),'Identitas pengiriman digunakan untuk data berbeda.',409);return old.result as T;}
    const result=await fn(tx);
    await tx.query('INSERT INTO operations(actor_id,key,hash,result) VALUES($1,$2,$3,$4)',[actor.id,key,digest(payload),result]);
    return result;
  });
}
export async function submit(db:Database,actor:Employee,body:any,key:string,now:Date) {
  const input=inputSchema.parse(body);checkEmail(input.email);
  return mutate(db,actor,key,{action:'submit',...body},async tx=>{
    const p=await preview(tx,actor,input,now);
    ensure(!p.errors.length,p.errors[0]?.message??'Tidak valid',422,p.errors[0]?.code,p);
    ensure(body.fingerprint===p.fingerprint,'Perhitungan berubah. Tinjau kembali pengajuan.',409,'PREVIEW_CHANGED',p);
    ensure(!p.adjusted||body.acceptAdjustment===true,'Setujui penyesuaian tanggal sebelum mengirim.');
    let draft:Leave|undefined;
    if(body.draftId){draft=(await requests(tx,actor.unit)).find(r=>r.id===body.draftId);ensure(draft?.employeeId===actor.id&&draft.status==='DRAFT','Draft tidak ditemukan.',404);ensure(draft?.version===body.draftVersion,'Draft sudah berubah.',409);}
    const id=draft?.id??randomUUID();
    const r:Leave={...input,id,number:`CT-${dateOnly(now).replaceAll('-','')}-${id.slice(0,6).toUpperCase()}`,employeeId:actor.id,employeeName:actor.name,position:actor.position,unit:actor.unit,status:'PENDING_SDM',days:p.days,effectiveStart:p.effectiveStart,effectiveEnd:p.effectiveEnd,duration:p.duration,submittedAt:now.toISOString(),createdAt:draft?.createdAt??now.toISOString(),confirmation:'NOT_CONFIRMED',version:(draft?.version??0)+1,calendarVersion:(await getPolicy(tx,actor.unit)).calendar.version,limit:p.quota.limit,events:[{at:now.toISOString(),text:'Pengajuan dikirim ke SDM',actor:actor.name}]};
    await saveRequest(tx,r);await audit(tx,actor,'SUBMIT',id);await mail(tx,r,input.category==='REGULAR'?'REMINDER':'EMERGENCY',p.scheduledAt!);return r;
  });
}
export async function act(db:Database,actor:Employee,id:string,action:string,body:any,key:string,now:Date) {
  return mutate(db,actor,key,{id,action,...body},async tx=>{
    const r=(await requests(tx,actor.unit)).find(r=>r.id===id);ensure(r&&canRead(actor,r),'Pengajuan tidak ditemukan.',404);
    const leave=r!;ensure(leave.status==='PENDING_SDM','Pengajuan sudah diputuskan atau ditarik.',409,'REQUEST_ALREADY_DECIDED');ensure(body.version===leave.version,'Data sudah berubah. Muat ulang.',409,'STALE_VERSION');
    let text='';
    if(action==='withdraw'){ensure(actor.id===leave.employeeId,'Hanya pemohon yang dapat menarik.',403);leave.status='WITHDRAWN';text='Pengajuan ditarik pemohon';}
    else {
      ensure(actor.roles.includes('SDM')&&actor.id!==leave.employeeId,'Review memerlukan SDM lain yang berwenang.',403);
      if(action==='confirmation') {ensure(leave.category==='REGULAR','Konfirmasi hanya untuk cuti reguler.');ensure(['CONFIRMED','DECLINED'].includes(body.result),'Konfirmasi tidak valid.');ensure(typeof body.channel==='string'&&body.channel.trim().length>=2&&body.channel.length<=120,'Isi kanal konfirmasi.');leave.confirmation=body.result;leave.confirmationChannel=body.channel; text=body.result==='CONFIRMED'?'Karyawan mengonfirmasi jadi cuti':'Karyawan mengonfirmasi tidak jadi cuti';}
      else if(action==='decision'){
        ensure(['APPROVED','REJECTED'].includes(body.outcome),'Keputusan tidak valid.');
        if(body.outcome==='APPROVED'){ensure(leave.effectiveStart>=dateOnly(now),'Tanggal mulai cuti sudah terlewati.');ensure(leave.category==='EMERGENCY'||leave.confirmation==='CONFIRMED','Catat konfirmasi karyawan sebelum menyetujui.');}
        else ensure(typeof body.reason==='string'&&body.reason.trim().length>=5&&body.reason.length<=2000,'Alasan penolakan minimal 5 karakter.');
        leave.status=body.outcome;leave.decisionReason=typeof body.reason==='string'?body.reason.slice(0,2000):'';text=body.outcome==='APPROVED'?'Pengajuan disetujui SDM':'Pengajuan ditolak SDM';
      }else throw new AppError(404,'Aksi tidak ditemukan.');
    }
    leave.version++;leave.events.push({at:now.toISOString(),text,actor:actor.name});await saveRequest(tx,leave);await audit(tx,actor,action.toUpperCase(),id);
    if(action==='decision')await mail(tx,leave,'DECISION',now.toISOString());
    if(action==='withdraw'||action==='decision'||action==='confirmation')await tx.query("UPDATE mail_jobs SET state='SKIPPED' WHERE request_id=$1 AND kind='REMINDER' AND state='QUEUED'",[id]);
    return leave;
  });
}
export async function seed(db:Database,demo:boolean,now=new Date()) {
  const existingUnits = (await db.query('SELECT id, policy FROM units')).rows;
  if(existingUnits.length) {
    for(const u of existingUnits) {
      const pol: Policy = u.policy;
      let updated = false;
      if(!pol.calendar) { pol.calendar = structuredClone(DEFAULT_CALENDAR); updated = true; }
      else {
        if(!pol.calendar.exceptions) { pol.calendar.exceptions = {}; updated = true; }
        for(const [d, h] of Object.entries(DEFAULT_CALENDAR.exceptions)) {
          if(!pol.calendar.exceptions[d]) {
            pol.calendar.exceptions[d] = h;
            updated = true;
          }
        }
      }
      if(updated) {
        pol.calendar.version = (pol.calendar.version ?? 1) + 1;
        await db.query('UPDATE units SET policy=$1 WHERE id=$2', [pol, u.id]);
      }
    }
    return;
  }
  const policy:Policy={calendar:DEFAULT_CALENDAR,quotas:{}};
  await db.transaction(async tx=>{
    await tx.query('INSERT INTO units(id,name,policy) VALUES($1,$2,$3)',['KC01','Kantor Cabang • Demo',policy]);
    const password=demo?'BniCuti!2026':process.env.BOOTSTRAP_PASSWORD;
    ensure(password&&password.length>=12,'Atur BOOTSTRAP_PASSWORD minimal 12 karakter.');
    const passwordHash=await hash(password!,12);
    const people:Employee[]=demo?[
      {id:'sdm',name:'Nadia Putri',email:'sdm@demo.bni.local',phone:'081234567890',position:'BBO',unit:'KC01',roles:['SDM','EMPLOYEE'],active:true},
      {id:'employee',name:'Alya Rahma',email:'karyawan@demo.bni.local',phone:'081234567891',position:'CS_BINA',unit:'KC01',roles:['EMPLOYEE'],active:true},
      {id:'admin',name:'Administrator',email:'admin@demo.bni.local',phone:'081234567892',position:'BBO',unit:'KC01',roles:['ADMIN'],active:true},
      ...['Dimas Pratama','Rani Wulandari','Fajar Hidayat','Sinta Maharani','Bagas Saputra','Citra Lestari'].map((name,i)=>({id:`staff${i}`,name,email:`pegawai${i+1}@demo.bni.local`,phone:`0812345678${10+i}`,position:['TELLER','CS_FTE','BTRM','CS_BINA','ARM','TELLER'][i],unit:'KC01',roles:['EMPLOYEE'] as Employee['roles'],active:true})),
    ]:[{id:randomUUID(),name:'Administrator',email:process.env.BOOTSTRAP_EMAIL??'admin@example.internal',phone:'080000000000',position:'BBO',unit:'KC01',roles:['ADMIN'],active:true}];
    for(const p of people)await tx.query('INSERT INTO employees(id,email,password_hash,data) VALUES($1,$2,$3,$4)',[p.id,p.email,passwordHash,p]);
    if(demo){const month=addMonths(dateOnly(now).slice(0,7)+'-01',1).slice(0,7);let i=0;
      for(const p of people.slice(3,8)){
        const start=`${month}-${String(5+i*3).padStart(2,'0')}`;const working=Array.from({length:7},(_,k)=>`${month}-${String(5+i*3+k).padStart(2,'0')}`).filter(d=>validDate(d)&&![0,6].includes(new Date(d+'T00:00:00Z').getUTCDay())).slice(0,2);
        const id=randomUUID();const approved=i%3===0;const r:Leave={id,number:`CT-DEMO-${1001+i}`,employeeId:p.id,employeeName:p.name,position:p.position,unit:p.unit,status:approved?'APPROVED':'PENDING_SDM',category:'REGULAR',subtype:'Keperluan keluarga',reason:'Keperluan keluarga pada periode yang diajukan.',start:working[0]??start,end:working.at(-1)??start,email:p.email,phone:p.phone,days:working,effectiveStart:working[0],effectiveEnd:working.at(-1)!,duration:working.length,submittedAt:addMonths(working[0],-1)+'T01:00:00Z',createdAt:now.toISOString(),confirmation:approved?'CONFIRMED':'NOT_CONFIRMED',version:1,calendarVersion:1,limit:POSITIONS.find(x=>x[0]===p.position)![2],events:[{at:now.toISOString(),text:'Data contoh untuk demonstrasi',actor:'Sistem'}]};await saveRequest(tx,r);i++;
      }
    }
  });
}
