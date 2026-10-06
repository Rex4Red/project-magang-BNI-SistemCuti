import {useEffect,useRef,useState,type FormEvent,type ReactNode} from 'react';
import {ArrowDownToLine,ArrowRight,ArrowUpRight,Bell,CalendarDays,Check,CheckCheck,ChevronLeft,ChevronRight,Clock3,FileText,Home,Info,LayoutGrid,LogOut,Menu,Plus,Search,Settings2,ShieldCheck,Users,X,Mail,Send,BriefcaseBusiness,CheckCircle2,AlertCircle,SlidersHorizontal,Leaf,Save,Phone,MessageCircle,RotateCcw,XCircle,UserCheck} from 'lucide-react';
import {ACTIVE,PASSWORD_PATTERN,PASSWORD_HINT,POSITIONS,addMonths,dateOnly,isWorking,monthDays,positionLabel,statusLabel,calculateMaxEndDate,getValidEndDates,blockedDays,type Employee,type Leave,type LeaveInput,type Preview,type Quota} from '../shared/domain';
import {api,action,ApiError} from './api';
import {DirectoryContext,useDirectory} from './DirectoryContext';
import {ReplacementAdmin} from './ReplacementAdmin';
import {ReplacementPanel} from './ReplacementPanel';
import {Modal} from './Modal';
import type {ReplacementCheck} from '../shared/domain';
const fmt=(d:string,full=false)=>d?new Intl.DateTimeFormat('id-ID',{day:'numeric',month:full?'long':'short',...(full?{year:'numeric'}:{})}).format(new Date(d+'T00:00:00')):'—';
const monthLabel=(m:string)=>new Intl.DateTimeFormat('id-ID',{month:'long',year:'numeric'}).format(new Date(m+'-01T00:00:00'));
const initials=(name:string)=>name.split(' ').slice(0,2).map(n=>n[0]).join('');
const Badge=({status,cancellation}:{status:Leave['status'];cancellation?:Leave['cancellation']})=>{
  if(status==='APPROVED'&&cancellation?.status==='PENDING')return <span className="badge pending_sdm"><span/>Menunggu batal SDM</span>;
  if(status==='WITHDRAWN'&&cancellation?.status==='APPROVED')return <span className="badge withdrawn"><span/>Dibatalkan</span>;
  return <span className={'badge '+status.toLowerCase()}><span/>{statusLabel[status]}</span>;
};
const Empty=({title='Belum ada pengajuan',text=''}:{title?:string;text?:string})=><div className="empty"><FileText size={30}/><h3>{title}</h3>{text&&<p>{text}</p>}</div>;
const Field=({label,children,hint}:{label:string;children:ReactNode;hint?:string})=><label className="field"><span>{label}</span>{children}{hint&&<small>{hint}</small>}</label>;
type Page='dashboard'|'requests'|'calendar'|'form'|'profile'|'admin'|'notifications';
const VALID_PAGES:Page[]=['dashboard','requests','calendar','form','profile','admin','notifications'];
function getInitialPage():Page{
  try{
    const hash=window.location.hash.replace(/^#\/?/,'').split('?')[0] as Page;
    if(VALID_PAGES.includes(hash))return hash;
    const searchTab=new URLSearchParams(window.location.search).get('tab') as Page;
    if(VALID_PAGES.includes(searchTab))return searchTab;
    const stored=sessionStorage.getItem('bni_cuti_page') as Page;
    if(VALID_PAGES.includes(stored))return stored;
  }catch{}
  return 'dashboard';
}
function getInitialMonth():string{
  try{
    const saved=sessionStorage.getItem('bni_cuti_month');
    if(saved&&/^\d{4}-\d{2}$/.test(saved))return saved;
  }catch{}
  return addMonths(dateOnly().slice(0,7)+'-01',1).slice(0,7);
}
export default function App(){
  const [config,setConfig]=useState<any>(null);const [user,setUser]=useState<Employee|null>(null);const [boot,setBoot]=useState(true);const [page,setPage]=useState<Page>(getInitialPage);
  const [requestMonth,setRequestMonth]=useState('');const [month,setMonth]=useState(getInitialMonth);const [data,setData]=useState<any>(null);const [refresh,setRefresh]=useState(0);const [error,setError]=useState('');const [toast,setToast]=useState('');const [selected,setSelected]=useState<Leave|null>(null);const [draft,setDraft]=useState<Leave|null>(null);const [menu,setMenu]=useState(false);const [loading,setLoading]=useState(false);
  const sdm=user?.roles.includes('SDM');const admin=user?.roles.includes('ADMIN');
  useEffect(()=>{Promise.all([api('/config').then(setConfig),api<Employee>('/me').then(setUser).catch(()=>{})]).finally(()=>setBoot(false));},[]);
  useEffect(()=>{
    if(!user)return;let alive=true;let fetching=false;
    async function load(background=false){
      if(fetching||!alive)return;fetching=true;if(!background)setLoading(true);
      try{const latest=await api('/dashboard?month='+month);if(alive){setData(latest);setError('');}}
      catch(e){if(alive){const failure=e as ApiError;if(failure.status===401){setUser(null);setData(null);setSelected(null);}else if(!background)setError(failure.message);}}
      finally{fetching=false;if(alive&&!background)setLoading(false);}
    }
    const updateVisible=()=>{if(document.visibilityState==='visible')void load(true);};
    void load();const timer=setInterval(updateVisible,5000);
    window.addEventListener('focus',updateVisible);document.addEventListener('visibilitychange',updateVisible);
    return()=>{alive=false;clearInterval(timer);window.removeEventListener('focus',updateVisible);document.removeEventListener('visibilitychange',updateVisible);};
  },[user,month,refresh,page]);
  useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(''),4500);return()=>clearTimeout(t);},[toast]);
  useEffect(()=>{if(!user)return;const id=new URLSearchParams(location.search).get('request');if(id)api<Leave>('/leave-requests/'+id).then(setSelected).catch(e=>setError(e.message));},[user]);
  useEffect(()=>{if(month){try{sessionStorage.setItem('bni_cuti_month',month);}catch{}}},[month]);
  useEffect(()=>{
    const onHashChange=()=>{
      const hash=window.location.hash.replace(/^#\/?/,'').split('?')[0] as Page;
      if(VALID_PAGES.includes(hash)){setPage(hash);try{sessionStorage.setItem('bni_cuti_page',hash);}catch{}}
      else if(!hash){setPage('dashboard');try{sessionStorage.setItem('bni_cuti_page','dashboard');}catch{}}
    };
    window.addEventListener('hashchange',onHashChange);
    return()=>window.removeEventListener('hashchange',onHashChange);
  },[]);
  useEffect(()=>{
    if(!user)return;
    const a=user.roles.includes('ADMIN');
    if(page==='admin'&&!a)nav('dashboard');
    else if(page==='form'&&a)nav('dashboard');
  },[user]);
  const reload=()=>setRefresh(n=>n+1);
  const nav=(p:Page)=>{
    if(p==='requests'&&page!=='requests')setRequestMonth('');
    setPage(p);
    setMenu(false);
    setError('');
    try{
      sessionStorage.setItem('bni_cuti_page',p);
      const targetHash=p==='dashboard'?'':'#'+p;
      if(window.location.hash!==targetHash){
        history.replaceState(null,'',window.location.pathname+window.location.search+targetHash);
      }
    }catch{}
  };
  const newLeave=()=>{setDraft(null);nav('form');};
  if(boot)return <div className="boot"><span className="bni-logo"><img src="/images/bni-logo.png" alt="BNI" /></span><p>Menyiapkan ruang kerja Anda…</p></div>;
  if(!user)return <Login config={config} onLogin={u=>{
    setData(null);
    setSelected(null);
    setUser(u);
    const target=getInitialPage();
    const targetPage=(target==='admin'&&!u.roles.includes('ADMIN'))?'dashboard':target;
    setPage(targetPage);
    try{
      sessionStorage.setItem('bni_cuti_page',targetPage);
      const hash=targetPage==='dashboard'?'':'#'+targetPage;
      history.replaceState(null,'',window.location.pathname+window.location.search+hash);
    }catch{}
  }}/>;
  const positionLabel=(code:string)=>(data?.positions??POSITIONS).find((p:readonly [string,string,number])=>p[0]===code)?.[1]??code;
  const pageTitles:Record<Page,string>={dashboard:'Ringkasan',requests:sdm?'Pengajuan cuti':'Pengajuan saya',calendar:'Kalender cuti',form:'Ajukan cuti',profile:'Profil saya',admin:'Administrasi',notifications:'Pusat notifikasi'};
  const navItems:[Page,typeof Home,string][]=[['dashboard',LayoutGrid,'Ringkasan'],['requests',FileText,sdm?'Pengajuan cuti':'Pengajuan saya'],['calendar',CalendarDays,'Kalender cuti']];
  const pending=data?.requests.filter((r:Leave)=>r.status==='PENDING_SDM'||(sdm&&r.status==='APPROVED'&&r.cancellation?.status==='PENDING')).length??0;
  return <DirectoryContext.Provider value={data?.positions??POSITIONS}><div className="app-shell">
    {menu&&<div className="menu-scrim" onClick={()=>setMenu(false)}/>}
    <aside className={'sidebar '+(menu?'open':'')}><div className="brand"><span className="bni-logo"><img src="/images/bni-logo.png" alt="BNI" /></span></div>
      <div className="workspace"><div className="workspace-icon"><BriefcaseBusiness size={19}/></div><div><strong>{sdm?'Ruang kerja SDM':admin?'Administrator':'Ruang karyawan'}</strong><small>{data?.unitName??'Kantor Cabang'}</small></div></div>
      <nav>{navItems.map(([id,Icon,label])=><button key={id} className={page===id?'active':''} onClick={()=>nav(id)}><Icon size={19}/><span>{label}</span>{id==='requests'&&pending>0&&<b className="nav-count">{pending}</b>}</button>)}{!admin&&<button className={page==='form'?'active':''} onClick={newLeave}><Plus size={19}/><span>Ajukan cuti</span></button>}{admin&&<button className={page==='admin'?'active':''} onClick={()=>nav('admin')}><Settings2 size={19}/><span>Administrasi</span></button>}</nav>
      <div className="sidebar-bottom"><button className="user-card" onClick={()=>nav('profile')}><span className="avatar teal">{initials(user.name)}</span><span><strong>{user.name}</strong><small>{sdm?'Divisi Sumber Daya Manusia':positionLabel(user.position)}</small></span><ChevronRight size={16}/></button></div>
    </aside>
    <div className="main-shell"><header className="topbar"><button className="icon-button mobile-menu" aria-label="Buka menu" onClick={()=>setMenu(true)}><Menu/></button><div className="breadcrumb"><strong>{pageTitles[page]}</strong></div><div className="top-actions">{config?.demo&&<span className="demo-pill">Lingkungan demo</span>}<span className="today">{fmt(data?.today??config?.today??dateOnly(),true)}</span><button className="icon-button notification-button" aria-label="Notifikasi" onClick={()=>nav(admin?'admin':'notifications')}><Bell size={20}/>{pending>0&&<i/>}</button><button className="avatar small teal" aria-label="Profil saya" onClick={()=>nav('profile')}>{initials(user.name)}</button></div></header>
      <main><div className="page-heading"><div><h1>{pageTitles[page]}</h1></div>{['dashboard','requests','calendar'].includes(page)&&<div className="heading-actions"><label className="month-control"><CalendarDays size={17}/><input aria-label="Bulan monitoring" type="month" value={month} onChange={e=>{if(e.target.value)setMonth(e.target.value);}}/></label>{page==='requests'&&<label className="month-control"><CalendarDays size={17}/><select aria-label="Filter bulan pengajuan" value={requestMonth} onChange={e=>setRequestMonth(e.target.value)}><option value="">Semua bulan</option>{Array.from(new Set<string>((data?.requests??[]).map((r:Leave)=>(r.effectiveStart||r.start).slice(0,7)).filter((m:string)=>/^\d{4}-\d{2}$/.test(m)))).sort().reverse().map(m=><option key={m} value={m}>{monthLabel(m)}</option>)}</select></label>}{sdm?<a className="button secondary" href={'/api/reports.xlsx?month='+(page==='requests'?(requestMonth||'all'):month)}><ArrowDownToLine size={17}/>Unduh laporan</a>:!admin&&<button className="button primary" onClick={newLeave}><Plus size={18}/>Ajukan cuti</button>}</div>}</div>
      {error&&<div className="alert danger" role="alert">{error}<button onClick={reload}>Coba lagi</button></div>}
      {loading&&!data?<div className="skeleton-grid"><div/><div/><div/></div>:data&&<>
        {page==='dashboard'&&<Dashboard data={data} month={month} sdm={!!sdm} name={user.name} onSelect={setSelected} onRequests={()=>nav('requests')} onCalendar={()=>nav('calendar')} onNew={newLeave} admin={!!admin}/>}
        {page==='requests'&&<RequestList requests={data.requests} month={requestMonth} sdm={!!sdm} onSelect={setSelected} onDraft={(r:Leave)=>{setDraft(r);nav('form');}}/>}
        {page==='calendar'&&<CalendarView data={data} month={month} setMonth={setMonth} onSelect={(id:string)=>api<Leave>('/leave-requests/'+id).then(setSelected).catch(e=>setError(e.message))}/>}
        {page==='form'&&<LeaveForm key={draft?.id??'new'} user={user} today={data.today} draft={draft} calendar={data.calendarConfig} onDelete={()=>{reload();nav('requests');setToast('Draft dihapus.');}} onDone={r=>{if(r.effectiveStart)setMonth(r.effectiveStart.slice(0,7));reload();setSelected(r.status==='DRAFT'?null:r);nav('requests');setToast(r.status==='DRAFT'?'Draft tersimpan.':'Pengajuan berhasil dikirim ke SDM.');}}/>}
        {page==='profile'&&<section className="panel profile-panel"><span className="avatar large teal">{initials(user.name)}</span><h2>{user.name}</h2><p>{positionLabel(user.position)} • {data.unitName}</p><dl><dt>Email</dt><dd>{user.email}</dd><dt>Nomor HP</dt><dd>{user.phone}</dd><dt>Hak akses</dt><dd>{user.roles.join(', ')}</dd></dl><div className="alert info"><Info size={18}/>Perubahan kontak pada pengajuan tidak mengubah profil ini. Hubungi administrator untuk memperbarui profil.</div><button className="button secondary" onClick={async()=>{await action('/logout',{});setUser(null);setData(null);setPage('dashboard');try{sessionStorage.removeItem('bni_cuti_page');history.replaceState(null,'',window.location.pathname+window.location.search);}catch{}}}><LogOut size={17}/>Keluar dari akun</button></section>}
        {page==='notifications'&&<section className="panel"><div className="panel-heading"><h2>Aktivitas pengajuan</h2><span className="muted">Status terbaru</span></div>{data.requests.length?data.requests.filter((r:Leave)=>r.status!=='DRAFT').slice(0,15).map((r:Leave)=><button className="activity-row" key={r.id} onClick={()=>setSelected(r)}><span className="activity-icon"><Bell size={18}/></span><span><strong>{r.employeeName} • {r.number}</strong><small>{r.events.at(-1)?.text} · {fmt(r.effectiveStart)}</small></span><Badge status={r.status} cancellation={r.cancellation}/></button>):<Empty title="Belum ada aktivitas"/>}</section>}
        {page==='admin'&&admin&&<Admin onChange={reload} onToast={setToast} today={data.today} userId={user.id}/>}
      </>}

      </main>
    </div>
    {toast&&<div className="toast" role="status"><CheckCircle2 size={19}/>{toast}</div>}
    {selected&&<Detail leave={selected} user={user} today={data?.today??dateOnly()} onClose={()=>setSelected(null)} onCopy={()=>{setDraft({...selected,id:'',status:'DRAFT',version:0});setSelected(null);nav('form');}} onUpdate={r=>{setSelected(r);reload();setToast('Pengajuan berhasil diperbarui.');}}/>}
  </div></DirectoryContext.Provider>;
}
function Login({config,onLogin}:{config:any;onLogin:(u:Employee)=>void}){
  const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  async function login(e:FormEvent){e.preventDefault();setBusy(true);setError('');try{onLogin(await action('/login',{email,password}));}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <div className="login"><div className="login-main"><div className="login-box"><span className="bni-logo"><img src="/images/bni-logo.png" alt="BNI" /></span><h2>Ruang Cuti</h2><form onSubmit={login}><Field label="Email karyawan"><input type="email" autoComplete="username" placeholder="nama@perusahaan.co.id" value={email} onChange={e=>setEmail(e.target.value)} required/></Field><Field label="Kata sandi"><input type="password" autoComplete="current-password" placeholder="Masukkan kata sandi" value={password} onChange={e=>setPassword(e.target.value)} required/></Field>{error&&<div className="alert danger" role="alert">{error}</div>}<button className="button primary full" disabled={busy}>{busy?'Memeriksa akun…':'Masuk'}<ArrowRight size={18}/></button></form>{config?.demo&&<div className="demo-accounts"><span>AKUN DEMO</span><div>{[['SDM','sdm'],['Karyawan','karyawan'],['Admin','admin']].map(([label,account])=><button key={account} onClick={()=>{setEmail(account+'@demo.bni.local');setPassword('BniCuti!2026');setError('');}}>{label}<ArrowUpRight size={13}/></button>)}</div><small>Data contoh untuk uji coba.</small></div>}</div></div></div>;
}
function Dashboard({data,month,sdm,onSelect,onRequests,onCalendar}:any){
  const current:Leave[]=data.requests.filter((r:Leave)=>r.effectiveStart.startsWith(month)&&r.status!=='DRAFT');const waiting=current.filter(r=>r.status==='PENDING_SDM');const approved=current.filter(r=>r.status==='APPROVED');const quotas:Quota[]=data.quotas;
  return <>
    <div className="stats-grid">{[
      {label:'Total pengajuan',value:current.length,unit:'pengajuan'},
      {label:'Menunggu review',value:waiting.length,unit:'pengajuan'},
      {label:'Disetujui',value:approved.length,unit:'pengajuan'},
    ].map(s=><article className="stat-card" key={s.label}><div className="stat-head"><span>{s.label}</span></div><div className="stat-value">{s.value}<span>{s.unit}</span></div></article>)}</div>
    <div className="dashboard-grid"><section className="panel requests-panel"><div className="panel-heading"><div><h2>{sdm?'Pengajuan terbaru':'Pengajuan Anda'} <span className="count-bubble">{current.length}</span></h2></div><button className="text-button" onClick={onRequests}>Lihat semua<ArrowRight size={15}/></button></div><RequestTable requests={current.slice(0,5)} onSelect={onSelect} compact/></section>
      <section className="panel quota-panel"><div className="panel-heading"><div><h2>Kuota per posisi</h2><p>{monthLabel(month)} · dalam orang</p></div><Users size={19} className="muted"/></div><div className="quota-list">{quotas.slice(0,sdm?6:14).map(q=><div className="quota-row" key={q.position}><div><strong>{q.label}</strong><span><b>{q.used}</b> / {q.limit} <small>orang</small></span></div><div className="progress-track"><span style={{width:(q.limit?100*q.approved/q.limit:0)+'%'}}/><i style={{width:(q.limit?100*q.pending/q.limit:0)+'%'}}/></div></div>)}</div><div className="legend"><span><i className="teal-dot"/>Disetujui</span><span><i className="orange-dot"/>Menunggu</span><span><i className="gray-dot"/>Tersedia</span></div><button className="quota-link" onClick={onCalendar}>Lihat kalender<ArrowRight size={16}/></button></section>
    </div>

  </>;
}
function RequestTable({requests,onSelect,compact=false,onDraft}:{requests:Leave[];onSelect:(r:Leave)=>void;compact?:boolean;onDraft?:(r:Leave)=>void}){const {positionLabel}=useDirectory();return requests.length?<div className="table-scroll"><table><thead><tr><th>Karyawan</th><th>Jadwal cuti</th>{!compact&&<th>Jenis</th>}<th>Status</th><th aria-label="Aksi"/></tr></thead><tbody>{requests.map((r,i)=><tr key={r.id}><td><div className="person"><span className="avatar neutral">{initials(r.employeeName)}</span><div><strong>{r.employeeName}</strong><small>{(r.positionName??positionLabel(r.position))}</small></div></div></td><td><span className="date-range">{fmt(r.effectiveStart||r.start)}{r.effectiveEnd!==r.effectiveStart?' – '+fmt(r.effectiveEnd||r.end):''}</span><small>{r.duration} hari kerja</small></td>{!compact&&<td><span className={'category '+r.category.toLowerCase()}>{r.category==='REGULAR'?'Reguler':'Darurat'}</span><small>{r.number}</small></td>}<td><Badge status={r.status} cancellation={r.cancellation}/></td><td><button className="icon-button table-arrow" aria-label={'Lihat '+r.employeeName+' '+r.number} onClick={()=>r.status==='DRAFT'&&onDraft?onDraft(r):onSelect(r)}><ArrowUpRight size={17}/></button></td></tr>)}</tbody></table></div>:<Empty/>;}
function RequestList({requests,month,sdm,onSelect,onDraft}:any){
  const {positionLabel}=useDirectory();
  const [query,setQuery]=useState('');
  const [status,setStatus]=useState('ALL');
  const filtered=requests.filter((r:Leave)=>{
    const matchMonth=!month||(r.effectiveStart||r.start).startsWith(month);
    const matchStatus=status==='ALL'||(status==='CANCEL_PENDING'?(r.status==='APPROVED'&&r.cancellation?.status==='PENDING'):r.status===status);
    const matchQuery=`${r.employeeName} ${r.number} ${(r.positionName??positionLabel(r.position))}`.toLowerCase().includes(query.toLowerCase());
    return matchMonth&&matchStatus&&matchQuery;
  });
  return <section className="panel"><div className="list-toolbar"><div className="tabs">{[['ALL','Semua'],['PENDING_SDM','Menunggu'],...(sdm?[['CANCEL_PENDING','Perlu Batal']]:[]),['APPROVED','Disetujui'],['REJECTED','Ditolak'],...(!sdm?[['DRAFT','Draft'],['WITHDRAWN','Ditarik / Batal']]:[['WITHDRAWN','Dibatalkan']])].map(([id,label])=><button key={id} className={status===id?'selected':''} onClick={()=>setStatus(id)}>{label}</button>)}</div><label className="search"><Search size={17}/><input aria-label="Cari pengajuan" placeholder="Cari nama atau nomor…" value={query} onChange={e=>setQuery(e.target.value)}/></label></div><RequestTable requests={filtered} onSelect={onSelect} onDraft={onDraft}/><div className="table-footer">Menampilkan {filtered.length} pengajuan · {month?monthLabel(month):'Semua bulan'}</div></section>;
}
function CalendarView({data,month,setMonth,onSelect}:any){const {positions:POSITIONS,positionLabel}=useDirectory();const [position,setPosition]=useState('ALL');const days=monthDays(month);const offset=(new Date(month+'-01T00:00:00').getDay()+6)%7;const entries=data.calendar.filter((r:any)=>position==='ALL'||r.position===position);return <><section className="panel calendar-panel"><div className="panel-heading"><div className="calendar-heading"><button className="icon-button" aria-label="Bulan sebelumnya" onClick={()=>setMonth(addMonths(month+'-01',-1).slice(0,7))}><ChevronLeft size={18}/></button><h2>{monthLabel(month)}</h2><button className="icon-button" aria-label="Bulan berikutnya" onClick={()=>setMonth(addMonths(month+'-01',1).slice(0,7))}><ChevronRight size={18}/></button></div><select aria-label="Filter posisi kalender" value={position} onChange={e=>setPosition(e.target.value)}><option value="ALL">Semua posisi</option>{data.quotas.map((q:Quota)=><option key={q.position} value={q.position}>{q.label}</option>)}</select></div><div className="calendar-scroll"><div className="calendar-grid">{['Sen','Sel','Rab','Kam','Jum','Sab','Min'].map(d=><div className="weekday" key={d}>{d}</div>)}{Array.from({length:offset},(_,i)=><div className="day outside" key={'o'+i}/>)}{days.map(d=>{const blocked=data.blocked.includes(d);const off=!isWorking(d,data.calendarConfig);return <div key={d} className={'day '+(blocked?'blocked ':'')+(off?'off ':'')+(d===data.today?'current':'')}><div className="day-number">{Number(d.slice(-2))}{blocked&&<small>H-3</small>}</div>{data.calendarConfig.exceptions[d]&&<small className="holiday-label">{data.calendarConfig.exceptions[d].label}</small>}{entries.filter((r:any)=>r.days.includes(d)).map((r:any,i:number)=><button disabled={!r.id} key={r.id+'-'+i} onClick={()=>onSelect(r.id)} className={'calendar-event '+(r.status==='APPROVED'?'approved':'pending')}><span>{r.name}</span><small>{(r.positionName??positionLabel(r.position))} · {r.status==='APPROVED'?'Disetujui':'Menunggu'}</small></button>)}</div>;})}</div></div><div className="legend calendar-legend"><span><i className="teal-dot"/>Disetujui</span><span><i className="orange-dot"/>Menunggu review</span><span><i className="blocked-dot"/>3 hari kerja terakhir</span><span>Kalender kerja unit: Senin–Jumat + pengecualian admin</span></div></section><section className="panel all-quotas"><div className="panel-heading"><h2>Kapasitas posisi bulan ini</h2><span className="muted">Terpakai / kuota orang</span></div><div className="quota-cards">{data.quotas.map((q:Quota)=><div key={q.position}><strong>{q.label}</strong><span>{q.used}<small> / {q.limit}</small></span><p>{q.available} orang tersedia</p></div>)}</div></section></>;}

function DatePicker({label,value,onChange,min,max,calendar,validDates,disabled=false,disableNonWorking=false,blockedDates=[],placeholder='Pilih tanggal'}:{label:string;value:string;onChange:(val:string)=>void;min?:string;max?:string;calendar?:any;validDates?:string[];disabled?:boolean;disableNonWorking?:boolean;blockedDates?:string[];placeholder?:string}){
  const containerRef=useRef<HTMLDivElement>(null);
  const [open,setOpen]=useState(false);
  const initialMonth=value&&/^\d{4}-\d{2}-\d{2}$/.test(value)?value.slice(0,7):(min&&/^\d{4}-\d{2}-\d{2}$/.test(min)?min.slice(0,7):dateOnly().slice(0,7));
  const [viewMonth,setViewMonth]=useState(initialMonth);
  useEffect(()=>{
    if(value&&/^\d{4}-\d{2}-\d{2}$/.test(value)){setViewMonth(value.slice(0,7));}
    else if(min&&/^\d{4}-\d{2}-\d{2}$/.test(min)){setViewMonth(min.slice(0,7));}
  },[value,min]);
  useEffect(()=>{
    if(!open)return;
    const onDocClick=(e:MouseEvent)=>{if(containerRef.current&&!containerRef.current.contains(e.target as Node)){setOpen(false);}};
    const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape')setOpen(false);};
    document.addEventListener('mousedown',onDocClick);
    document.addEventListener('keydown',onKey);
    return()=>{document.removeEventListener('mousedown',onDocClick);document.removeEventListener('keydown',onKey);};
  },[open]);
  const prevMonth=()=>setViewMonth(m=>addMonths(m+'-01',-1).slice(0,7));
  const nextMonth=()=>setViewMonth(m=>addMonths(m+'-01',1).slice(0,7));
  const displayValue=value?(/^\d{4}-\d{2}-\d{2}$/.test(value)?`${value.slice(8,10)}/${value.slice(5,7)}/${value.slice(0,4)}`:value):'';
  const handleInputChange=(e:React.ChangeEvent<HTMLInputElement>)=>{
    const text=e.target.value.trim();
    if(!text){onChange('');return;}
    if(/^\d{4}-\d{2}-\d{2}$/.test(text)){onChange(text);return;}
    const match=text.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
    if(match){const [,d,mo,y]=match;onChange(`${y}-${mo.padStart(2,'0')}-${d.padStart(2,'0')}`);return;}
    onChange(text);
  };
  const days=monthDays(viewMonth);
  const firstDayOfWeek=new Date(viewMonth+'-01T00:00:00Z').getUTCDay();
  const weekdays=['Min','Sen','Sel','Rab','Kam','Jum','Sab'];
  return (
    <div className="datepicker-wrap" ref={containerRef}>
      <div className="datepicker-input-box">
        <input type="text" aria-label={label} value={displayValue} placeholder={placeholder} disabled={disabled} onChange={handleInputChange} onClick={()=>!disabled&&setOpen(o=>!o)}/>
        <button type="button" tabIndex={-1} aria-label={'Buka kalender '+label} className="datepicker-btn" disabled={disabled} onClick={()=>!disabled&&setOpen(o=>!o)}><CalendarDays size={17}/></button>
      </div>
      {open&&!disabled&&(
        <div className="datepicker-popover" role="dialog" aria-label={'Pilih '+label}>
          <div className="datepicker-head">
            <button type="button" className="datepicker-nav" aria-label="Bulan sebelumnya" onClick={prevMonth}><ChevronLeft size={16}/></button>
            <span className="datepicker-title">{monthLabel(viewMonth)}</span>
            <button type="button" className="datepicker-nav" aria-label="Bulan berikutnya" onClick={nextMonth}><ChevronRight size={16}/></button>
          </div>
          <div className="datepicker-weekdays">
            {weekdays.map((w,idx)=><span key={w} className={idx===0||idx===6?'col-weekend':''}>{w}</span>)}
          </div>
          <div className="datepicker-grid">
            {Array.from({length:firstDayOfWeek}).map((_,i)=><div key={'pre-'+i} className="datepicker-cell outside"/>)}
            {days.map(d=>{
              const dayNum=Number(d.slice(-2));
              const dow=(firstDayOfWeek+dayNum-1)%7;
              const isWeekend=dow===0||dow===6;
              const isHoliday=calendar?.exceptions?.[d]?.working===false;
              const holidayLabel=calendar?.exceptions?.[d]?.label;
              const isWork=calendar?isWorking(d,calendar):!isWeekend;
              const isBeforeMin=Boolean(min&&d<min);
              const isAfterMax=Boolean(max&&d>max);
              const isBlocked=Boolean(blockedDates&&blockedDates.includes(d));
              let selectable=false;
              let tooltip='';
              if(validDates){
                selectable=validDates.includes(d);
                if(!selectable){
                  if(isWeekend)tooltip=dow===6?'Sabtu (akhir pekan tidak dapat dipilih)':'Minggu (akhir pekan tidak dapat dipilih)';
                  else if(isHoliday)tooltip=holidayLabel?`Hari libur: ${holidayLabel}`:'Hari libur tidak dapat dipilih';
                  else if(isBeforeMin)tooltip='Sebelum tanggal mulai';
                  else if(isAfterMax)tooltip='Melebihi batas maksimal 5 hari kerja';
                  else if(isBlocked)tooltip='3 hari kerja terakhir bulan (H-3)';
                  else tooltip='Bukan pilihan hari kerja yang diizinkan';
                }
              }else{
                if(isBeforeMin)tooltip='Sebelum batas tanggal minimal';
                else if(isAfterMax)tooltip='Melebihi batas tanggal maksimal';
                else if(disableNonWorking&&!isWork){
                  tooltip=isWeekend?(dow===6?'Sabtu (akhir pekan tidak dapat dipilih)':'Minggu (akhir pekan tidak dapat dipilih)'):(holidayLabel?`Hari libur: ${holidayLabel}`:'Hari libur tidak dapat dipilih');
                }else if(isBlocked){
                  tooltip='3 hari kerja terakhir bulan (H-3)';
                }else{
                  selectable=true;
                }
              }
              return (
                <button
                  key={d}
                  type="button"
                  disabled={!selectable}
                  title={tooltip||undefined}
                  className={'datepicker-cell'+(selectable?' selectable':' disabled')+(isWeekend?' weekend':'')+(isHoliday?' holiday':'')+(d===value?' selected':'')}
                  onClick={()=>{if(selectable){onChange(d);setOpen(false);}}}
                >
                  {dayNum}
                </button>
              );
            })}
          </div>
          {validDates&&validDates.length>0&&(
            <div className="datepicker-quick">
              <div className="datepicker-quick-label">Pilihan hari kerja ({validDates.length} hari):</div>
              <div className="datepicker-quick-pills">
                {validDates.map((vd,i)=>(
                  <button
                    key={vd}
                    type="button"
                    className={'datepicker-pill'+(vd===value?' active':'')}
                    onClick={()=>{onChange(vd);setOpen(false);}}
                  >
                    <span>{new Intl.DateTimeFormat('id-ID',{weekday:'short',day:'numeric',month:'short'}).format(new Date(vd+'T00:00:00'))}</span>
                    <small>({i+1} hari)</small>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="datepicker-notice"><Info size={13}/><span>Sabtu, Minggu, dan hari libur tidak dapat dipilih.</span></div>
          <div className="datepicker-foot">
            {value?<button type="button" className="text-button" onClick={()=>{onChange('');setOpen(false);}}>Hapus</button>:<span/>}
            <button type="button" className="button secondary" style={{minHeight:28,padding:'4px 10px',fontSize:11}} onClick={()=>setOpen(false)}>Tutup</button>
          </div>
        </div>
      )}
    </div>
  );
}

const REGULAR_LEAVE_TYPES = ['Cuti Tahunan','Keperluan keluarga','Cuti Menikah','Cuti Ibadah / Keagamaan','Cuti Melahirkan / Ayah','Lainnya'] as const;

function LeaveForm({user,today,draft,calendar,onDone,onDelete}:{user:Employee;today:string;draft:Leave|null;calendar:any;onDone:(r:Leave)=>void;onDelete:()=>void}){
  const {positionLabel}=useDirectory();
  const [regularType,setRegularType]=useState(()=>draft&&draft.category==='REGULAR'?((REGULAR_LEAVE_TYPES as readonly string[]).slice(0,-1).includes(draft.subtype)?draft.subtype:'Lainnya'):'Cuti Tahunan');
  const [input,setInput]=useState<LeaveInput>(draft?{category:draft.category,subtype:draft.subtype,reason:draft.reason,start:draft.start,end:draft.end,email:draft.email,phone:draft.phone}:{category:'REGULAR',subtype:'Cuti Tahunan',reason:'',start:'',end:'',email:user.email,phone:user.phone});
  const [emergencyType,setEmergencyType]=useState(draft&&['Cuti Duka','Cuti Sakit'].includes(draft.subtype)?draft.subtype:'Lainnya');const [p,setP]=useState<Preview|null>(null);const [error,setError]=useState('');const [checking,setChecking]=useState(false);const [busy,setBusy]=useState(false);const [accepted,setAccepted]=useState(false);const [review,setReview]=useState(false);const [deleting,setDeleting]=useState(false);const submitKey=useRef(crypto.randomUUID());
  const maxEnd=input.start?calculateMaxEndDate(input.start,calendar):'';
  const validEndDates=input.start?getValidEndDates(input.start,calendar):[];
  const update=(key:keyof LeaveInput,value:string)=>{setInput(v=>({...v,[key]:value}));setP(null);setReview(false);setAccepted(false);submitKey.current=crypto.randomUUID();};
  const handleStartChange=(newStart:string)=>{if(!newStart){setInput(v=>({...v,start:'',end:''}));}else{const computedMaxEnd=calculateMaxEndDate(newStart,calendar);setInput(v=>({...v,start:newStart,end:computedMaxEnd||newStart}));}setP(null);setReview(false);setAccepted(false);submitKey.current=crypto.randomUUID();};
  const handleEndChange=(newEnd:string)=>{if(!newEnd){update('end','');return;}if(maxEnd&&newEnd>maxEnd)update('end',maxEnd);else if(input.start&&newEnd<input.start)update('end',input.start);else update('end',newEnd);};
  useEffect(()=>{let active=true;setP(null);setError('');if(!input.start||!input.end||input.reason.trim().length<10||input.subtype.trim().length<2||!input.email||input.phone.length<8){setChecking(false);return;}
    setChecking(true);const timer=setTimeout(()=>{action('/leave-requests/preview',input).then(result=>{if(active)setP(result);}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setChecking(false);});},350);return()=>{active=false;clearTimeout(timer);};
  },[input]);
  const minimum=input.category==='REGULAR'?addMonths(today,1):today;
  async function send(){setBusy(true);setError('');try{onDone(await action('/leave-requests',{...input,fingerprint:p?.fingerprint,acceptAdjustment:accepted,draftId:draft?.id,draftVersion:draft?.version},submitKey.current));}catch(e){setError((e as Error).message);if(e instanceof ApiError&&e.details){setP(e.details);setReview(false);setAccepted(false);submitKey.current=crypto.randomUUID();}}finally{setBusy(false);}}
  async function save(){setBusy(true);try{onDone(await action('/drafts',{...input,id:draft?.id||undefined,version:draft?.id?draft.version:undefined}));}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <div className="form-layout"><section className="panel form-panel"><div className="section-number"><b>01</b><div><h2>Detail pengajuan</h2><p>{user.name} · {positionLabel(user.position)}</p></div></div><div className="category-options"><button className={input.category==='REGULAR'?'chosen':''} onClick={()=>{update('category','REGULAR');update('subtype',regularType==='Lainnya'?'':regularType);}}><CalendarDays size={23}/><strong>Cuti reguler</strong><small>Rencanakan satu bulan sebelumnya</small>{input.category==='REGULAR'&&<CheckCircle2 size={17}/>}</button><button className={input.category==='EMERGENCY'?'chosen':''} onClick={()=>{update('category','EMERGENCY');update('subtype',emergencyType==='Lainnya'?'':emergencyType);}}><Clock3 size={23}/><strong>Cuti darurat</strong><small>Tanpa masa tunggu satu bulan</small>{input.category==='EMERGENCY'&&<CheckCircle2 size={17}/>}</button></div>
      {input.category==='EMERGENCY'?<><Field label="Jenis cuti darurat"><select value={emergencyType} onChange={e=>{setEmergencyType(e.target.value);update('subtype',e.target.value==='Lainnya'?'':e.target.value);}}><option>Cuti Duka</option><option>Cuti Sakit</option><option>Lainnya</option></select></Field>{emergencyType==='Lainnya'&&<Field label="Nama jenis cuti"><input placeholder="Tuliskan nama jenis cuti darurat…" value={input.subtype} onChange={e=>update('subtype',e.target.value)} maxLength={120}/></Field>}</>:<><Field label="Jenis cuti"><select value={regularType} onChange={e=>{setRegularType(e.target.value);update('subtype',e.target.value==='Lainnya'?'':e.target.value);}}>{REGULAR_LEAVE_TYPES.map(t=><option key={t} value={t}>{t}</option>)}</select></Field>{regularType==='Lainnya'&&<Field label="Nama jenis cuti"><input placeholder="Tuliskan nama jenis cuti reguler…" value={input.subtype} onChange={e=>update('subtype',e.target.value)} maxLength={120}/></Field>}</>}
      <Field label="Alasan pengajuan" hint="Minimal 10 karakter. Alasan hanya dapat dilihat oleh Anda dan SDM berwenang."><textarea rows={3} value={input.reason} onChange={e=>update('reason',e.target.value)} placeholder="Ceritakan keperluan cuti Anda…" maxLength={2000}/></Field>
      <div className="section-number separated"><b>02</b><div><h2>Jadwal cuti</h2></div></div><div className="alert info"><Info size={18}/><span>{input.category==='REGULAR'?`Batas masa tunggu: ${fmt(minimum,true)}. `:'Cuti darurat dapat dimulai hari ini. '}Hindari 3 hari kerja terakhir bulan; maksimal 5 hari kerja.</span></div><div className="field-grid"><Field label="Tanggal mulai"><DatePicker label="Tanggal mulai" value={input.start} onChange={handleStartChange} min={minimum} calendar={calendar} disableNonWorking={true} blockedDates={calendar?blockedDays(minimum.slice(0,7),calendar):[]} placeholder="Pilih tanggal mulai"/></Field><Field label="Tanggal akhir" hint={maxEnd?`Maksimal 5 hari kerja s.d. ${fmt(maxEnd,true)}`:'Maksimal 5 hari kerja'}><DatePicker label="Tanggal akhir" value={input.end} onChange={handleEndChange} min={input.start||minimum} max={maxEnd||undefined} calendar={calendar} validDates={validEndDates} disabled={!input.start} placeholder={!input.start?'Pilih tanggal mulai dahulu':'Pilih tanggal akhir'}/></Field></div>
      {input.start&&!isWorking(input.start,calendar)&&<div className="alert danger">Tanggal mulai bukan hari kerja. Pilih hari kerja lain.</div>}
      {input.end&&!isWorking(input.end,calendar)&&<div className="alert danger">Tanggal akhir bukan hari kerja (Sabtu, Minggu, atau hari libur). Pilih hari kerja lain.</div>}
      {maxEnd&&input.end&&input.end>maxEnd&&<div className="alert danger">Tanggal akhir melebihi batas 5 hari kerja (maksimal hingga {fmt(maxEnd,true)}).</div>}
      <div className="section-number separated"><b>03</b><div><h2>Informasi kontak</h2></div></div><div className="field-grid"><Field label="Nomor HP"><input type="tel" value={input.phone} onChange={e=>update('phone',e.target.value)}/></Field><Field label="Email pemberitahuan"><input type="email" value={input.email} onChange={e=>update('email',e.target.value)}/></Field></div>
      {error&&<div className="alert danger" role="alert">{error}</div>}<div className="form-actions"><button className="button secondary" disabled={busy} onClick={save}><Save size={17}/>Simpan draft</button><button className="button primary" disabled={busy||checking||!p||!!p.errors.length||!input.start||!input.end||!isWorking(input.start,calendar)||!isWorking(input.end,calendar)} onClick={()=>setReview(true)}>Tinjau pengajuan<ArrowRight size={17}/></button></div>{draft?.id&&<button className="text-button" disabled={busy} onClick={()=>setDeleting(true)}>Hapus draft ini</button>}
    </section><aside className="form-summary panel"><h2>Ringkasan cuti</h2>{checking?<p role="status">Menghitung tanggal dan kuota…</p>:p?<><div className="duration"><strong>{p.duration}</strong><span>hari kerja</span></div><dl><dt>Tanggal diminta</dt><dd>{fmt(input.start)} – {fmt(input.end)}</dd><dt>Tanggal efektif</dt><dd>{fmt(p.effectiveStart)} – {fmt(p.effectiveEnd)}</dd><dt>Kuota tersedia</dt><dd>{p.quota.available} dari {p.quota.limit} orang</dd><dt>Tambahan pemakaian</dt><dd>{p.quota.alreadyCounted?'0 (Anda sudah terhitung)':'1 orang'}</dd><dt>Status awal</dt><dd>Menunggu review</dd></dl>{p.adjusted&&<div className="alert warning"><Info size={17}/><span>Tanggal akhir disesuaikan menjadi {fmt(p.effectiveEnd,true)} mengikuti hari kerja dan batas H-3.</span></div>}{p.errors.map(e=><div className="alert danger" key={e.code} role="alert">{e.message}</div>)}{p.scheduledAt&&<div className="email-note"><Mail size={18}/><span>Pengingat SDM: {new Date(p.scheduledAt).toLocaleString('id-ID',{timeZone:'Asia/Jakarta'})} WIB</span></div>}</>:<div className="summary-placeholder"><CalendarDays size={38}/><p>Lengkapi form untuk melihat ringkasan.</p></div>}</aside>
    {review&&p&&<Modal title="Tinjau pengajuan cuti" onClose={()=>setReview(false)}><Badge status="DRAFT"/><h3>{input.subtype}</h3><p className="reason-text">{input.reason}</p><dl><dt>Kategori</dt><dd>{input.category==='REGULAR'?'Reguler':'Darurat'}</dd><dt>Tanggal diminta</dt><dd>{fmt(input.start,true)} – {fmt(input.end,true)}</dd><dt>Tanggal efektif</dt><dd>{fmt(p.effectiveStart,true)} – {fmt(p.effectiveEnd,true)}</dd><dt>Durasi</dt><dd>{p.duration} hari kerja · {p.quota.alreadyCounted?'slot sudah terhitung':'1 slot orang'}</dd><dt>Kontak</dt><dd>{input.phone}<br/>{input.email}</dd></dl>{p.adjusted&&<label className="checkbox"><input type="checkbox" checked={accepted} onChange={e=>setAccepted(e.target.checked)}/>Saya memahami tanggal dan durasi yang disesuaikan.</label>}{error&&<div className="alert danger">{error}</div>}<div className="modal-actions"><button className="button secondary" onClick={()=>setReview(false)}>Kembali</button><button className="button primary" disabled={busy||(p.adjusted&&!accepted)} onClick={send}><Send size={17}/>{busy?'Mengirim…':'Kirim pengajuan'}</button></div></Modal>}
    {deleting&&<Modal title="Hapus draft?" onClose={()=>setDeleting(false)}><p className="reason-text">Draft ini akan dihapus. Kuota tidak berubah karena draft belum memakai slot.</p><div className="modal-actions"><button className="button secondary" onClick={()=>setDeleting(false)}>Kembali</button><button className="button danger-button" disabled={busy} onClick={async()=>{setBusy(true);try{await api('/drafts/'+draft!.id,{method:'DELETE',key:crypto.randomUUID()});onDelete();}catch(e){setError((e as Error).message);setDeleting(false);}finally{setBusy(false);}}}>Hapus draft</button></div></Modal>}
  </div>;
}
function Detail({leave:r,user,today,onClose,onUpdate,onCopy}:{leave:Leave;user:Employee;today:string;onClose:()=>void;onUpdate:(r:Leave)=>void;onCopy:()=>void}){const {positionLabel}=useDirectory();const [error,setError]=useState('');const [busy,setBusy]=useState(false);const [reason,setReason]=useState('');const [channel,setChannel]=useState(r.confirmationChannel||'WhatsApp');const [isEditingConfirm,setIsEditingConfirm]=useState(false);const [customChannel,setCustomChannel]=useState(Boolean(r.confirmationChannel&&!['WhatsApp','Telepon','Tatap Muka','Email'].includes(r.confirmationChannel)));const [confirmAction,setConfirmAction]=useState('');
  const canReview=user.roles.includes('SDM')&&r.employeeId!==user.id&&r.status==='PENDING_SDM';
  const [replacement,setReplacement]=useState<ReplacementCheck|null>(null);const [replacementError,setReplacementError]=useState('');const [replacementId,setReplacementId]=useState('');const [replacementRefresh,setReplacementRefresh]=useState(0);
  useEffect(()=>{
    if(!canReview)return;let alive=true;
    const load=()=>api<ReplacementCheck>('/leave-requests/'+r.id+'/replacements').then(check=>{if(alive){setReplacement(check);setReplacementError('');}}).catch(e=>{if(alive)setReplacementError(e.message);});
    void load();const timer=setInterval(()=>{if(document.visibilityState==='visible')void load();},5000);
    return()=>{alive=false;clearInterval(timer);};
  },[canReview,r.id,r.version,replacementRefresh]);
  const pgsBlocked=canReview&&(!replacement||!!replacementError||!!replacement.rule?.enabled&&!replacement.candidates.some(c=>c.available)||!!replacementId&&!replacement?.candidates.some(c=>c.id===replacementId&&c.available));
  const canReviewCancellation=user.roles.includes('SDM')&&r.employeeId!==user.id&&r.status==='APPROVED'&&r.cancellation?.status==='PENDING';
  const canRequestCancellation=r.employeeId===user.id&&r.status==='APPROVED'&&r.effectiveEnd>=today&&(!r.cancellation||r.cancellation.status==='REJECTED');
  const hasPendingCancellation=r.status==='APPROVED'&&r.cancellation?.status==='PENDING';
  const cleanPhone=(r.phone||'').replace(/\D/g,'');const waNumber=cleanPhone.startsWith('0')?'62'+cleanPhone.slice(1):cleanPhone.startsWith('62')?cleanPhone:('62'+cleanPhone);
  const waMessage=[
    `Halo *${r.employeeName}*, kami dari SDM ingin mengonfirmasi terkait pengajuan cuti Anda:`,
    '',
    `• *Nama :* ${r.employeeName}`,
    `• *Posisi :* ${(r.positionName??positionLabel(r.position))}`,
    `• *Jenis cuti :* ${r.subtype} (${r.number})`,
    `• *Alasan pengajuan :* ${r.reason}`,
    `• *Jadwal cuti :* ${fmt(r.effectiveStart,true)} s/d ${fmt(r.effectiveEnd,true)} (${r.duration} hari kerja)`,
    '',
    'Apakah Anda jadi mengambil cuti tersebut? Mohon konfirmasinya. Terima kasih.'
  ].join('\n');
  const waUrl=`https://wa.me/${waNumber}?text=${encodeURIComponent(waMessage)}`;
  async function update(actionName:string,body:any){setBusy(true);setError('');try{onUpdate(await action('/leave-requests/'+r.id+'/'+actionName,{...body,version:r.version}));setConfirmAction('');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  const cancelDecision=()=>{if(!busy){setConfirmAction('');setError('');}};
  if(confirmAction){
    const isCancelRequest=confirmAction==='CANCEL_REQUEST';
    const isApproveCancel=confirmAction==='APPROVE_CANCEL';
    const isRejectCancel=confirmAction==='REJECT_CANCEL';
    const modalTitle=isCancelRequest?'Ajukan pembatalan cuti?':isApproveCancel?'Setujui pembatalan cuti?':isRejectCancel?'Tolak permohonan pembatalan?':confirmAction==='WITHDRAWN'?'Tarik pengajuan ini?':confirmAction==='APPROVED'?'Setujui pengajuan ini?':'Tolak pengajuan ini?';
    return <Modal key="decision" compact title={modalTitle} onClose={cancelDecision}>
      <div className="decision-summary"><strong>{r.employeeName}</strong><span>{r.number} · {(r.positionName??positionLabel(r.position))}</span><span>{fmt(r.effectiveStart,true)} – {fmt(r.effectiveEnd,true)} · {r.duration} hari kerja</span></div>
      {confirmAction==='APPROVED'&&replacement?.rule?.enabled&&<p className="reason-text">{replacementId?'PGS: '+replacement.candidates.find(c=>c.id===replacementId)?.name:'Ketersediaan PGS akan diperiksa kembali saat keputusan disimpan.'}</p>}
      {isCancelRequest?(
        <>
          <p className="reason-text">Permohonan pembatalan cuti akan dikirim ke SDM untuk diverifikasi. Jika disetujui, slot kuota cuti Anda pada bulan ini akan otomatis dilepas kembali.</p>
          <Field label="Alasan pembatalan cuti" hint="Jelaskan alasan mendesak atau tugas kantor yang tidak dapat ditinggal (min. 5 karakter)">
            <textarea autoFocus value={reason} onChange={e=>setReason(e.target.value)} minLength={5} maxLength={2000} placeholder="Contoh: Mendapat penugasan dinas mendadak dari pimpinan untuk audit cabang sehingga cuti belum dapat diambil…"/>
          </Field>
        </>
      ):isApproveCancel?(
        <>
          <div style={{background:'#fcf8ee',border:'1px solid #f6e6c2',borderRadius:8,padding:'10px 14px',marginBottom:14}}>
            <small style={{color:'#8f7435',display:'block',marginBottom:3,fontWeight:600}}>Alasan pembatalan karyawan:</small>
            <span style={{fontSize:12,color:'#3b2f14'}}>{r.cancellation?.reason}</span>
          </div>
          <p className="reason-text">Status cuti akan dibatalkan (ditarik). Kuota 1 orang pada bulan ini akan langsung dilepas kembali untuk unit Anda.</p>
          <Field label="Catatan persetujuan (opsional)">
            <textarea value={reason} onChange={e=>setReason(e.target.value)} maxLength={2000} placeholder="Catatan untuk karyawan…"/>
          </Field>
        </>
      ):isRejectCancel?(
        <>
          <div style={{background:'#fcf8ee',border:'1px solid #f6e6c2',borderRadius:8,padding:'10px 14px',marginBottom:14}}>
            <small style={{color:'#8f7435',display:'block',marginBottom:3,fontWeight:600}}>Alasan pembatalan karyawan:</small>
            <span style={{fontSize:12,color:'#3b2f14'}}>{r.cancellation?.reason}</span>
          </div>
          <Field label="Alasan penolakan pembatalan" hint="Jelaskan kepada karyawan mengapa permohonan pembatalan tidak diizinkan">
            <textarea autoFocus value={reason} onChange={e=>setReason(e.target.value)} minLength={5} maxLength={2000} placeholder="Jelaskan alasan penolakan pembatalan (minimal 5 karakter)…"/>
          </Field>
        </>
      ):confirmAction==='REJECTED'?(
        <Field label="Alasan penolakan"><textarea value={reason} onChange={e=>setReason(e.target.value)} minLength={5} maxLength={2000} placeholder="Jelaskan alasan penolakan…"/></Field>
      ):(
        <p className="reason-text">{confirmAction==='WITHDRAWN'?'Slot orang dilepas jika Anda tidak memiliki pengajuan aktif lain pada bulan ini.':'Keputusan akan dicatat dan pemberitahuan diantrekan ke email karyawan.'}</p>
      )}
      {error&&<div className="alert danger" role="alert">{error}</div>}
      <div className="modal-actions">
        <button className="button secondary" disabled={busy} onClick={cancelDecision}>Kembali</button>
        {isCancelRequest?(
          <button className="button danger-button" disabled={busy||reason.trim().length<5} onClick={()=>update('cancel-request',{reason:reason.trim()})}>{busy?'Mengirim…':'Kirim permohonan pembatalan'}</button>
        ):isApproveCancel?(
          <button className="button primary" disabled={busy} onClick={()=>update('cancel-review',{outcome:'APPROVED',reason:reason.trim()})}>{busy?'Menyimpan…':'Konfirmasi setujui pembatalan'}</button>
        ):isRejectCancel?(
          <button className="button danger-button" disabled={busy||reason.trim().length<5} onClick={()=>update('cancel-review',{outcome:'REJECTED',reason:reason.trim()})}>{busy?'Menyimpan…':'Tolak permohonan'}</button>
        ):(
          <button className={'button '+(confirmAction==='APPROVED'?'primary':'danger-button')} disabled={busy||(confirmAction==='APPROVED'&&pgsBlocked)||(confirmAction==='REJECTED'&&reason.trim().length<5)} onClick={()=>update(confirmAction==='WITHDRAWN'?'withdraw':'decision',{outcome:confirmAction,reason,replacementId:confirmAction==='APPROVED'?replacementId:undefined})}>{busy?'Menyimpan…':'Konfirmasi keputusan'}</button>
        )}
      </div>
    </Modal>;
  }
  return <Modal title={'Detail '+r.number} onClose={onClose}><div className="detail-title"><div className="person"><span className="avatar teal">{initials(r.employeeName)}</span><div><h3>{r.employeeName}</h3><p>{(r.positionName??positionLabel(r.position))} · {r.category==='REGULAR'?'Reguler':'Darurat'}</p></div></div><Badge status={r.status} cancellation={r.cancellation}/></div><div className="detail-dates"><div><small>Tanggal efektif</small><strong>{fmt(r.effectiveStart,true)} – {fmt(r.effectiveEnd,true)}</strong></div><b>{r.duration}<small>hari kerja</small></b></div><dl><dt>Tanggal diminta</dt><dd>{fmt(r.start,true)} – {fmt(r.end,true)}</dd><dt>Jenis cuti</dt><dd>{r.subtype}</dd><dt>Email</dt><dd>{r.email}</dd><dt>Nomor HP</dt><dd>{r.phone}</dd><dt>Versi kalender</dt><dd>{r.calendarVersion} · Kuota {r.limit} orang</dd></dl>
    {hasPendingCancellation&&<div className="alert warning" style={{display:'flex',flexDirection:'column',gap:5}}>
      <div style={{display:'flex',alignItems:'center',gap:7}}><AlertCircle size={18}/><strong>Permohonan Pembatalan Cuti Menunggu Persetujuan SDM</strong></div>
      <p style={{margin:0,fontSize:12,color:'#825619'}}>Alasan pembatalan karyawan: <em>"{r.cancellation?.reason}"</em><br/><small>Diajukan pada {new Date(r.cancellation!.requestedAt).toLocaleString('id-ID',{timeZone:'Asia/Jakarta'})} WIB</small></p>
    </div>}
    {r.status==='APPROVED'&&r.cancellation?.status==='REJECTED'&&<div className="alert danger">
      <XCircle size={18}/>
      <div><strong>Permohonan pembatalan cuti sebelumnya ditolak SDM ({r.cancellation.reviewedBy}):</strong><p style={{margin:'2px 0 0',fontSize:12}}>{r.cancellation.decisionReason||'Tidak disetujui oleh SDM.'}</p></div>
    </div>}
    {r.status==='WITHDRAWN'&&r.cancellation?.status==='APPROVED'&&<div className="alert info">
      <CheckCircle2 size={18}/>
      <div><strong>Cuti Telah Dibatalkan Resmi</strong><p style={{margin:'2px 0 0',fontSize:12}}>Kuota cuti pada bulan ini telah dilepas. Anda dapat menggunakan tombol "Salin ke pengajuan baru" di bawah jika ingin mengajukan jadwal cuti baru (pindah tanggal).</p></div>
    </div>}
    {r.outletName&&<p className="reason-text">Outlet: {r.outletName}</p>}
    {r.replacement&&<div className="alert info"><span><strong>PGS {(r.positionName??positionLabel(r.position))}: {r.replacement.employeeName}</strong><br/>{positionLabel(r.replacement.position)} · {r.replacement.outletName}{r.status==='WITHDRAWN'?' · Tugas PGS telah dilepas':''}</span></div>}
    {canReview&&<ReplacementPanel check={replacement} error={replacementError} refresh={()=>{setReplacement(null);setReplacementRefresh(n=>n+1);}} selected={replacementId} onSelect={setReplacementId}/>}
    <h4>Alasan pengajuan</h4><p className="reason-text">{r.reason}</p>{r.decisionReason&&<div className="alert info"><span><strong>Catatan keputusan</strong><br/>{r.decisionReason}</span></div>}
    <h4>Aktivitas pengajuan</h4><div className="timeline">{r.events.map((e,i)=><div key={i}><i/><strong>{e.text}</strong><small>{e.actor} · {new Date(e.at).toLocaleString('id-ID',{timeZone:'Asia/Jakarta'})} WIB</small></div>)}</div>
    {r.status==='PENDING_SDM'&&r.effectiveStart<today&&<div className="alert danger">Tanggal mulai sudah terlewati. Persetujuan tidak lagi tersedia.</div>}
    {canReviewCancellation&&<div className="confirmation-box" style={{background:'#fffdf7',borderColor:'#f5e4bd'}}>
      <div className="confirmation-box-header">
        <div className="confirmation-title-wrap">
          <div className="confirmation-box-icon" style={{background:'#faecc9',color:'#9a6f1d'}}><AlertCircle size={18}/></div>
          <div>
            <h4>Verifikasi Pembatalan Cuti Disetujui</h4>
            <p className="confirmation-box-subtitle">Karyawan mengajukan pembatalan cuti karena tugas mendesak atau kendala pekerjaan.</p>
          </div>
        </div>
      </div>
      <div style={{background:'#fff',padding:'10px 14px',borderRadius:8,border:'1px solid #ede3d0',marginBottom:14}}>
        <small style={{color:'#887661',display:'block',marginBottom:3,fontWeight:600}}>Alasan Karyawan ({r.employeeName}):</small>
        <span style={{fontSize:12,color:'#2c2518'}}>{r.cancellation?.reason}</span>
      </div>
      <div className="confirmation-actions">
        <button className="button confirm-yes-btn" onClick={()=>{setReason('');setConfirmAction('APPROVE_CANCEL');}}><Check size={16}/>Setujui Pembatalan (Lepas Kuota)</button>
        <button className="button confirm-no-btn" onClick={()=>{setReason('');setConfirmAction('REJECT_CANCEL');}}><X size={16}/>Tolak Permohonan Pembatalan</button>
      </div>
    </div>}
    {canReview&&r.category==='REGULAR'&&<div className={'confirmation-box '+(r.confirmation==='CONFIRMED'?'confirmed':r.confirmation==='DECLINED'?'declined':'')}>
      <div className="confirmation-box-header">
        <div className="confirmation-title-wrap">
          <div className="confirmation-box-icon"><UserCheck size={18}/></div>
          <div>
            <h4>Konfirmasi karyawan</h4>
            <p className="confirmation-box-subtitle">{r.confirmation==='CONFIRMED'?'Karyawan telah mengonfirmasi jadi mengambil cuti.':r.confirmation==='DECLINED'?'Karyawan tidak jadi cuti. Tolak pengajuan untuk menyelesaikan proses.':'Hubungi karyawan lalu catat hasil konfirmasinya.'}</p>
          </div>
        </div>
        {r.confirmation!=='NOT_CONFIRMED'&&!isEditingConfirm&&<button type="button" className="text-button" onClick={()=>setIsEditingConfirm(true)} style={{fontSize:11,padding:'4px 0'}}><RotateCcw size={12}/>Ubah konfirmasi</button>}
      </div>
      <div className="quick-contact-strip">
        <div className="quick-contact-info">
          <small>Kontak {r.employeeName}:</small>
          <strong>{r.phone}</strong>
        </div>
        <div className="quick-contact-actions">
          <a href={waUrl} target="_blank" rel="noopener noreferrer" className="quick-contact-btn wa" title="Buka chat WhatsApp dengan draf konfirmasi">
            <MessageCircle size={14}/>Chat WhatsApp
          </a>
          <a href={`tel:${r.phone}`} className="quick-contact-btn tel" title="Panggil nomor telepon karyawan">
            <Phone size={14}/>Panggil Telepon
          </a>
        </div>
      </div>
      {r.confirmation==='CONFIRMED'&&!isEditingConfirm?(
        <div className="confirmation-banner confirmed">
          <div className="confirmation-banner-content">
            <CheckCircle2 size={18}/>
            <div className="confirmation-banner-text">
              <strong>Terkonfirmasi melalui {r.confirmationChannel||channel}</strong>
              <small>Pengajuan sudah dapat disetujui melalui tombol "Setujui pengajuan" di bawah.</small>
            </div>
          </div>
        </div>
      ):r.confirmation==='DECLINED'&&!isEditingConfirm?(
        <div className="confirmation-banner declined">
          <div className="confirmation-banner-content">
            <XCircle size={18}/>
            <div className="confirmation-banner-text">
              <strong>Karyawan membatalkan cuti (Kanal: {r.confirmationChannel||channel})</strong>
              <small>Silakan tolak pengajuan ini untuk melepas slot kuota.</small>
            </div>
          </div>
          <button type="button" className="button danger-button" style={{minHeight:32,padding:'4px 12px',fontSize:11}} onClick={()=>setConfirmAction('REJECTED')}>Tolak pengajuan sekarang</button>
        </div>
      ):(
        <>
          <div className="field" style={{marginBottom:12}}>
            <span style={{fontSize:12,fontWeight:600,color:'#52717b'}}>Kanal konfirmasi:</span>
            <div className="channel-chips">
              {['WhatsApp','Telepon','Tatap Muka','Email'].map(ch=><button key={ch} type="button" className={'channel-chip '+(channel===ch&&!customChannel?'selected':'')} onClick={()=>{setChannel(ch);setCustomChannel(false);}}>{ch==='WhatsApp'&&<MessageCircle size={13}/>}{ch==='Telepon'&&<Phone size={13}/>}{ch}</button>)}
              <button type="button" className={'channel-chip '+(customChannel?'selected':'')} onClick={()=>{setCustomChannel(true);if(['WhatsApp','Telepon','Tatap Muka','Email'].includes(channel))setChannel('');}}>Lainnya...</button>
            </div>
            {customChannel&&<input autoFocus value={channel} onChange={e=>setChannel(e.target.value)} placeholder="Tuliskan kanal konfirmasi (misal: Microsoft Teams, Memo dinas)..." maxLength={120} style={{marginTop:8}}/>}
          </div>
          <div className="confirmation-actions">
            <button disabled={busy||!channel.trim()} className="button confirm-yes-btn" onClick={async()=>{await update('confirmation',{result:'CONFIRMED',channel:channel.trim()});setIsEditingConfirm(false);}}><Check size={16}/>Jadi mengambil cuti</button>
            <button disabled={busy||!channel.trim()} className="button confirm-no-btn" onClick={async()=>{await update('confirmation',{result:'DECLINED',channel:channel.trim()});setIsEditingConfirm(false);}}><X size={16}/>Tidak jadi</button>
            {isEditingConfirm&&<button type="button" className="text-button" onClick={()=>setIsEditingConfirm(false)} style={{marginLeft:'auto'}}>Batal ubah</button>}
          </div>
        </>
      )}
    </div>}
    {error&&<div className="alert danger" role="alert">{error}</div>}{r.employeeId===user.id&&['REJECTED','WITHDRAWN'].includes(r.status)&&<button className="button secondary" onClick={onCopy}><Plus size={17}/>Salin ke pengajuan baru</button>}
    <div className="modal-actions">
      {r.status==='PENDING_SDM'&&r.employeeId===user.id&&<button className="button secondary" onClick={()=>setConfirmAction('WITHDRAWN')}>Tarik pengajuan</button>}
      {hasPendingCancellation&&r.employeeId===user.id&&<button className="button secondary" disabled={busy} onClick={()=>update('cancel-abort',{})}>Tarik permohonan pembatalan</button>}
      {canRequestCancellation&&<button className="button secondary" style={{color:'#ad302b',borderColor:'#f1cfcb'}} onClick={()=>{setReason('');setConfirmAction('CANCEL_REQUEST');}}><X size={16}/>Ajukan pembatalan cuti</button>}
      {canReview&&<><button className="button secondary" onClick={()=>setConfirmAction('REJECTED')}>Tolak pengajuan</button><button className="button primary" disabled={busy||pgsBlocked||r.effectiveStart<today||(r.category==='REGULAR'&&r.confirmation!=='CONFIRMED')} onClick={()=>setConfirmAction('APPROVED')}><Check size={17}/>Setujui pengajuan</button></>}
    </div>
  </Modal>;
}
function Admin({onChange,onToast,today,userId}:{onChange:()=>void;onToast:(s:string)=>void;today:string;userId:string}){const [data,setData]=useState<any>(null);const [tab,setTab]=useState(()=>{try{const saved=sessionStorage.getItem('bni_cuti_admin_tab');if(['employees','positions','outlets','replacements','quota','calendar','jobs','audit'].includes(saved||''))return saved!;}catch{}return 'employees';});const [error,setError]=useState('');const [busy,setBusy]=useState(false);const [editing,setEditing]=useState<any>(null);const [deleting,setDeleting]=useState<Employee|null>(null);const [deleteError,setDeleteError]=useState('');const [date,setDate]=useState('');const [label,setLabel]=useState('');const [working,setWorking]=useState(false);const [qm,setQm]=useState(addMonths(today.slice(0,7)+'-01',1).slice(0,7));const [pos,setPos]=useState('CS_BINA');const [limit,setLimit]=useState(2);const [calYear,setCalYear]=useState('ALL');
  const load=()=>api<any>('/admin').then(next=>{setData(next);if(!next.positions.some((p:any)=>p[0]===pos)){setPos(next.positions[0]?.[0]??'');setLimit(next.positions[0]?.[2]??0);}}).catch(e=>setError(e.message));useEffect(()=>{load();},[]);
  async function save(path:string,body:any){setBusy(true);setError('');try{await action('/admin/'+path,body);await load();onChange();onToast('Perubahan berhasil disimpan.');setEditing(null);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  async function deleteEmployee(){if(!deleting)return;setBusy(true);setDeleteError('');try{await api('/admin/employee/'+encodeURIComponent(deleting.id),{method:'DELETE',key:crypto.randomUUID()});await load();onChange();setDeleting(null);onToast('Karyawan berhasil dihapus.');}catch(e){setDeleteError((e as Error).message);}finally{setBusy(false);}}
  if(!data)return <div className="panel empty">{error||'Memuat administrasi…'}</div>;
  const POSITIONS:readonly (readonly [string,string,number])[]=data.positions;const positionLabel=(code:string)=>POSITIONS.find(p=>p[0]===code)?.[1]??code;
  return <section className="panel"><div className="list-toolbar"><div className="tabs">{[['employees','Karyawan'],['positions','Posisi'],['outlets','Outlet'],['replacements','Aturan PGS'],['quota','Posisi & kuota'],['calendar','Kalender kerja'],['jobs','Notifikasi email'],['audit','Audit']].map(([id,name])=><button key={id} className={tab===id?'selected':''} onClick={()=>{setTab(id);setError('');try{sessionStorage.setItem('bni_cuti_admin_tab',id);}catch{}}}>{name}</button>)}</div></div>{error&&<div className="alert danger margin" role="alert">{error}</div>}
    {tab==='employees'&&<><div className="panel-heading"><div><h2>Direktori karyawan</h2><p>Akses dan penempatan karyawan pada unit ini.</p></div><button className="button primary" onClick={()=>setEditing({name:'',email:'',phone:'',position:POSITIONS[0]?.[0]??'',outletId:data.outlets[0]?.id??'',roles:['EMPLOYEE'],active:true,password:''})}><Plus size={17}/>Tambah karyawan</button></div><div className="table-scroll"><table><thead><tr><th>Nama</th><th>Posisi</th><th>Outlet</th><th>Akses</th><th>Status</th><th>Aksi</th></tr></thead><tbody>{data.employees.map((e:Employee)=><tr key={e.id}><td><strong>{e.name}</strong><small>{e.email}</small></td><td>{positionLabel(e.position)}</td><td>{data.outlets.find((o:any)=>o.id===e.outletId)?.name??'—'}</td><td>{e.roles.join(', ')}</td><td>{e.active?'Aktif':'Nonaktif'}</td><td><div className="employee-actions"><button className="text-button" disabled={busy} onClick={()=>setEditing({...e,password:''})}>Edit</button>{e.id!==userId&&<button className="text-button delete-link" disabled={busy} aria-label={'Hapus '+e.name} onClick={()=>{setDeleteError('');setDeleting(e);}}>Hapus</button>}</div></td></tr>)}</tbody></table></div></>}
    {['positions','outlets','replacements'].includes(tab)&&<ReplacementAdmin key={tab} tab={tab} data={data} onChange={async()=>{await load();onChange();}} onToast={onToast}/>}
    {tab==='quota'&&<div className="admin-content"><h2>Kuota orang per posisi</h2><p className="muted">Berlaku per bulan dan sekaligus menjadi batas orang cuti bersamaan. Periode yang sudah memiliki alokasi dibekukan.</p><div className="field-grid three"><Field label="Bulan berlaku"><input type="month" value={qm} onChange={e=>setQm(e.target.value)}/></Field><Field label="Posisi"><select value={pos} onChange={e=>{setPos(e.target.value);setLimit(POSITIONS.find(p=>p[0]===e.target.value)![2]);}}>{POSITIONS.map(([p,l])=><option key={p} value={p}>{l}</option>)}</select></Field><Field label="Kuota orang"><input type="number" min={0} max={1000} value={limit} onChange={e=>setLimit(+e.target.value)}/></Field></div><button className="button primary" disabled={busy} onClick={()=>save('quota',{month:qm,position:pos,limit})}>Simpan kuota periode</button><div className="quota-cards admin-quotas">{POSITIONS.map(([p,l,q])=><div key={p}><strong>{l}</strong><span>{data.policy.quotas[Object.keys(data.policy.quotas).filter(m=>m<=qm).sort().at(-1)??'']?.[p]??q}<small> orang</small></span></div>)}</div></div>}
    {tab==='calendar'&&<div className="admin-content"><div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:12}}><div><h2>Kalender kerja unit</h2><p className="muted">Pola kerja Senin–Jumat. Tambahkan libur atau hari kerja khusus. Perubahan H-3 yang menyentuh cuti aktif akan ditolak.</p></div><button type="button" className="button secondary" disabled={busy} onClick={()=>save('calendar/sync-2027',{})} title="Muat ulang seluruh hari libur nasional dan cuti bersama 2027">Sinkronkan Libur 2027</button></div><div className="field-grid three"><Field label="Tanggal pengecualian"><input type="date" min={today} value={date} onChange={e=>setDate(e.target.value)}/></Field><Field label="Keterangan"><input value={label} onChange={e=>setLabel(e.target.value)} placeholder="Contoh: libur unit"/></Field><Field label="Jenis hari"><select value={String(working)} onChange={e=>setWorking(e.target.value==='true')}><option value="false">Hari libur</option><option value="true">Hari kerja khusus</option></select></Field></div><button className="button primary" disabled={busy||!date||label.length<2} onClick={()=>save('calendar',{date,label,working})}>Simpan kalender</button><div style={{marginTop:24,display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:10}}><strong>Daftar Pengecualian & Libur ({Object.keys(data.policy.calendar.exceptions).length})</strong><div style={{display:'flex',gap:6}}>{['ALL','2026','2027'].map(y=><button key={y} type="button" className={'button '+(calYear===y?'primary':'secondary')} style={{minHeight:30,padding:'4px 10px',fontSize:11}} onClick={()=>setCalYear(y)}>{y==='ALL'?'Semua':y}</button>)}</div></div><div className="exception-list">{Object.entries(data.policy.calendar.exceptions).sort(([a],[b])=>a.localeCompare(b)).filter(([d])=>calYear==='ALL'||d.startsWith(calYear)).map(([d,v]:any)=><div key={d}><span><strong>{fmt(d,true)}</strong> · {v.label} · {v.working?'Kerja':'Libur'}</span><button className="text-button" disabled={busy} onClick={()=>save('calendar',{date:d,label:v.label,working:v.working,remove:true})}>Hapus pengecualian</button></div>)}</div></div>}
    {tab==='jobs'&&<div className="admin-content"><h2>Pengiriman notifikasi</h2><div className="alert info"><Mail size={18}/><span>CAPTURED berarti email ditampung lokal untuk simulasi, bukan terkirim ke inbox. Penerima SDM mengikuti akun SDM aktif pada unit ini.</span></div>{data.jobs.length?<div className="table-scroll"><table><thead><tr><th>Jenis</th><th>Jadwal</th><th>Status</th><th>Upaya gagal</th><th/></tr></thead><tbody>{data.jobs.map((j:any)=><tr key={j.id}><td>{j.kind}</td><td>{new Date(j.due_at).toLocaleString('id-ID',{timeZone:'Asia/Jakarta'})}</td><td>{j.state}<small>{j.last_error}</small></td><td>{j.attempts}</td><td>{j.state==='FAILED'&&<button className="text-button" disabled={busy} onClick={()=>save('jobs/'+j.id+'/retry',{})}>Coba ulang</button>}</td></tr>)}</tbody></table></div>:<Empty title="Belum ada email dalam antrean" text="Pengajuan baru dan keputusan SDM akan membuat notifikasi."/>}</div>}
    {tab==='audit'&&<div className="admin-content"><h2>Jejak aktivitas</h2>{data.audit.length?<div className="table-scroll"><table><thead><tr><th>Waktu</th><th>Pengguna</th><th>Aksi</th><th>Objek</th></tr></thead><tbody>{data.audit.map((a:any)=><tr key={a.id}><td>{new Date(a.at).toLocaleString('id-ID')}</td><td>{data.employees.find((e:Employee)=>e.id===a.actor_id)?.name??a.actor_id}</td><td>{a.action}</td><td className="mono">{a.object_id}</td></tr>)}</tbody></table></div>:<Empty title="Belum ada aktivitas tercatat"/>}</div>}
    {editing&&<Modal title={editing.id?'Edit karyawan':'Tambah karyawan'} onClose={()=>setEditing(null)}><form onSubmit={e=>{e.preventDefault();const {unit,...body}=editing;if(!body.password)delete body.password;save('employee',body);}}><Field label="Nama lengkap"><input required value={editing.name} onChange={e=>setEditing({...editing,name:e.target.value})}/></Field><div className="field-grid"><Field label="Email"><input type="email" required value={editing.email} onChange={e=>setEditing({...editing,email:e.target.value})}/></Field><Field label="Nomor HP"><input required value={editing.phone} onChange={e=>setEditing({...editing,phone:e.target.value})}/></Field></div><Field label="Posisi"><select value={editing.position} onChange={e=>setEditing({...editing,position:e.target.value})}>{POSITIONS.map(([p,l])=><option key={p} value={p}>{l}</option>)}</select></Field><Field label="Outlet"><select required value={editing.outletId??''} onChange={e=>setEditing({...editing,outletId:e.target.value})}><option value="" disabled>Pilih outlet</option>{data.outlets.map((o:any)=><option key={o.id} value={o.id}>{o.name}</option>)}</select></Field><Field label={editing.id?'Kata sandi baru (kosongkan jika tetap)':'Kata sandi awal'} hint={PASSWORD_HINT}><input type="password" minLength={6} maxLength={200} pattern={PASSWORD_PATTERN.source} title={PASSWORD_HINT} required={!editing.id} autoComplete="new-password" value={editing.password} onChange={e=>setEditing({...editing,password:e.target.value})}/></Field><div className="inline-actions">{['EMPLOYEE','SDM','ADMIN'].map(role=><label className="checkbox" key={role}><input type="checkbox" checked={editing.roles.includes(role)} onChange={e=>setEditing({...editing,roles:e.target.checked?[...editing.roles,role]:editing.roles.filter((r:string)=>r!==role)})}/>{role}</label>)}</div><label className="checkbox"><input type="checkbox" checked={editing.active} onChange={e=>setEditing({...editing,active:e.target.checked})}/>Akun aktif</label>{error&&<div className="alert danger">{error}</div>}<div className="modal-actions"><button className="button primary" disabled={busy}>Simpan karyawan</button></div></form></Modal>}
    {deleting&&<Modal compact title="Hapus karyawan?" onClose={()=>{if(!busy)setDeleting(null);}}><div className="decision-summary"><strong>{deleting.name}</strong><span>{deleting.email}</span></div><p className="reason-text">Karyawan akan dihapus dari daftar dan tidak bisa login. Riwayat cuti tetap tersimpan.</p>{deleteError&&<div className="alert danger" role="alert">{deleteError}</div>}<div className="modal-actions"><button className="button secondary" disabled={busy} onClick={()=>setDeleting(null)}>Batal</button><button className="button danger-button" disabled={busy} onClick={deleteEmployee}>{busy?'Menghapus…':'Hapus karyawan'}</button></div></Modal>}
  </section>;
}
