export const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*[0-9]).{6,200}$/;
export const PASSWORD_HINT = 'Minimal 6 karakter, kombinasi huruf dan angka. Simbol tidak wajib.';
export const POSITIONS = [
  ['CS_BINA','CS BINA',2],['TELLER','Teller',4],['CS_FTE','CS FTE',2],['BBO','BBO',2],['BM','BM',2],['BTRM','BTRM',3],
  ['ARM','ARM',2],['PRM','PRM',2],['BTN','BTN',2],['BMB','BMB',2],['BSM','BSM',2],['CBRS','CBRS',2],['CBRS_SPV','CBRS SPV',2],['CLEANING_STAFF','Cleaning Staff',2],
] as const;
export type Role = 'EMPLOYEE'|'SDM'|'ADMIN';
export type Status = 'DRAFT'|'PENDING_SDM'|'APPROVED'|'REJECTED'|'WITHDRAWN';
export type PositionDefinition = readonly [string,string,number];
export interface Employee { id:string; name:string; email:string; phone:string; position:string; unit:string; roles:Role[]; active:boolean; deletedAt?:string; outletId?:string; positionName?:string; }
export interface Outlet { id:string; unit:string; name:string; deletedAt?:string; }
export interface ReplacementRule { position:string; enabled:boolean; sourcePositions:string[]; sameOutlet:boolean; otherOutlets:'NONE'|'ALL'|'SELECTED'; outletIds:string[]; }
export interface ReplacementAssignment { employeeId:string; employeeName:string; position:string; outletId:string; outletName:string; assignedAt:string; assignedBy:string; }
export interface ReplacementCandidate { id:string; name:string; position:string; positionName?:string; outletId:string; outletName:string; available:boolean; reason:string; }
export interface ReplacementCheck { rule:ReplacementRule|null; outletId:string; outletName:string; candidates:ReplacementCandidate[]; }
export interface Calendar { version:number; weekdays:number[]; exceptions:Record<string, {working:boolean; label:string}>; }
export interface Policy { calendar:Calendar; quotas:Record<string,Record<string,number>>; replacementRules?:Record<string,ReplacementRule>; positions?:PositionDefinition[]; }
export const positionsFor=(policy:Policy):readonly PositionDefinition[]=>policy.positions??POSITIONS;
export interface LeaveInput { category:'REGULAR'|'EMERGENCY'; subtype:string; reason:string; start:string; end:string; email:string; phone:string; }
export interface LeaveCancellation { reason:string; requestedAt:string; status:'PENDING'|'APPROVED'|'REJECTED'; reviewedAt?:string; reviewedBy?:string; decisionReason?:string; }
export interface Leave extends LeaveInput { id:string; number:string; employeeId:string; employeeName:string; position:string; unit:string; status:Status; days:string[]; effectiveStart:string; effectiveEnd:string; duration:number; submittedAt:string; createdAt:string; confirmation:'NOT_CONFIRMED'|'CONFIRMED'|'DECLINED'; confirmationChannel?:string; decisionReason?:string; version:number; calendarVersion:number; limit:number; events:{at:string; text:string; actor:string}[]; cancellation?:LeaveCancellation; outletId?:string; outletName?:string; positionName?:string; replacement?:ReplacementAssignment; replacementCheckedAt?:string; }
export interface Quota { position:string; label:string; limit:number; used:number; approved:number; pending:number; available:number; alreadyCounted:boolean; }
export interface Preview { days:string[]; effectiveStart:string; effectiveEnd:string; duration:number; minimum:string; blocked:string[]; adjusted:boolean; errors:{code:string; message:string}[]; quota:Quota; fingerprint?:string; scheduledAt?:string; }
export const ACTIVE:Status[] = ['PENDING_SDM','APPROVED'];
export const HOLIDAYS_2027: Record<string, { working: boolean; label: string }> = {
  // Hari Libur Nasional 2027
  '2027-01-01': { working: false, label: 'Tahun Baru 2027 Masehi' },
  '2027-01-05': { working: false, label: 'Isra Miraj Nabi Muhammad SAW' },
  '2027-02-06': { working: false, label: 'Tahun Baru Imlek 2578 Kongzili' },
  '2027-03-08': { working: false, label: 'Hari Suci Nyepi (Tahun Baru Saka 1949)' },
  '2027-03-10': { working: false, label: 'Idul Fitri 1448 Hijriah' },
  '2027-03-11': { working: false, label: 'Idul Fitri 1448 Hijriah' },
  '2027-03-26': { working: false, label: 'Wafat Yesus Kristus' },
  '2027-03-28': { working: false, label: 'Hari Kebangkitan Yesus Kristus (Paskah)' },
  '2027-05-01': { working: false, label: 'Hari Buruh Internasional' },
  '2027-05-06': { working: false, label: 'Kenaikan Yesus Kristus' },
  '2027-05-17': { working: false, label: 'Idul Adha 1448 Hijriah' },
  '2027-05-20': { working: false, label: 'Hari Raya Waisak 2571 BE' },
  '2027-06-01': { working: false, label: 'Hari Lahir Pancasila' },
  '2027-06-06': { working: false, label: '1 Muharam Tahun Baru Islam 1449 Hijriah' },
  '2027-08-15': { working: false, label: 'Maulid Nabi Muhammad SAW' },
  '2027-08-17': { working: false, label: 'Proklamasi Kemerdekaan' },
  '2027-12-25': { working: false, label: 'Kelahiran Yesus Kristus (Natal)' },
  '2027-12-26': { working: false, label: 'Isra Miraj Nabi Muhammad SAW' },

  // Cuti Bersama 2027
  '2027-02-05': { working: false, label: 'Cuti Bersama Tahun Baru Imlek 2578 Kongzili' },
  '2027-03-09': { working: false, label: 'Cuti Bersama Hari Raya Idul Fitri 1448 Hijriah' },
  '2027-03-12': { working: false, label: 'Cuti Bersama Hari Raya Idul Fitri 1448 Hijriah' },
  '2027-03-15': { working: false, label: 'Cuti Bersama Hari Raya Idul Fitri 1448 Hijriah' },
  '2027-03-25': { working: false, label: 'Cuti Bersama Wafat Yesus Kristus' },
  '2027-05-18': { working: false, label: 'Cuti Bersama Idul Adha 1448 H' },
  '2027-05-19': { working: false, label: 'Cuti Bersama Waisak 2571 BE' },
  '2027-12-24': { working: false, label: 'Cuti Bersama Kelahiran Yesus Kristus (Natal)' },
};
export const DEFAULT_CALENDAR:Calendar = {version:1, weekdays:[1,2,3,4,5], exceptions:{...HOLIDAYS_2027}};
export const statusLabel:Record<Status,string> = {DRAFT:'Draft',PENDING_SDM:'Menunggu review',APPROVED:'Disetujui',REJECTED:'Ditolak',WITHDRAWN:'Ditarik'};
export const positionLabel = (code:string) => POSITIONS.find(p=>p[0]===code)?.[1] ?? code;
export const dateOnly = (now:Date = new Date()) => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
export const date = (s:string) => new Date(s+'T00:00:00Z');
export const iso = (d:Date) => d.toISOString().slice(0,10);
export const validDate = (s:string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(date(s).getTime()) && iso(date(s))===s && s>='2020-01-01' && s<='2100-12-31';
export function addMonths(s:string,n:number) { const d=date(s); const day=d.getUTCDate(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth()+n); const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate(); d.setUTCDate(Math.min(day,last)); return iso(d); }
export const addDays = (s:string,n:number) => {const d=date(s); d.setUTCDate(d.getUTCDate()+n); return iso(d);};
export const isWorking = (s:string,c:Calendar) => c.exceptions[s]?.working ?? c.weekdays.includes(date(s).getUTCDay());
export function monthDays(month:string) { const count=new Date(Date.UTC(+month.slice(0,4),+month.slice(5,7),0)).getUTCDate(); return Array.from({length:count},(_,i)=>`${month}-${String(i+1).padStart(2,'0')}`); }
export const blockedDays = (month:string,c:Calendar) => monthDays(month).filter(d=>isWorking(d,c)).slice(-3);
export function getValidEndDates(start:string,c?:Calendar,maxWorkingDays=5):string[] {
  if(!validDate(start)) return [];
  const calendar=c?.weekdays?c:DEFAULT_CALENDAR;
  const month=start.slice(0,7);
  const cutoff=blockedDays(month,calendar)[0];
  const days=monthDays(month);
  const workDays=days.filter(d=>d>=start&&(!cutoff||d<cutoff)&&isWorking(d,calendar));
  return workDays.slice(0,maxWorkingDays);
}
export function calculateMaxEndDate(start:string,c?:Calendar,maxWorkingDays=5):string {
  const dates=getValidEndDates(start,c,maxWorkingDays);
  if(dates.length===0) return validDate(start)?start:'';
  return dates[dates.length-1];
}
export function quotaFor(position:string,month:string,requests:Leave[],limit:number,employeeId=''):Quota {
  const relevant=requests.filter(r=>r.position===position && r.effectiveStart.slice(0,7)===month && ACTIVE.includes(r.status));
  const approved=new Set(relevant.filter(r=>r.status==='APPROVED').map(r=>r.employeeId));
  const all=new Set(relevant.map(r=>r.employeeId));
  return {position,label:positionLabel(position),limit,used:all.size,approved:approved.size,pending:all.size-approved.size,available:Math.max(0,limit-all.size),alreadyCounted:all.has(employeeId)};
}
export function limitFor(position:string,month:string,policy:Policy,requests:Leave[]) {
  const frozen=requests.find(r=>r.position===position && r.effectiveStart.slice(0,7)===month && r.status!=='DRAFT');
  if(frozen) return frozen.limit;
  const effective=Object.keys(policy.quotas).filter(m=>m<=month).sort().at(-1);
  return (effective ? policy.quotas[effective]?.[position] : undefined) ?? positionsFor(policy).find(p=>p[0]===position)?.[2] ?? 2;
}
export function evaluate(input:LeaveInput,employee:Employee,requests:Leave[],calendar:Calendar,limit:number,today:string):Preview {
  const errors:Preview['errors']=[];
  const fail=(code:string,message:string)=>errors.push({code,message});
  const minimum=input.category==='REGULAR'?addMonths(today,1):today;
  const result:Preview={days:[],effectiveStart:'',effectiveEnd:'',duration:0,minimum,blocked:[],adjusted:false,errors,quota:quotaFor(employee.position,input.start.slice(0,7),requests.filter(r=>r.unit===employee.unit),limit,employee.id)};
  if(!validDate(input.start)||!validDate(input.end)||input.end<input.start) {fail('INVALID_RANGE','Pilih rentang tanggal yang valid.');return result;}
  if(input.end>addMonths(input.start,3)) {fail('RANGE_TOO_LONG','Pilih rentang paling panjang tiga bulan.');return result;}
  if(input.start<minimum) fail('NOTICE_PERIOD',`Tanggal mulai paling awal ${minimum}.`);
  result.blocked=blockedDays(input.start.slice(0,7),calendar);
  const cutoff=result.blocked[0];
  if(!cutoff) {fail('NO_WORKDAYS','Kalender bulan ini tidak memiliki hari kerja.');return result;}
  if(!isWorking(input.start,calendar)) fail('NON_WORKING_DAY','Tanggal mulai harus merupakan hari kerja.');
  if(input.start>=cutoff) fail('MONTH_END_BLOCKED','Tiga hari kerja terakhir bulan tidak dapat digunakan untuk cuti.');
  result.days=monthDays(input.start.slice(0,7)).filter(d=>d>=input.start&&d<=input.end&&d<cutoff&&isWorking(d,calendar));
  result.duration=result.days.length; result.effectiveStart=result.days[0]??''; result.effectiveEnd=result.days.at(-1)??'';
  result.adjusted=!!result.effectiveEnd&&result.effectiveEnd!==input.end;
  if(result.duration===0) fail('NO_DAYS','Tidak ada hari kerja yang dapat diajukan.');
  if(result.duration>5) fail('DURATION_LIMIT','Maksimal 5 hari kerja per pengajuan.');
  if(!result.quota.alreadyCounted&&result.quota.available<1) fail('QUOTA_EXCEEDED','Kuota orang pada posisi Anda untuk bulan ini sudah penuh.');
  for(const r of requests.filter(r=>ACTIVE.includes(r.status))) {
    const overlap=result.days.filter(d=>r.days.includes(d)).length;
    if(r.employeeId===employee.id&&overlap) fail('OWN_CONFLICT','Tanggal bertabrakan dengan pengajuan aktif Anda.');
    else if(r.unit===employee.unit&&r.position===employee.position) {
      if(result.days.length&&result.days.join(',')===r.days.join(',')) fail('IDENTICAL_RANGE','Rentang efektif yang sama sudah diajukan pada posisi Anda.');
      else if(overlap>2) fail('OVERLAP_LIMIT',`Irisan ${overlap} hari kerja melebihi batas 2 hari.`);
    }
  }
  for(const day of result.days) {
    const people=new Set(requests.filter(r=>r.unit===employee.unit&&r.position===employee.position&&ACTIVE.includes(r.status)&&r.days.includes(day)).map(r=>r.employeeId)); people.add(employee.id);
    if(people.size>limit) {fail('CONCURRENT_PEOPLE_LIMIT','Jumlah orang yang cuti bersamaan melebihi kuota posisi.');break;}
  }
  result.errors=errors.filter((e,i,a)=>a.findIndex(x=>x.code===e.code)===i);
  return result;
}
export function reminderAt(start:string,category:string,now:Date) { if(category==='EMERGENCY') return now.toISOString(); const due=new Date(addMonths(start,-1)+'T08:00:00+07:00'); return new Date(Math.max(due.getTime(),now.getTime())).toISOString(); }
