import {useState,type FormEvent} from 'react';
import {PASSWORD_HINT,PASSWORD_PATTERN} from '../shared/domain';
import {action} from './api';
import {Modal} from './Modal';

export function ChangePassword({onSuccess}:{onSuccess:()=>void}){
  const [open,setOpen]=useState(false);
  const [currentPassword,setCurrentPassword]=useState('');
  const [newPassword,setNewPassword]=useState('');
  const [confirmPassword,setConfirmPassword]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  function clear(){setCurrentPassword('');setNewPassword('');setConfirmPassword('');setError('');}
  function close(){if(busy)return;setOpen(false);clear();}
  async function submit(event:FormEvent){
    event.preventDefault();if(busy)return;setError('');
    if(newPassword!==confirmPassword){setError('Konfirmasi kata sandi baru tidak sama.');return;}
    setBusy(true);
    try{
      await action('/me/password',{currentPassword,newPassword,confirmPassword});
      setOpen(false);clear();onSuccess();
    }catch(e){setError((e as Error).message);}
    finally{setBusy(false);}
  }
  return <>
    <button type="button" className="button secondary" onClick={()=>setOpen(true)}>Ganti kata sandi</button>
    {open&&<Modal compact title="Ganti kata sandi" onClose={close}>
      <form onSubmit={submit}>
        {error&&<div className="alert danger" role="alert">{error}</div>}
        <label className="field"><span>Kata sandi saat ini</span><input type="password" autoComplete="current-password" required maxLength={200} disabled={busy} value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)}/></label>
        <label className="field"><span id="new-password-label">Kata sandi baru</span><input type="password" autoComplete="new-password" required minLength={6} maxLength={72} pattern={PASSWORD_PATTERN.source} title={PASSWORD_HINT} aria-labelledby="new-password-label" aria-describedby="new-password-hint" disabled={busy} value={newPassword} onChange={e=>setNewPassword(e.target.value)}/><small id="new-password-hint">{PASSWORD_HINT}</small></label>
        <label className="field"><span>Konfirmasi kata sandi baru</span><input type="password" autoComplete="new-password" required minLength={6} maxLength={72} disabled={busy} value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)}/></label>
        <div className="modal-actions"><button type="button" className="button secondary" disabled={busy} onClick={close}>Batal</button><button className="button primary" disabled={busy}>{busy?'Menyimpan…':'Simpan kata sandi'}</button></div>
      </form>
    </Modal>}
  </>;
}
