import {useEffect,useRef,type ReactNode} from 'react';
import {X} from 'lucide-react';

export function Modal({title,onClose,children,compact=false}:{title:string;onClose:()=>void;children:ReactNode;compact?:boolean}){
  const ref=useRef<HTMLDivElement>(null);const closeRef=useRef(onClose);closeRef.current=onClose;
  useEffect(()=>{const old=document.activeElement as HTMLElement;const before=document.body.style.overflow;document.body.style.overflow='hidden';ref.current?.querySelector<HTMLButtonElement>('button')?.focus();const handler=(e:KeyboardEvent)=>{if(e.key==='Escape')closeRef.current();if(e.key==='Tab'){const list=Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]')??[]);if(e.shiftKey&&document.activeElement===list[0]){e.preventDefault();list.at(-1)?.focus();}else if(!e.shiftKey&&document.activeElement===list.at(-1)){e.preventDefault();list[0]?.focus();}}};document.addEventListener('keydown',handler);return()=>{document.body.style.overflow=before;document.removeEventListener('keydown',handler);old?.focus();};},[]);
  return <div className="modal-backdrop"><div className={'modal'+(compact?' modal-compact':'')} ref={ref} role="dialog" aria-modal="true" aria-label={title}><div className="modal-header"><h2>{title}</h2><button className="icon-button" aria-label="Tutup dialog" onClick={onClose}><X size={21}/></button></div><div className="modal-body">{children}</div></div></div>;
}
