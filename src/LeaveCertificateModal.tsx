import {Printer,X,ShieldCheck,CheckCircle2} from 'lucide-react';
import type {Leave} from '../shared/domain';
import {QrCodeSvg} from './qr';

const fmtDate=(d:string)=>d?new Intl.DateTimeFormat('id-ID',{day:'numeric',month:'long',year:'numeric'}).format(new Date(d+'T00:00:00')):'—';

type Props={
  leave:Leave;
  unitName:string;
  positionName?:string;
  onClose:()=>void;
};

export function LeaveCertificateModal({leave:r,unitName,positionName,onClose}:Props){
  const printDoc=()=>{
    window.print();
  };

  const posLabel=r.positionName||positionName||r.position;
  const docNumber=`BNI/${unitName.replace(/[^a-zA-Z0-9]/g,'').toUpperCase()}/CUTI/${r.number}`;
  const verifyUrl=`${window.location.origin}/#verify?id=${encodeURIComponent(r.id)}&num=${encodeURIComponent(r.number)}`;

  return (
    <div className="modal-backdrop print-backdrop" onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div className="certificate-modal">
        <div className="certificate-toolbar no-print">
          <div className="toolbar-title">
            <ShieldCheck size={20} color="#006776"/>
            <strong>Surat Keterangan Cuti Elektronik</strong>
          </div>
          <div className="toolbar-actions">
            <button type="button" className="button primary" onClick={printDoc}>
              <Printer size={16}/>Cetak / Simpan PDF
            </button>
            <button type="button" className="icon-button" onClick={onClose} aria-label="Tutup">
              <X size={20}/>
            </button>
          </div>
        </div>

        <div className="printable-sheet">
          {/* Official Letterhead */}
          <div className="letterhead">
            <div className="letterhead-brand">
              <span className="bni-logo" style={{width:105}}>
                <img src="/images/bni-logo.png" alt="BNI" />
              </span>
            </div>
            <div className="letterhead-text">
              <h3>PT BANK NEGARA INDONESIA (PERSERO) Tbk</h3>
              <h4>DIVISI SUMBER DAYA MANUSIA</h4>
              <p>{unitName.toUpperCase()}</p>
            </div>
          </div>
          <div className="letterhead-divider">
            <div className="divider-teal"/>
            <div className="divider-orange"/>
          </div>

          {/* Title */}
          <div className="doc-heading">
            <h2>SURAT KETERANGAN PERSETUJUAN CUTI</h2>
            <span className="doc-num">Nomor: {docNumber}</span>
          </div>

          <p className="doc-intro">
            Berdasarkan verifikasi sistem manajemen kehadiran dan kuota kerja perbankan, dengan ini diterangkan bahwa pengajuan cuti pegawai berikut telah <strong>DISETUJUI</strong>:
          </p>

          {/* Employee & Leave Details Table */}
          <table className="doc-table">
            <tbody>
              <tr>
                <td style={{width:'32%'}}>Nama Pegawai</td>
                <td style={{width:'3%'}}>:</td>
                <td><strong>{r.employeeName}</strong></td>
              </tr>
              <tr>
                <td>Jabatan / Posisi</td>
                <td>:</td>
                <td>{posLabel}</td>
              </tr>
              <tr>
                <td>Kantor / Unit Kerja</td>
                <td>:</td>
                <td>{unitName}</td>
              </tr>
              <tr>
                <td>Kategori & Jenis Cuti</td>
                <td>:</td>
                <td>{r.category==='REGULAR'?'Cuti Reguler':'Cuti Darurat'} ({r.subtype})</td>
              </tr>
              <tr>
                <td>Tanggal Pelaksanaan</td>
                <td>:</td>
                <td><strong>{fmtDate(r.effectiveStart)} s/d {fmtDate(r.effectiveEnd)}</strong></td>
              </tr>
              <tr>
                <td>Durasi Efektif</td>
                <td>:</td>
                <td><strong>{r.duration} Hari Kerja</strong> (mengikuti kalender operasional cabang)</td>
              </tr>
              <tr>
                <td>Alasan Permohonan</td>
                <td>:</td>
                <td>{r.reason}</td>
              </tr>
              {r.replacement&&(
                <tr className="highlight-row">
                  <td>Pejabat Pengganti (PGS)</td>
                  <td>:</td>
                  <td>
                    <strong>{r.replacement.employeeName}</strong> ({r.replacement.position} · {r.replacement.outletName})
                  </td>
                </tr>
              )}
              <tr>
                <td>Kontak selama Cuti</td>
                <td>:</td>
                <td>{r.phone} / {r.email}</td>
              </tr>
            </tbody>
          </table>

          <div className="doc-stamp-container">
            <div className="official-stamp">
              <CheckCircle2 size={22} color="#0e8362"/>
              <div>
                <strong>DISETUJUI SECARA ELEKTRONIK</strong>
                <small>Validitas Terjamin Sistem Ruang Cuti BNI</small>
              </div>
            </div>
          </div>

          {/* Signatures & Security Verification */}
          <div className="doc-footer">
            <div className="qr-box">
              <QrCodeSvg value={verifyUrl} size={90}/>
              <div className="qr-desc">
                <small>
                  <strong>Kode Validasi Digital:</strong><br/>
                  {r.number}<br/>
                  Pindai kode QR untuk memastikan keaslian surat persetujuan cuti ini.
                </small>
              </div>
            </div>

            <div className="signature-box">
              <p>Diterbitkan pada: {fmtDate(r.effectiveStart.slice(0,10))}</p>
              <div className="signature-space">
                <span className="digital-sign-tag">Ditandatangani Secara Elektronik</span>
              </div>
              <strong>DIVISI SUMBER DAYA MANUSIA</strong>
              <p style={{fontSize:11,margin:'2px 0 0',color:'#6b7e85'}}>PT Bank Negara Indonesia (Persero) Tbk</p>
            </div>
          </div>

          <div className="doc-footnote">
            <small>Surat keterangan ini diterbitkan otomatis oleh Sistem Informasi Ruang Cuti BNI dan sah tanpa tanda tangan basah serta stempel manual.</small>
          </div>
        </div>
      </div>
    </div>
  );
}
