import {BarChart3,Users,AlertTriangle,CheckCircle2,CalendarDays,Clock,Briefcase,TrendingUp} from 'lucide-react';
import type {Leave,Quota} from '../shared/domain';

type Props={
  data:any;
  month:string;
  onSelect:(leave:Leave)=>void;
};

const monthName=(m:string)=>new Intl.DateTimeFormat('id-ID',{month:'long',year:'numeric'}).format(new Date(m+'-01T00:00:00'));

export function SdmAnalytics({data,month,onSelect:_onSelect}:Props){
  const requests:Leave[]=data.requests.filter((r:Leave)=>r.effectiveStart.startsWith(month)&&r.status!=='DRAFT');
  const quotas:Quota[]=data.quotas||[];

  const approved=requests.filter(r=>r.status==='APPROVED');
  const pending=requests.filter(r=>r.status==='PENDING_SDM');
  const rejected=requests.filter(r=>r.status==='REJECTED');
  const cancelled=requests.filter(r=>r.status==='WITHDRAWN');

  const regular=requests.filter(r=>r.category==='REGULAR');
  const emergency=requests.filter(r=>r.category==='EMERGENCY');

  const totalDays=approved.reduce((s,r)=>s+r.duration,0);
  const avgDays=approved.length?Math.round((totalDays/approved.length)*10)/10:0;
  const pgsCount=approved.filter(r=>Boolean(r.replacement)).length;

  const totalLimit=quotas.reduce((s,q)=>s+q.limit,0);
  const totalUsed=quotas.reduce((s,q)=>s+q.used,0);
  const overallUsedPct=totalLimit?Math.min(100,Math.round((totalUsed/totalLimit)*100)):0;

  // Find position with highest capacity usage
  const sortedQuotas=[...quotas].sort((a,b)=>{
    const pctA=a.limit?a.used/a.limit:0;
    const pctB=b.limit?b.used/b.limit:0;
    return pctB-pctA;
  });
  const mostCrowded=sortedQuotas[0];

  return (
    <div className="analytics-view">
      {/* Top summary KPI cards */}
      <div className="analytics-kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon teal"><BarChart3 size={20}/></div>
          <div>
            <span className="kpi-label">Serapan Kuota Unit</span>
            <div className="kpi-val">{overallUsedPct}%<small> dari {totalLimit} orang</small></div>
            <p className="kpi-note">{totalUsed} dari {totalLimit} slot posisi terisi</p>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon orange"><Clock size={20}/></div>
          <div>
            <span className="kpi-label">Rata-rata Durasi Cuti</span>
            <div className="kpi-val">{avgDays}<small> hari kerja</small></div>
            <p className="kpi-note">Total {totalDays} hari kerja disetujui</p>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon green"><Briefcase size={20}/></div>
          <div>
            <span className="kpi-label">Tugas PGS Aktif</span>
            <div className="kpi-val">{pgsCount}<small> penugasan</small></div>
            <p className="kpi-note">Pejabat pengganti sementara ditunjuk</p>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon blue"><TrendingUp size={20}/></div>
          <div>
            <span className="kpi-label">Rasio Jenis Cuti</span>
            <div className="kpi-val">{regular.length} : {emergency.length}</div>
            <p className="kpi-note">{regular.length} Reguler, {emergency.length} Darurat</p>
          </div>
        </div>
      </div>

      <div className="analytics-grid">
        {/* Posisi & Keterisian Kuota Bar Chart */}
        <section className="panel analytics-panel">
          <div className="panel-heading">
            <div>
              <h2>Utilisasi Kuota per Posisi Layanan</h2>
              <p>{monthName(month)} · Kapasitas perbankan cabang</p>
            </div>
            <Users size={19} className="muted"/>
          </div>

          <div className="position-bar-list">
            {quotas.map(q=>{
              const pct=q.limit?Math.min(100,Math.round((q.used/q.limit)*100)):0;
              const isFull=pct>=100;
              const isWarning=pct>=75&&!isFull;

              return (
                <div key={q.position} className="position-bar-item">
                  <div className="bar-header">
                    <span className="bar-title">
                      <strong>{q.label}</strong>
                      {isFull&&<span className="status-pill full">Kuota Penuh</span>}
                      {isWarning&&<span className="status-pill warning">Kritis</span>}
                    </span>
                    <span className="bar-numbers">
                      <b>{q.used}</b> / {q.limit} orang ({pct}%)
                    </span>
                  </div>

                  <div className="bar-track">
                    <div className="bar-fill-approved" style={{width:`${q.limit?Math.min(100,(q.approved/q.limit)*100):0}%`}} title={`Disetujui: ${q.approved} orang`}/>
                    <div className="bar-fill-pending" style={{width:`${q.limit?Math.min(100,(q.pending/q.limit)*100):0}%`}} title={`Menunggu review: ${q.pending} orang`}/>
                  </div>

                  <div className="bar-meta">
                    <small>{q.available} slot tersisa</small>
                    <small>{q.approved} disetujui · {q.pending} menunggu</small>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="legend" style={{padding:'14px 23px'}}>
            <span><i className="teal-dot"/>Disetujui</span>
            <span><i className="orange-dot"/>Menunggu review</span>
            <span><i className="gray-dot"/>Slot kosong</span>
          </div>
        </section>

        {/* Status Distribution & Smart Insights */}
        <section className="panel analytics-panel">
          <div className="panel-heading">
            <div>
              <h2>Distribusi Status Permohonan</h2>
              <p>Total {requests.length} pengajuan pada periode ini</p>
            </div>
            <BarChart3 size={19} className="muted"/>
          </div>

          <div className="status-pie-summary">
            {[
              {label:'Disetujui',count:approved.length,color:'#0e8362',bg:'#e8f6f0'},
              {label:'Menunggu Review SDM',count:pending.length,color:'#d97706',bg:'#fef3c7'},
              {label:'Ditolak',count:rejected.length,color:'#dc2626',bg:'#fee2e2'},
              {label:'Dibatalkan',count:cancelled.length,color:'#64748b',bg:'#f1f5f9'},
            ].map(item=>(
              <div key={item.label} className="status-progress-row">
                <div className="status-info">
                  <span className="status-color-dot" style={{background:item.color}}/>
                  <span>{item.label}</span>
                  <strong>{item.count}</strong>
                </div>
                <div className="status-bar-bg" style={{background:item.bg}}>
                  <div className="status-bar-inner" style={{width:`${requests.length?Math.min(100,(item.count/requests.length)*100):0}%`,background:item.color}}/>
                </div>
              </div>
            ))}
          </div>

          <div className="smart-insights-box">
            <h4>Wawasan Manajemen SDM ({monthName(month)})</h4>
            <ul>
              {mostCrowded&&(
                <li>
                  <AlertTriangle size={15} color="#d97706"/>
                  <span>
                    Posisi <strong>{mostCrowded.label}</strong> mencatat tingkat serapan tertinggi yaitu <strong>{mostCrowded.used} dari {mostCrowded.limit} orang</strong>.
                  </span>
                </li>
              )}
              <li>
                <CheckCircle2 size={15} color="#0e8362"/>
                <span>
                  Sebanyak <strong>{pgsCount} dari {approved.length}</strong> pegawai cuti yang disetujui telah memiliki Pejabat Pengganti Sementara (PGS) yang valid.
                </span>
              </li>
              <li>
                <CalendarDays size={15} color="#006776"/>
                <span>
                  Batas perlindungan H-3 akhir bulan aktif menjaga integritas operasional tutup buku cabang.
                </span>
              </li>
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
