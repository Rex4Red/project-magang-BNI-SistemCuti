import {randomUUID} from 'node:crypto';
import nodemailer from 'nodemailer';
import type {Database} from './db';
import {employees,requests} from './service';
export async function processMail(db:Database,now=new Date()) {
  const job=await db.transaction(async tx=>{
    const row=(await tx.query("SELECT * FROM mail_jobs WHERE (state='QUEUED' AND due_at <= $1) OR (state='PROCESSING' AND lease_until < $1) ORDER BY due_at LIMIT 1 FOR UPDATE SKIP LOCKED",[now.toISOString()])).rows[0];if(!row)return null;
    await tx.query("UPDATE mail_jobs SET state='PROCESSING',lease_until=$1 WHERE id=$2",[new Date(now.getTime()+120000).toISOString(),row.id]);return row;
  });if(!job)return false;
  try {
    const leave=(await requests(db,job.unit_id)).find(r=>r.id===job.request_id)!;
    if((job.kind==='REMINDER'&&(leave.status!=='PENDING_SDM'||leave.confirmation!=='NOT_CONFIRMED'))||(job.kind==='EMERGENCY'&&leave.status!=='PENDING_SDM')) {await db.query("UPDATE mail_jobs SET state='SKIPPED',lease_until=NULL WHERE id=$1",[job.id]);return true;}
    let recipients: string[] = [];
    if(job.kind==='PGS_ASSIGNED'||job.kind==='PGS_RELEASED'){
      const pgsStaff=(await employees(db)).find(e=>e.id===leave.replacement?.employeeId);
      recipients=pgsStaff?.email?[pgsStaff.email]:[];
      if(!recipients.length)throw new Error('NO_PGS_RECIPIENT');
    }else if(job.kind==='DECISION'){
      recipients=[leave.email];
    }else{
      recipients=(await employees(db)).filter(e=>e.unit===job.unit_id&&e.active&&e.roles.includes('SDM')).map(e=>e.email);
    }
    if(!recipients.length)throw new Error('NO_SDM_RECIPIENT');
    let subject='';
    let body='';
    if(job.kind==='PGS_ASSIGNED'){
      subject=`[Ruang Cuti] Penugasan PGS • ${leave.number} (${leave.employeeName})`;
      body=`Halo ${leave.replacement?.employeeName},\n\nAnda telah ditugaskan sebagai Pejabat Pengganti Sementara (PGS) untuk permohonan cuti berikut:\n\n• Pegawai Cuti: ${leave.employeeName} (${leave.position})\n• Nomor Cuti: ${leave.number}\n• Tanggal Efektif: ${leave.effectiveStart} s.d. ${leave.effectiveEnd} (${leave.duration} hari kerja)\n• Outlet Penugasan: ${leave.replacement?.outletName}\n\nSilakan masuk ke aplikasi Ruang Cuti untuk melihat detail penugasan:\n${process.env.APP_ORIGIN??'http://127.0.0.1:5173'}/?request=${leave.id}`;
    }else if(job.kind==='PGS_RELEASED'){
      subject=`[Ruang Cuti] Pembatalan Tugas PGS • ${leave.number} (${leave.employeeName})`;
      body=`Halo ${leave.replacement?.employeeName},\n\nTugas PGS Anda untuk pengajuan cuti ${leave.number} (${leave.employeeName}) pada tanggal ${leave.effectiveStart} s.d. ${leave.effectiveEnd} telah dibatalkan karena cuti ditarik/dibatalkan resmi.`;
    }else{
      const decisionText = leave.cancellation?.status === 'APPROVED' ? 'Pembatalan Disetujui' : leave.cancellation?.status === 'REJECTED' ? 'Pembatalan Ditolak' : leave.status === 'APPROVED' ? 'Disetujui' : leave.status === 'WITHDRAWN' ? 'Ditarik' : 'Ditolak';
      subject=`[Ruang Cuti] ${leave.number} • ${job.kind==='DECISION'?decisionText:'Perlu review SDM'}`;
      body=`Pengajuan ${leave.number}\nKaryawan: ${leave.employeeName}\nTanggal efektif: ${leave.effectiveStart} s.d. ${leave.effectiveEnd}\nSilakan masuk ke aplikasi untuk melihat status terkini dan detail:\n${process.env.APP_ORIGIN??'http://127.0.0.1:5173'}/?request=${leave.id}`;
    }
    for(const recipient of recipients){await db.query("INSERT INTO mail_deliveries(id,job_id,recipient,state,subject,body) VALUES($1,$2,$3,'QUEUED',$4,$5) ON CONFLICT(job_id,recipient) DO NOTHING",[randomUUID(),job.id,recipient,subject,body]);const d=(await db.query('SELECT * FROM mail_deliveries WHERE job_id=$1 AND recipient=$2',[job.id,recipient])).rows[0];if(['SENT','CAPTURED'].includes(d.state))continue;
      if(process.env.MAIL_MODE==='smtp'){
        if(!process.env.SMTP_HOST||!process.env.MAIL_FROM)throw new Error('SMTP_NOT_CONFIGURED');
        const transporter=nodemailer.createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT??587),secure:process.env.SMTP_PORT==='465',auth:process.env.SMTP_USER?{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS}:undefined,connectionTimeout:15000,socketTimeout:30000});
        await transporter.sendMail({from:process.env.MAIL_FROM,to:recipient,subject:d.subject,text:d.body,messageId:`<${d.id}@ruang-cuti.local>`});
      }
      await db.query('UPDATE mail_deliveries SET state=$1 WHERE id=$2',[process.env.MAIL_MODE==='smtp'?'SENT':'CAPTURED',d.id]);
    }
    await db.query('UPDATE mail_jobs SET state=$1,lease_until=NULL,last_error=NULL WHERE id=$2',[process.env.MAIL_MODE==='smtp'?'SENT':'CAPTURED',job.id]);
  }catch(e){const attempt=job.attempts+1;const minutes=[1,5,15,60,360][Math.min(attempt-1,4)];await db.query('UPDATE mail_jobs SET state=$1,attempts=$2,due_at=$3,last_error=$4,lease_until=NULL WHERE id=$5',[attempt>=5?'FAILED':'QUEUED',attempt,new Date(now.getTime()+minutes*60000).toISOString(),e instanceof Error&&['NO_SDM_RECIPIENT','NO_PGS_RECIPIENT','SMTP_NOT_CONFIGURED'].includes(e.message)?e.message:'DELIVERY_FAILED',job.id]);}
  return true;
}
