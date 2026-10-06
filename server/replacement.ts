import type {SQL} from './db';
import {ACTIVE,type Employee,type Leave,type Outlet,type Policy,type ReplacementCheck} from '../shared/domain';

export async function outlets(db:SQL,unit:string):Promise<Outlet[]>{
  return (await db.query("SELECT data FROM outlets WHERE unit_id=$1 AND data->>'deletedAt' IS NULL ORDER BY data->>'name'",[unit])).rows.map(r=>r.data);
}
export const defaultOutletId=(unit:string)=>unit+'-MAIN';
export const employeeOutlet=(employee:Employee)=>employee.outletId??defaultOutletId(employee.unit);
export const overlaps=(a:string[],b:string[])=>a.some(day=>b.includes(day));
export const assignedDuring=(leave:Leave,employeeId:string,today:string)=>leave.status==='APPROVED'&&leave.effectiveEnd>=today&&leave.replacement?.employeeId===employeeId;

export async function replacementCheck(db:SQL,leave:Leave,policy:Policy):Promise<ReplacementCheck>{
  const locations=await outlets(db,leave.unit);
  const staff:Employee[]=(await db.query("SELECT data FROM employees WHERE data->>'deletedAt' IS NULL AND data->>'unit'=$1",[leave.unit])).rows.map(r=>r.data);
  const all:Leave[]=(await db.query('SELECT data FROM requests WHERE unit_id=$1',[leave.unit])).rows.map(r=>r.data);
  const outletId=leave.outletId??employeeOutlet(staff.find(e=>e.id===leave.employeeId)??{unit:leave.unit} as Employee);
  const rule=policy.replacementRules?.[leave.position]??null;
  const candidates=rule?.enabled?staff.filter(e=>e.id!==leave.employeeId&&e.active&&e.roles.includes('EMPLOYEE')&&rule.sourcePositions.includes(e.position)).flatMap(e=>{
    const location=locations.find(o=>o.id===employeeOutlet(e));if(!location)return [];
    const same=location.id===outletId;
    if(same?!rule.sameOutlet:rule.otherOutlets==='NONE'||(rule.otherOutlets==='SELECTED'&&!rule.outletIds.includes(location.id)))return [];
    const ownLeave=all.some(r=>r.employeeId===e.id&&ACTIVE.includes(r.status)&&overlaps(r.days,leave.days));
    const assignment=all.some(r=>r.id!==leave.id&&r.status==='APPROVED'&&r.replacement?.employeeId===e.id&&overlaps(r.days,leave.days));
    return [{id:e.id,name:e.name,position:e.position,outletId:location.id,outletName:location.name,available:!ownLeave&&!assignment,reason:ownLeave?'Sedang cuti atau menunggu review':assignment?'Sudah bertugas sebagai PGS':'Tersedia selama seluruh tanggal cuti'}];
  }).sort((a,b)=>Number(b.available)-Number(a.available)||Number(b.outletId===outletId)-Number(a.outletId===outletId)||a.name.localeCompare(b.name)):[];
  return {rule,outletId,outletName:leave.outletName??locations.find(o=>o.id===outletId)?.name??'Outlet asal tidak tersedia',candidates};
}

export async function initializeDirectories(db:SQL){
  for(const row of (await db.query('SELECT id,name,policy FROM units ORDER BY id')).rows){
    const outlet:Outlet={id:defaultOutletId(row.id),unit:row.id,name:row.name.replace(/\s*[•·]\s*Demo$/,'')};
    await db.query('INSERT INTO outlets(id,unit_id,data) VALUES($1,$2,$3) ON CONFLICT(id) DO NOTHING',[outlet.id,row.id,outlet]);
    await db.query("UPDATE employees SET data=jsonb_set(data,'{outletId}',to_jsonb($1::text)) WHERE data->>'unit'=$2 AND data->>'outletId' IS NULL",[outlet.id,row.id]);
    await db.query("UPDATE requests SET data=jsonb_set(jsonb_set(data,'{outletId}',to_jsonb($1::text)),'{outletName}',to_jsonb($2::text)) WHERE unit_id=$3 AND data->>'outletId' IS NULL",[outlet.id,outlet.name,row.id]);
  }
}
