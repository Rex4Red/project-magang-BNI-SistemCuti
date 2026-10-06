import type {ReplacementCheck} from '../shared/domain';
import {useDirectory} from './DirectoryContext';
export function ReplacementPanel({check,error,refresh,selected,onSelect}:{check:ReplacementCheck|null;error:string;refresh:()=>void;selected:string;onSelect:(id:string)=>void}){
  const {positionLabel}=useDirectory();
  const unavailable=!!selected&&!check?.candidates.some(c=>c.id===selected&&c.available);
  return <section className="pgs-panel"><div className="pgs-heading"><h4>Pengganti sementara (PGS)</h4><button type="button" className="text-button" onClick={refresh}>Periksa ulang</button></div>
    {error?<p role="alert">{error}</p>:!check?<p role="status">Memeriksa pengganti…</p>:!check.rule?.enabled?<p>Aturan PGS {check.rule?'belum aktif':'belum diatur'} untuk posisi ini. Admin dapat mengaturnya melalui Administrasi → Aturan PGS.</p>:<>
      <p>Outlet asal: <strong>{check.outletName}</strong> · Posisi pengganti: {check.rule.sourcePositions.map(positionLabel).join(', ')}</p>
      <p className={check.candidates.some(c=>c.available)?'pgs-available':'pgs-unavailable'}>{check.candidates.filter(c=>c.available).length} calon tersedia selama seluruh tanggal cuti.</p>
      {check.candidates.length?<ul className="pgs-candidates">{check.candidates.map(c=><li key={c.id}><div><strong>{c.name}</strong><span>{positionLabel(c.position)} · {c.outletName}</span></div><span>{c.reason}</span></li>)}</ul>:<p>Belum ada karyawan aktif yang sesuai posisi dan outlet pada aturan. Hubungi administrator.</p>}
      <label className="field"><span>Tetapkan PGS (opsional)</span><select value={selected} onChange={e=>onSelect(e.target.value)}><option value="">Hanya periksa ketersediaan</option>{unavailable&&<option value={selected} disabled>PGS yang dipilih tidak tersedia</option>}{check.candidates.filter(c=>c.available).map(c=><option key={c.id} value={c.id}>{c.name} · {c.outletName}</option>)}</select><small>Pilih nama untuk mencatat tugas PGS dan mencegah jadwal ganda.</small></label>
      {unavailable&&<p role="alert" className="pgs-unavailable">PGS yang dipilih tidak tersedia. Pilih calon lain atau hanya periksa ketersediaan.</p>}
    </>}
    {selected&&check&&!check.rule?.enabled&&<button type="button" className="button secondary" onClick={()=>onSelect('')}>Hapus pilihan PGS</button>}
  </section>;
}
