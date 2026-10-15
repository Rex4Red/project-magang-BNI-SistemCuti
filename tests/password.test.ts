import {beforeAll,beforeEach,afterAll,it,expect} from 'vitest';
import supertest from 'supertest';
import {compare,hash} from 'bcryptjs';
import {createApp} from '../server/app';
import {openDatabase,type Database} from '../server/db';
import {seed} from '../server/service';

let db:Database;let app:ReturnType<typeof createApp>;let initialHash:string;
const password='BniCuti!2026';
beforeAll(async()=>{db=await openDatabase('memory://');await seed(db,true);initialHash=await hash(password,4);});
beforeEach(async()=>{
  await db.query('DELETE FROM sessions');await db.query('DELETE FROM audit');
  await db.query('UPDATE employees SET password_hash=$1',[initialHash]);
  app=createApp(db,{demo:true});
});
afterAll(async()=>{await db.close();});
async function login(account:string,currentPassword=password){
  const agent=supertest.agent(app);
  await agent.post('/api/login').set('X-Cuti-Client','web').send({email:account+'@demo.bni.local',password:currentPassword}).expect(200);
  return agent;
}
const update=(agent:ReturnType<typeof supertest.agent>,body:object)=>agent.post('/api/me/password').set('X-Cuti-Client','web').send(body);

it.each(['karyawan','sdm','admin'])('allows %s to change their password, keep the current session and revoke other sessions',async account=>{
  const current=await login(account);const other=await login(account);
  const profile=(await current.get('/api/me').expect(200)).body;
  await update(current,{currentPassword:password,newPassword:'cuti12',confirmPassword:'cuti12',employeeId:'staff0'}).expect(200,{ok:true});
  const row=(await db.query('SELECT password_hash,data FROM employees WHERE id=$1',[profile.id])).rows[0];
  expect(row.data).toEqual(profile);expect(row.password_hash).not.toBe('cuti12');expect(await compare('cuti12',row.password_hash)).toBe(true);
  expect((await db.query('SELECT password_hash FROM employees WHERE id=$1',['staff0'])).rows[0].password_hash).toBe(initialHash);
  await current.get('/api/me').expect(200);await other.get('/api/me').expect(401);
  await supertest(app).post('/api/login').set('X-Cuti-Client','web').send({email:profile.email,password}).expect(401);
  await login(account,'cuti12');
  const audit=(await db.query('SELECT * FROM audit')).rows;
  expect(audit).toHaveLength(1);expect(audit[0]).toMatchObject({action:'PASSWORD_CHANGE',actor_id:profile.id,object_id:profile.id});
  expect(JSON.stringify(audit)).not.toContain('cuti12');expect(JSON.stringify(audit)).not.toContain(password);
});

it('rejects unauthenticated requests, incorrect current passwords, invalid passwords and mismatched confirmation',async()=>{
  const valid={currentPassword:password,newPassword:'cuti12',confirmPassword:'cuti12'};
  await update(supertest.agent(app),valid).expect(401);
  const employee=await login('karyawan');
  await employee.post('/api/me/password').send(valid).expect(403);
  await employee.post('/api/me/password').set('X-Cuti-Client','web').set('Origin','https://evil.test').send(valid).expect(403);
  await update(employee,{...valid,currentPassword:'wrong123'}).expect(422);
  await update(employee,{...valid,confirmPassword:'other1'}).expect(422);
  for(const newPassword of ['abc12','abcdef','123456','abc123'+'a'.repeat(67)])await update(employee,{...valid,newPassword,confirmPassword:newPassword}).expect(422);
  await update(employee,{currentPassword:password,newPassword:password,confirmPassword:password}).expect(422);
  await employee.get('/api/me').expect(200);await login('karyawan');
  expect((await db.query('SELECT * FROM audit')).rows).toHaveLength(0);
});

it('only accepts one of two concurrent changes using the same current password',async()=>{
  const employee=await login('karyawan');
  const outcomes=await Promise.all(['cuti12','cuti34'].map(newPassword=>update(employee,{currentPassword:password,newPassword,confirmPassword:newPassword})));
  expect(outcomes.map(result=>result.status).sort()).toEqual([200,422]);
  const accepted=outcomes[0].status===200?'cuti12':'cuti34';
  await login('karyawan',accepted);await employee.get('/api/me').expect(200);
  expect((await db.query('SELECT * FROM audit')).rows).toHaveLength(1);
});

it('limits repeated password guessing without changing the stored password',async()=>{
  const employee=await login('karyawan');
  const body={currentPassword:'wrong123',newPassword:'cuti12',confirmPassword:'cuti12'};
  for(let i=0;i<10;i++)await update(employee,body).expect(422);
  await update(employee,body).expect(429);await employee.get('/api/me').expect(200);
  expect((await db.query('SELECT password_hash FROM employees WHERE id=$1',['employee'])).rows[0].password_hash).toBe(initialHash);
});
