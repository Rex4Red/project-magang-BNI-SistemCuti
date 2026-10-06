import type {Express} from 'express';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import type {Database} from './db';
import {audit,employees,ensure,getPolicy,mutate,requests} from './service';
import {assignedDuring,employeeOutlet,outlets} from './replacement';
import {dateOnly,positionsFor,type Outlet,type ReplacementRule} from '../shared/domain';

export function directoryRoutes(app:Express,db:Database,now:()=>Date){
  app.post('/api/admin/outlets',async(req,res)=>{
    const body=z.object({id:z.string().optional(),name:z.string().trim().min(2).max(100)}).parse(req.body);
    res.json(await mutate(db,req.actor,req.get('idempotency-key')??'',{action:'outlet',...body},async tx=>{
      const all=await outlets(tx,req.actor.unit);if(body.id)ensure(all.some(o=>o.id===body.id),'Outlet tidak ditemukan.',404);
      ensure(!all.some(o=>o.id!==body.id&&o.name.toLowerCase()===body.name.toLowerCase()),'Nama outlet sudah digunakan.',409);
      const location:Outlet={id:body.id??randomUUID(),unit:req.actor.unit,name:body.name};
      await tx.query('INSERT INTO outlets(id,unit_id,data) VALUES($1,$2,$3) ON CONFLICT(id) DO UPDATE SET data=excluded.data',[location.id,location.unit,location]);
      await audit(tx,req.actor,'OUTLET_UPDATE',location.id);return location;
    }));
  });
  app.delete('/api/admin/outlets/:id',async(req,res)=>{
    res.json(await mutate(db,req.actor,req.get('idempotency-key')??'',{action:'deleteOutlet',id:req.params.id},async tx=>{
      const location=(await outlets(tx,req.actor.unit)).find(o=>o.id===req.params.id);ensure(location,'Outlet tidak ditemukan.',404);
      ensure(!(await employees(tx)).some(e=>e.unit===req.actor.unit&&employeeOutlet(e)===location!.id),'Pindahkan semua karyawan dari outlet ini sebelum menghapusnya.',409);
      const policy=await getPolicy(tx,req.actor.unit);
      ensure(!Object.values(policy.replacementRules??{}).some(r=>r.outletIds.includes(location!.id)),'Hapus outlet ini dari aturan PGS terlebih dahulu.',409);
      const all=await requests(tx,req.actor.unit);
      ensure(!all.some(r=>(r.outletId===location!.id&&(r.status==='PENDING_SDM'||r.status==='APPROVED'&&r.effectiveEnd>=dateOnly(now())))||(r.replacement?.outletId===location!.id&&assignedDuring(r,r.replacement.employeeId,dateOnly(now())))),'Outlet masih dipakai cuti atau tugas PGS aktif.',409);
      await tx.query('UPDATE outlets SET data=$1 WHERE id=$2',[{...location!,deletedAt:now().toISOString()},location!.id]);
      await audit(tx,req.actor,'OUTLET_DELETE',location!.id);return {ok:true};
    }));
  });
  app.post('/api/admin/positions',async(req,res)=>{
    const body=z.object({code:z.string().regex(/^[A-Z][A-Z0-9_]{1,39}$/),name:z.string().trim().min(2).max(60),quota:z.number().int().min(0).max(1000)}).parse(req.body);
    res.json(await mutate(db,req.actor,req.get('idempotency-key')??'',{action:'position',...body},async tx=>{
      const policy=await getPolicy(tx,req.actor.unit);const positions=Array.from(positionsFor(policy));
      ensure(!positions.some(p=>p[0]===body.code||p[1].toLowerCase()===body.name.toLowerCase()),'Kode atau nama posisi sudah digunakan.',409);
      policy.positions=[...positions,[body.code,body.name,body.quota]];
      await tx.query('UPDATE units SET policy=$1 WHERE id=$2',[policy,req.actor.unit]);await audit(tx,req.actor,'POSITION_ADD',body.code);return policy;
    }));
  });
  app.delete('/api/admin/positions/:code',async(req,res)=>{
    res.json(await mutate(db,req.actor,req.get('idempotency-key')??'',{action:'deletePosition',code:req.params.code},async tx=>{
      const code=req.params.code as string;const policy=await getPolicy(tx,req.actor.unit);
      ensure(positionsFor(policy).some(p=>p[0]===code),'Posisi tidak ditemukan.',404);
      ensure(!(await employees(tx)).some(e=>e.unit===req.actor.unit&&e.position===code),'Pindahkan semua karyawan dari posisi ini sebelum menghapusnya.',409);
      ensure(!Object.entries(policy.replacementRules??{}).some(([target,r])=>target!==code&&r.sourcePositions.includes(code)),'Hapus posisi ini dari calon PGS pada aturan lain terlebih dahulu.',409);
      ensure(!(await requests(tx,req.actor.unit)).some(r=>r.position===code&&(r.status==='PENDING_SDM'||r.status==='APPROVED'&&r.effectiveEnd>=dateOnly(now()))),'Posisi masih memiliki cuti aktif.',409);
      policy.positions=positionsFor(policy).filter(p=>p[0]!==code);delete policy.replacementRules?.[code];
      await tx.query('UPDATE units SET policy=$1 WHERE id=$2',[policy,req.actor.unit]);await audit(tx,req.actor,'POSITION_DELETE',code);return {ok:true};
    }));
  });
  app.post('/api/admin/replacement-rules',async(req,res)=>{
    const body=z.object({position:z.string(),enabled:z.boolean(),sourcePositions:z.array(z.string()).max(100),sameOutlet:z.boolean(),otherOutlets:z.enum(['NONE','ALL','SELECTED']),outletIds:z.array(z.string()).max(100)}).parse(req.body) as ReplacementRule;
    res.json(await mutate(db,req.actor,req.get('idempotency-key')??'',{action:'replacementRule',...body},async tx=>{
      const policy=await getPolicy(tx,req.actor.unit);const codes=positionsFor(policy).map(p=>p[0]);const locations=await outlets(tx,req.actor.unit);
      ensure(codes.includes(body.position)&&body.sourcePositions.every(p=>codes.includes(p)),'Posisi tidak tersedia.');
      ensure(body.outletIds.every(id=>locations.some(o=>o.id===id)),'Outlet tidak tersedia dalam cabang ini.');
      if(body.enabled){ensure(body.sourcePositions.length>0,'Pilih minimal satu posisi pengganti.');ensure(body.sameOutlet||body.otherOutlets!=='NONE','Pilih sumber outlet pengganti.');ensure(body.otherOutlets!=='SELECTED'||body.outletIds.length>0,'Pilih minimal satu outlet lain.');}
      policy.replacementRules={...policy.replacementRules,[body.position]:{...body,sourcePositions:[...new Set(body.sourcePositions)],outletIds:body.otherOutlets==='SELECTED'?[...new Set(body.outletIds)]:[]}};
      await tx.query('UPDATE units SET policy=$1 WHERE id=$2',[policy,req.actor.unit]);await audit(tx,req.actor,'REPLACEMENT_RULE_UPDATE',body.position);return policy;
    }));
  });
}
