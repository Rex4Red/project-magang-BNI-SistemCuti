import {beforeEach,afterEach,it,expect} from 'vitest';
import supertest from 'supertest';
import {randomUUID} from 'node:crypto';
import {hash} from 'bcryptjs';
import {openDatabase,type Database} from '../server/db';
import {createApp} from '../server/app';
import {seed,employees,preview,submit,act,getPolicy,requests} from '../server/service';
import {outlets,replacementCheck} from '../server/replacement';
import type {Employee,LeaveInput,ReplacementRule} from '../shared/domain';
let db:Database;let app:ReturnType<typeof createApp>;let hr:Employee;let manager:Employee;let pgs:Employee;let admin:ReturnType<typeof supertest.agent>;
const clock=new Date('2026-09-01T03:00:00Z');
const input:LeaveInput={category:'EMERGENCY',subtype:'Uji cuti',reason:'Keperluan untuk pengujian PGS.',start:'2026-10-05',end:'2026-10-06',email:'bm@demo.bni.local',phone:'081234567899'};
const rule:ReplacementRule={position:'BM',enabled:true,sourcePositions:['BBO'],sameOutlet:true,otherOutlets:'NONE',outletIds:[]};
beforeEach(async()=>{
  db=await openDatabase('memory://');await seed(db,true,clock);await db.query('DELETE FROM requests');app=createApp(db,{demo:true,now:()=>clock});
  hr=(await employees(db)).find(e=>e.id==='sdm')!;
  const password=await hash('abc123',4);
  manager={id:'bm',name:'BM Uji',position:'BM',email:'bm@demo.bni.local',phone:input.phone,unit:hr.unit,outletId:hr.outletId,roles:['EMPLOYEE'],active:true};
  pgs={...manager,id:'bbo',name:'BBO Uji',position:'BBO',email:'bbo@demo.bni.local'};
  for(const person of [manager,pgs])await db.query('INSERT INTO employees(id,email,password_hash,data) VALUES($1,$2,$3,$4)',[person.id,person.email,password,person]);
  admin=supertest.agent(app);await admin.post('/api/login').set('X-Cuti-Client','web').send({email:'admin@demo.bni.local',password:'BniCuti!2026'}).expect(200);
});
afterEach(async()=>{await db.close();});
const post=(path:string,body:object)=>admin.post('/api/admin/'+path).set('X-Cuti-Client','web').set('Idempotency-Key',randomUUID()).send(body);
const remove=(path:string)=>admin.delete('/api/admin/'+path).set('X-Cuti-Client','web').set('Idempotency-Key',randomUUID());
async function leave(person=manager,extra:Partial<LeaveInput>={}){const body={...input,email:person.email,...extra};const p=await preview(db,person,body,clock);return submit(db,person,{...body,fingerprint:p.fingerprint,acceptAdjustment:true},randomUUID(),clock);}
async function configure(body=rule){await post('replacement-rules',body).expect(200);}

it('upgrades existing data to an outlet without inventing any replacement rules',async()=>{
  expect((await outlets(db,hr.unit))).toHaveLength(1);expect((await getPolicy(db,hr.unit)).replacementRules).toBeUndefined();
  expect((await employees(db)).every(e=>e.outletId)).toBe(true);await seed(db,true,clock);expect(await outlets(db,hr.unit)).toHaveLength(1);
  const r=await leave();const approved=await act(db,hr,r.id,'decision',{version:r.version,outcome:'APPROVED'},randomUUID(),clock);expect(approved.replacement).toBeUndefined();
});
it('checks eligible outlets and positions and requires availability without requiring assignment',async()=>{
  await configure();const r=await leave();let check=await replacementCheck(db,r,await getPolicy(db,hr.unit));
  expect(check.candidates.map(c=>c.id)).toContain(pgs.id);expect(check.candidates.every(c=>c.position==='BBO')).toBe(true);
  await db.query('UPDATE employees SET data=$1 WHERE id=$2',[{...pgs,active:false},pgs.id]);await db.query('UPDATE employees SET data=$1 WHERE id=$2',[{...hr,active:false},hr.id]);
  check=await replacementCheck(db,r,await getPolicy(db,hr.unit));expect(check.candidates).toEqual([]);
  await expect(act(db,hr,r.id,'decision',{version:r.version,outcome:'APPROVED'},randomUUID(),clock)).rejects.toThrow('Profil berubah');
  await db.query('UPDATE employees SET data=$1 WHERE id=$2',[hr,hr.id]);
  await post('replacement-rules',{...rule,sameOutlet:false,otherOutlets:'SELECTED',outletIds:['unknown']}).expect(422);
});
it('blocks own pending leave and checks availability again when approving',async()=>{
  await configure();const r=await leave();
  await leave(pgs);await leave(hr,{start:'2026-10-06',end:'2026-10-07'});
  const check=await replacementCheck(db,r,await getPolicy(db,hr.unit));expect(check.candidates.every(c=>!c.available)).toBe(true);
  await expect(act(db,hr,r.id,'decision',{version:r.version,outcome:'APPROVED'},randomUUID(),clock)).rejects.toMatchObject({code:'NO_REPLACEMENT'});
});
it('supports specific other outlets and rejects cross-unit or invalid candidates',async()=>{
  const location=(await post('outlets',{name:'Outlet Kedua'}).expect(200)).body;
  await db.query('UPDATE employees SET data=$1 WHERE id=$2',[{...pgs,outletId:location.id},pgs.id]);
  const r=await leave();await configure();expect((await replacementCheck(db,r,await getPolicy(db,hr.unit))).candidates.some(c=>c.id===pgs.id)).toBe(false);
  await configure({...rule,sameOutlet:false,otherOutlets:'SELECTED',outletIds:[location.id]});
  expect((await replacementCheck(db,r,await getPolicy(db,hr.unit))).candidates.map(c=>c.id)).toEqual([pgs.id]);
  await expect(act(db,hr,r.id,'decision',{version:r.version,outcome:'APPROVED',replacementId:'admin'},randomUUID(),clock)).rejects.toMatchObject({code:'REPLACEMENT_UNAVAILABLE'});
  const approved=await act(db,hr,r.id,'decision',{version:r.version,outcome:'APPROVED'},randomUUID(),clock);expect(approved.replacementCheckedAt).toBeDefined();expect(approved.replacement).toBeUndefined();
});
it('reserves optional PGS atomically, protects staffing changes and releases on approved cancellation',async()=>{
  await configure();await db.query('UPDATE employees SET data=$1 WHERE id=$2',[{...hr,position:'ARM'},hr.id]);hr={...hr,position:'ARM'};
  const manager2={...manager,id:'bm2',email:'bm2@demo.bni.local',name:'BM Uji Kedua'};
  await db.query('INSERT INTO employees(id,email,password_hash,data) VALUES($1,$2,$3,$4)',[manager2.id,manager2.email,'unused',manager2]);
  const first=await leave();const second=await leave(manager2,{start:'2026-10-06',end:'2026-10-07'});
  const decisions=await Promise.allSettled([first,second].map(r=>act(db,hr,r.id,'decision',{version:r.version,outcome:'APPROVED',replacementId:pgs.id},randomUUID(),clock)));
  expect(decisions.filter(r=>r.status==='fulfilled')).toHaveLength(1);
  const approved=(await requests(db)).find(r=>r.status==='APPROVED')!;expect(approved.replacement?.employeeName).toBe(pgs.name);
  expect(approved.replacement?.phone).toBe(pgs.phone);
  const pgsJob=(await db.query('SELECT id, kind FROM mail_jobs WHERE event_key=$1',[`${approved.id}:PGS_ASSIGNED`])).rows[0] as {id:string,kind:string}|undefined;
  expect(pgsJob?.kind).toBe('PGS_ASSIGNED');
  const employeePgs=supertest.agent(app);await employeePgs.post('/api/login').set('X-Cuti-Client','web').send({email:pgs.email,password:'abc123'}).expect(200);
  await employeePgs.get(`/api/leave-requests/${approved.id}`).expect(200);
  const notified=await act(db,hr,approved.id,'notify-pgs',{version:approved.version,channel:'WhatsApp'},randomUUID(),clock);
  expect(notified.replacement?.notifiedChannel).toBe('WhatsApp');
  expect(notified.events.some(e=>e.text.includes('SDM mengabarkan penugasan kepada PGS'))).toBe(true);
  expect((await preview(db,pgs,{...input,email:pgs.email},clock)).errors.some(e=>e.code==='PGS_DUTY')).toBe(true);
  await expect(leave(pgs)).rejects.toThrow('tugas PGS');
  await remove('employee/'+pgs.id).expect(409);
  await post('employee',{...pgs,active:false}).expect(409);
  const owner=approved.employeeId===manager.id?manager:manager2;
  const cancellation=await act(db,owner,approved.id,'cancel-request',{version:notified.version,reason:'Tidak jadi mengambil cuti.'},randomUUID(),clock);
  expect((await replacementCheck(db,first,await getPolicy(db,hr.unit))).candidates.find(c=>c.id===pgs.id)?.available).toBe(approved.id===first.id);
  await act(db,hr,approved.id,'cancel-review',{version:cancellation.version,outcome:'APPROVED'},randomUUID(),clock);
  const releasedJob=(await db.query('SELECT id, kind FROM mail_jobs WHERE event_key=$1',[`${approved.id}:PGS_RELEASED`])).rows[0] as {id:string,kind:string}|undefined;
  expect(releasedJob?.kind).toBe('PGS_RELEASED');
  expect((await replacementCheck(db,first,await getPolicy(db,hr.unit))).candidates.find(c=>c.id===pgs.id)?.available).toBe(true);
});
it('adds and removes custom positions and empty outlets with scoped admin access',async()=>{
  const employee=supertest.agent(app);await employee.post('/api/login').set('X-Cuti-Client','web').send({email:pgs.email,password:'abc123'}).expect(200);
  await employee.post('/api/admin/positions').set('X-Cuti-Client','web').send({code:'NEW',name:'Baru',quota:2}).expect(403);
  await post('positions',{code:'CUSTOM',name:'Posisi Tambahan',quota:3}).expect(200);
  const fresh=(await post('employee',{name:'Karyawan Custom',email:'custom@demo.bni.local',phone:input.phone,position:'CUSTOM',outletId:hr.outletId,roles:['EMPLOYEE'],active:true,password:'abc123'}).expect(200)).body as Employee;
  expect((await leave(fresh,{start:'2026-10-15',end:'2026-10-15'})).limit).toBe(3);
  await remove('positions/CUSTOM').expect(409);await remove('outlets/'+hr.outletId).expect(409);
  const empty=(await post('outlets',{name:'Outlet Kosong'}).expect(200)).body;await remove('outlets/'+empty.id).expect(200);expect((await outlets(db,hr.unit)).some(o=>o.id===empty.id)).toBe(false);
  await post('positions',{code:'EMPTY',name:'Posisi Kosong',quota:2}).expect(200);await remove('positions/EMPTY').expect(200);
  await employee.get('/api/leave-requests/unknown/replacements').expect(403);
  await post('replacement-rules',{...rule,sourcePositions:['MISSING']}).expect(422);
});
it('excludes candidates from another branch and rejects a stale employee outlet during submission',async()=>{
  const policy=await getPolicy(db,hr.unit);
  await db.query('INSERT INTO units(id,name,policy) VALUES($1,$2,$3)',['KC02','Cabang Lain',policy]);
  await db.query('INSERT INTO outlets(id,unit_id,data) VALUES($1,$2,$3)',['KC02-MAIN','KC02',{id:'KC02-MAIN',unit:'KC02',name:'Outlet Cabang Lain'}]);
  const foreign={...pgs,id:'foreign',email:'foreign@demo.bni.local',unit:'KC02',outletId:'KC02-MAIN'};
  await db.query('INSERT INTO employees(id,email,password_hash,data) VALUES($1,$2,$3,$4)',[foreign.id,foreign.email,'unused',foreign]);
  await configure({...rule,otherOutlets:'ALL'});const r=await leave();
  expect((await replacementCheck(db,r,await getPolicy(db,hr.unit))).candidates.map(c=>c.id)).not.toContain(foreign.id);
  await post('replacement-rules',{...rule,otherOutlets:'SELECTED',outletIds:['KC02-MAIN']}).expect(422);
  const second=(await post('outlets',{name:'Outlet Pindah'}).expect(200)).body;
  await db.query('UPDATE employees SET data=$1 WHERE id=$2',[{...pgs,outletId:second.id},pgs.id]);
  await expect(leave(pgs)).rejects.toThrow('Profil berubah');
});
