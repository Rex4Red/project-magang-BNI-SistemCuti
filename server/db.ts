import {PGlite} from '@electric-sql/pglite';
import pg from 'pg';
import {mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
export interface SQL { query(sql:string,params?:any[]):Promise<{rows:any[]}>; }
export interface Database extends SQL { transaction<T>(fn:(tx:SQL)=>Promise<T>):Promise<T>; close():Promise<void>; }
export async function openDatabase(location?:string):Promise<Database> {
  let database:Database;
  if(process.env.DATABASE_URL&&!location) {
    const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
    database={query:async(s,p)=>pool.query(s,p),transaction:async fn=>{const c=await pool.connect();try{await c.query('BEGIN');const result=await fn(c);await c.query('COMMIT');return result;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}},close:()=>pool.end()};
  } else {
    const path=location??resolve('.data/postgres');if(path!=='memory://')mkdirSync(dirname(path),{recursive:true});
    const db=new PGlite(path);
    database={query:(s,p)=>db.query(s,p),transaction:fn=>db.transaction(fn),close:()=>db.close()};
  }
  const schema=`CREATE TABLE IF NOT EXISTS units (id text PRIMARY KEY, name text NOT NULL, policy jsonb NOT NULL);
    CREATE TABLE IF NOT EXISTS employees (id text PRIMARY KEY, email text UNIQUE NOT NULL, password_hash text NOT NULL, data jsonb NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (token text PRIMARY KEY, employee_id text REFERENCES employees(id), expires_at timestamptz NOT NULL);
    CREATE TABLE IF NOT EXISTS requests (id text PRIMARY KEY, employee_id text REFERENCES employees(id), unit_id text REFERENCES units(id), position text NOT NULL, status text NOT NULL, month text NOT NULL, data jsonb NOT NULL);
    CREATE INDEX IF NOT EXISTS requests_scope ON requests(unit_id,month,position,status);
    CREATE TABLE IF NOT EXISTS operations (actor_id text, key text, hash text NOT NULL, result jsonb NOT NULL, PRIMARY KEY(actor_id,key));
    CREATE TABLE IF NOT EXISTS audit (id text PRIMARY KEY, unit_id text, actor_id text, action text, object_id text, at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE IF NOT EXISTS mail_jobs (id text PRIMARY KEY, event_key text UNIQUE NOT NULL, unit_id text, request_id text REFERENCES requests(id), kind text NOT NULL, due_at timestamptz NOT NULL, state text NOT NULL DEFAULT 'QUEUED', attempts integer NOT NULL DEFAULT 0, lease_until timestamptz, last_error text, created_at timestamptz DEFAULT now());
    CREATE TABLE IF NOT EXISTS mail_deliveries (id text PRIMARY KEY, job_id text REFERENCES mail_jobs(id), recipient text NOT NULL, state text NOT NULL, subject text NOT NULL, body text NOT NULL, UNIQUE(job_id,recipient));`;
  for(const statement of schema.split(';').filter(s=>s.trim()))await database.query(statement);
  return database;
}
