import {compare,hash} from 'bcryptjs';
import {z} from 'zod';
import {PASSWORD_HINT,PASSWORD_PATTERN,type Employee} from '../shared/domain';
import type {Database} from './db';
import {audit,ensure} from './service';

const passwordChangeSchema=z.object({
  currentPassword:z.string().min(1).max(200),
  newPassword:z.string().max(72).regex(PASSWORD_PATTERN,PASSWORD_HINT).refine(value=>Buffer.byteLength(value,'utf8')<=72,'Kata sandi maksimal 72 byte.'),
  confirmPassword:z.string().max(72),
});

export async function changePassword(db:Database,actor:Employee,currentSession:string,body:unknown){
  const input=passwordChangeSchema.parse(body);
  ensure(input.newPassword===input.confirmPassword,'Konfirmasi kata sandi baru tidak sama.');
  ensure(input.currentPassword!==input.newPassword,'Kata sandi baru harus berbeda dari kata sandi saat ini.');
  return db.transaction(async tx=>{
    const row=(await tx.query('SELECT data,password_hash FROM employees WHERE id=$1 FOR UPDATE',[actor.id])).rows[0];
    ensure(row?.data.active,'Akun sudah tidak aktif. Silakan masuk kembali.',401);
    ensure(await compare(input.currentPassword,row.password_hash),'Kata sandi saat ini tidak sesuai.');
    await tx.query('UPDATE employees SET password_hash=$1 WHERE id=$2',[await hash(input.newPassword,12),actor.id]);
    await tx.query('DELETE FROM sessions WHERE employee_id=$1 AND token<>$2',[actor.id,currentSession]);
    await audit(tx,row.data,'PASSWORD_CHANGE',actor.id);
    return {ok:true};
  });
}
