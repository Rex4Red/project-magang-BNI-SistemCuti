import type {ReplacementCheck} from '../shared/domain';
import {useDirectory} from './DirectoryContext';
import {CheckCircle2} from 'lucide-react';
export function ReplacementPanel({check,error,refresh,selected,onSelect}:{check:ReplacementCheck|null;error:string;refresh:()=>void;selected:string;onSelect:(id:string)=>void}){
  const {positionLabel}=useDirectory();
  const unavailable=!!selected&&!check?.candidates.some(c=>c.id===selected&&c.available);
  const selectedCandidate=selected?check?.candidates.find(c=>c.id===selected):null;
  return <section className="pgs-panel"><div className="pgs-heading"><h4>Pengganti sementara (PGS)</h4><button type="button" className="text-button" onClick={refresh}>Periksa ulang</button></div>
    {error?<p role="alert">{error}</p>:!check?<p role="status">Memeriksa pengganti…</p>:!check.rule?.enabled?<p>Aturan PGS {check.rule?'belum aktif':'belum diatur'} untuk posisi ini. Admin dapat mengaturnya melalui Administrasi → Aturan PGS.</p>:<>
      <p>Outlet asal: <strong>{check.outletName}</strong> · Posisi pengganti: {check.rule.sourcePositions.map(positionLabel).join(', ')}</p>
      <p className={check.candidates.some(c=>c.available)?'pgs-available':'pgs-unavailable'}>{check.candidates.filter(c=>c.available).length} calon tersedia selama seluruh tanggal cuti.</p>
      {check.candidates.length?<ul className="pgs-candidates">{check.candidates.map(c=><li key={c.id}><div><strong>{c.name}</strong><span>Jabatan: {c.positionName||positionLabel(c.position)} · {c.outletName}</span></div><span>{c.reason}</span></li>)}</ul>:<p>Belum ada karyawan aktif yang sesuai posisi dan outlet pada aturan. Hubungi administrator.</p>}
      <label className="field"><span>Tetapkan PGS (opsional)</span><select value={selected} onChange={e=>onSelect(e.target.value)}><option value="">Hanya periksa ketersediaan</option>{unavailable&&<option value={selected} disabled>PGS yang dipilih tidak tersedia</option>}{check.candidates.filter(c=>c.available).map(c=><option key={c.id} value={c.id}>{c.name} ({c.positionName||positionLabel(c.position)}) · {c.outletName}</option>)}</select><small>Pilih nama untuk mencatat tugas PGS dan mencegah jadwal ganda.</small></label>
      {selectedCandidate&&selectedCandidate.available&&<div className="alert info" style={{marginTop:12,display:'flex',alignItems:'flex-start',gap:10}}><CheckCircle2 size={18} style={{color:'#1f7a63',flexShrink:0,marginTop:2}}/><div><strong style={{color:'#1b5e4d',fontSize:12}}>Notifikasi PGS Terpilih: {selectedCandidate.name} ({selectedCandidate.positionName||positionLabel(selectedCandidate.position)} · {selectedCandidate.outletName})</strong><p style={{margin:'4px 0 0',fontSize:11,lineHeight:1.6,color:'#376358'}}>Pemberitahuan penugasan PGS akan otomatis dikirimkan ke <strong>{selectedCandidate.name}</strong> saat keputusan persetujuan cuti ini disimpan.</p></div></div>}
      {unavailable&&<p role="alert" className="pgs-unavailable">PGS yang dipilih tidak tersedia. Pilih calon lain atau hanya periksa ketersediaan.</p>}
    </>}
    {selected&&check&&!check.rule?.enabled&&<button type="button" className="button secondary" onClick={()=>onSelect('')}>Hapus pilihan PGS</button>}
  </section>;
}
