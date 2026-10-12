import {useEffect,useRef,useState} from 'react';
import type {Leave} from '../shared/domain';
import {Modal} from './Modal';
import {useDirectory} from './DirectoryContext';

const formatDate=(value:string)=>new Intl.DateTimeFormat('id-ID',{day:'numeric',month:'short',year:'numeric'}).format(new Date(value+'T00:00:00'));

export function NewLeavePopup({requests,userId,visible,onSelect}:{requests:Leave[];userId:string;visible:boolean;onSelect:(leave:Leave)=>void}){
  const storageKey='bni_cuti_popup_seen:'+userId;
  const known=useRef<Set<string>|null>(null);
  const [queued,setQueued]=useState<string[]>([]);
  const {positionLabel}=useDirectory();
  useEffect(()=>{
    const pending=requests.filter(r=>r.status==='PENDING_SDM'&&r.employeeId!==userId);
    if(!known.current){
      let saved:unknown=[];try{saved=JSON.parse(sessionStorage.getItem(storageKey)??'[]');}catch{}
      known.current=new Set(Array.isArray(saved)?saved.filter((id):id is string=>typeof id==='string'):[]);
    }
    const incoming=pending.filter(r=>!known.current!.has(r.id));
    for(const request of pending)known.current.add(request.id);
    try{sessionStorage.setItem(storageKey,JSON.stringify([...known.current]));}catch{}
    const active=new Set(pending.map(r=>r.id));
    setQueued(previous=>[...previous.filter(id=>active.has(id)),...incoming.map(r=>r.id)]);
  },[requests,userId,storageKey]);
  const leaves=queued.map(id=>requests.find(r=>r.id===id&&r.status==='PENDING_SDM')).filter((r):r is Leave=>!!r);
  if(!visible||!leaves.length)return null;
  return <Modal compact title="Pengajuan menunggu review" onClose={()=>setQueued([])}>
    <p className="new-leave-summary" role="status">{leaves.length===1?'Ada pengajuan yang perlu ditinjau.':`${leaves.length} pengajuan perlu ditinjau.`}</p>
    <ul className="new-leave-list">{leaves.map(leave=><li key={leave.id}>
      <div><strong>{leave.employeeName}</strong><span>{leave.positionName??positionLabel(leave.position)} · {leave.category==='REGULAR'?'Reguler':'Darurat'}</span><span>{formatDate(leave.effectiveStart)} – {formatDate(leave.effectiveEnd)}</span></div>
      <button className="button secondary" aria-label={'Lihat pengajuan '+leave.number} onClick={()=>{setQueued(ids=>ids.filter(id=>id!==leave.id));onSelect(leave);}}>Lihat pengajuan</button>
    </li>)}</ul>
    <div className="modal-actions"><button className="button primary" onClick={()=>setQueued([])}>Tutup</button></div>
  </Modal>;
}
