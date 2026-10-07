import { useEffect, useState } from 'react';
import { ShieldCheck, CheckCircle2, XCircle, ArrowLeft, Building2, Calendar, User, Clock, AlertTriangle } from 'lucide-react';

type VerificationData = {
  valid: boolean;
  id?: string;
  number?: string;
  employeeName?: string;
  unitName?: string;
  position?: string;
  category?: string;
  subtype?: string;
  status?: string;
  effectiveStart?: string;
  effectiveEnd?: string;
  duration?: number;
  replacement?: {
    employeeName: string;
    position: string;
    outletName?: string;
  };
  verifiedAt?: string;
  message?: string;
};

const fmtDate = (d?: string) =>
  d
    ? new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(
        new Date(d.length === 10 ? d + 'T00:00:00' : d)
      )
    : '—';

export function VerifyCertificate({ onBack }: { onBack: () => void }) {
  const [data, setData] = useState<VerificationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const hash = window.location.hash;
    const queryPart = hash.includes('?') ? hash.split('?')[1] : window.location.search.replace(/^\?/, '');
    const params = new URLSearchParams(queryPart);
    const num = params.get('num') || params.get('number');
    const id = params.get('id');

    if (!num && !id) {
      setError('Parameter nomor dokumen atau ID tidak ditemukan pada tautan verifikasi.');
      setLoading(false);
      return;
    }

    const endpoint = `/api/verify-certificate?${num ? `num=${encodeURIComponent(num)}` : ''}${id ? `&id=${encodeURIComponent(id)}` : ''}`;

    fetch(endpoint)
      .then(async (res) => {
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || 'Surat keterangan cuti tidak ditemukan dalam sistem perbankan BNI.');
        }
        return res.json();
      })
      .then((json: VerificationData) => {
        setData(json);
      })
      .catch((err: any) => {
        setError(err.message || 'Gagal memverifikasi dokumen.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return (
    <div className="verify-page-wrapper">
      <div className="verify-card">
        {/* Header Branding */}
        <div className="verify-header">
          <div className="verify-brand">
            <img src="/images/bni-logo.png" alt="BNI" className="verify-logo" />
            <div className="verify-titles">
              <h3>PT BANK NEGARA INDONESIA (PERSERO) Tbk</h3>
              <p>Layanan Verifikasi Dokumen Cuti Elektronik</p>
            </div>
          </div>
          <button type="button" className="button secondary verify-back-btn" onClick={onBack}>
            <ArrowLeft size={16} /> Ke Aplikasi
          </button>
        </div>

        <div className="verify-divider" />

        {loading ? (
          <div className="verify-loading">
            <div className="spinner" />
            <p>Memverifikasi tanda tangan digital & keaslian dokumen…</p>
          </div>
        ) : error || !data?.valid ? (
          <div className="verify-result error-state">
            <div className="verify-badge error">
              <XCircle size={36} color="#d9383a" />
              <div>
                <h2>DOKUMEN TIDAK TERVERIFIKASI</h2>
                <p>Data dokumen tidak ditemukan atau tautan verifikasi tidak valid.</p>
              </div>
            </div>

            <div className="verify-error-box">
              <AlertTriangle size={20} color="#d9383a" />
              <span>{error || data?.message || 'Nomor surat cuti tidak terdaftar di sistem BNI.'}</span>
            </div>

            <button type="button" className="button primary full-width" onClick={onBack}>
              Kembali ke Beranda
            </button>
          </div>
        ) : (
          <div className="verify-result success-state">
            {/* Verified Green Banner */}
            <div className="verify-badge success">
              <ShieldCheck size={40} color="#0e8362" />
              <div>
                <h2>DOKUMEN ASLI & TERVERIFIKASI</h2>
                <p>Surat Keterangan Cuti ini sah terdaftar pada pangkalan data Divisi SDM BNI.</p>
              </div>
            </div>

            {/* Document Info Card */}
            <div className="verify-details">
              <div className="verify-meta-row">
                <span className="verify-label">Nomor Dokumen:</span>
                <span className="verify-value doc-code">{data.number}</span>
              </div>
              <div className="verify-meta-row">
                <span className="verify-label">Status Persetujuan:</span>
                <span className="verify-status-tag">
                  <CheckCircle2 size={14} color="#0e8362" />
                  {data.status === 'APPROVED' ? 'DISETUJUI OLEH SDM' : data.status}
                </span>
              </div>

              <div className="verify-grid">
                <div className="verify-info-item">
                  <User size={16} className="item-icon" />
                  <div>
                    <small>Nama Pegawai</small>
                    <strong>{data.employeeName}</strong>
                  </div>
                </div>

                <div className="verify-info-item">
                  <Building2 size={16} className="item-icon" />
                  <div>
                    <small>Jabatan & Unit Kerja</small>
                    <strong>{data.position}</strong>
                    <div className="subtext">{data.unitName}</div>
                  </div>
                </div>

                <div className="verify-info-item">
                  <Calendar size={16} className="item-icon" />
                  <div>
                    <small>Periode & Durasi Cuti</small>
                    <strong>
                      {fmtDate(data.effectiveStart)} s/d {fmtDate(data.effectiveEnd)}
                    </strong>
                    <div className="subtext">{data.duration} Hari Kerja</div>
                  </div>
                </div>

                <div className="verify-info-item">
                  <Clock size={16} className="item-icon" />
                  <div>
                    <small>Kategori Cuti</small>
                    <strong>{data.category}</strong>
                    <div className="subtext">{data.subtype}</div>
                  </div>
                </div>
              </div>

              {data.replacement && (
                <div className="verify-pgs-box">
                  <strong>Pejabat Pengganti (PGS):</strong> {data.replacement.employeeName} ({data.replacement.position})
                </div>
              )}
            </div>

            {/* Verification Security Footer */}
            <div className="verify-footer-note">
              <small>
                <strong>Validasi Keamanan Sistem:</strong> Informasi ini diambil secara real-time langsung dari server terenkripsi PT Bank Negara Indonesia (Persero) Tbk. Dokumen ini sah tanpa tanda tangan basah dan memiliki kekuatan pembuktian elektronik sesuai regulasi yang berlaku.
              </small>
            </div>

            <button type="button" className="button secondary full-width" onClick={onBack}>
              Buka Portal Ruang Cuti BNI
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
