import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Leave, Employee } from '../shared/domain';
import { statusLabel } from '../shared/domain';

export function downloadPdfReport({
  rows,
  actor,
  month,
  unitName,
  positionLabelFn,
}: {
  rows: Leave[];
  actor: Employee;
  month: string;
  unitName: string;
  positionLabelFn?: (pos: string) => string;
}) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const getPosName = (code: string) => (positionLabelFn ? positionLabelFn(code) : code);

  let monthTitle = 'Semua Bulan (Keseluruhan Periode)';
  if (month && month !== 'all') {
    try {
      monthTitle = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(
        new Date(month + '-01T00:00:00')
      );
    } catch {
      monthTitle = month;
    }
  }

  const printDate =
    new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'full',
      timeStyle: 'medium',
      timeZone: 'Asia/Jakarta',
    }).format(new Date()) + ' WIB';

  // 1. Header BNI
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(0, 94, 84); // BNI Teal #005E54
  doc.text('PT BANK NEGARA INDONESIA (PERSERO) TBK', 14, 15);

  doc.setFontSize(10);
  doc.setTextColor(24, 57, 66);
  doc.text('LAPORAN MONITORING PENGAJUAN CUTI PEGAWAI', 14, 21);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(90, 115, 124);
  doc.text(
    `Unit Kerja: ${unitName} (${actor.unit})   |   Petugas SDM: ${actor.name} (${actor.positionName || getPosName(actor.position)})`,
    14,
    26
  );
  doc.text(`Periode: ${monthTitle}   |   Waktu Unduh: ${printDate}`, 14, 30);

  // Orange accent line across A4 Portrait printable width (x=14 to x=196 -> 182mm)
  doc.setDrawColor(241, 90, 34); // #F15A22
  doc.setLineWidth(0.8);
  doc.line(14, 33, 196, 33);

  // 2. Summary stats / KPI box
  const total = rows.length;
  const approved = rows.filter((r) => r.status === 'APPROVED').length;
  const pending = rows.filter((r) => r.status === 'PENDING_SDM').length;
  const rejected = rows.filter((r) => r.status === 'REJECTED').length;
  const totalDays = rows.reduce((acc, r) => acc + (r.duration || 0), 0);

  doc.setFillColor(248, 251, 252);
  doc.roundedRect(14, 36, 182, 8.5, 1.5, 1.5, 'F');
  doc.setDrawColor(220, 230, 233);
  doc.roundedRect(14, 36, 182, 8.5, 1.5, 1.5, 'S');

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 94, 84);
  doc.text('Ringkasan:', 17, 41.5);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 50, 58);
  doc.text(`Total: ${total} data`, 36, 41.5);
  doc.text(`Disetujui: ${approved}`, 64, 41.5);
  doc.text(`Menunggu: ${pending}`, 95, 41.5);
  doc.text(`Ditolak: ${rejected}`, 129, 41.5);
  doc.text(`Total Durasi: ${totalDays} hari kerja`, 150, 41.5);

  // 3. Data Table (Portrait width: 182mm)
  const tableData = rows.map((r, idx) => {
    const submitIso = r.submittedAt || r.createdAt;
    let submitFormatted = '—';
    if (submitIso) {
      try {
        const d = new Date(submitIso);
        const dateStr = new Intl.DateTimeFormat('id-ID', {
          timeZone: 'Asia/Jakarta',
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }).format(d);
        const timeStr =
          new Intl.DateTimeFormat('id-ID', {
            timeZone: 'Asia/Jakarta',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
          })
            .format(d)
            .replaceAll('.', ':') + ' WIB';
        submitFormatted = `${dateStr}\n${timeStr}`;
      } catch {
        submitFormatted = submitIso;
      }
    }

    const tglMulai = r.effectiveStart || r.start;
    const tglAkhir = r.effectiveEnd || r.end;
    const jadwal = tglMulai === tglAkhir ? tglMulai : `${tglMulai} s/d\n${tglAkhir}`;
    const kategori = `${r.category === 'REGULAR' ? 'Reguler' : 'Darurat'}\n(${r.subtype})`;
    const statusText = statusLabel[r.status] || r.status;

    return [
      String(idx + 1),
      r.number,
      r.employeeName,
      r.positionName || getPosName(r.position),
      kategori,
      jadwal,
      `${r.duration} hr`,
      statusText,
      submitFormatted,
    ];
  });

  autoTable(doc, {
    startY: 47.5,
    margin: { left: 14, right: 14 },
    tableWidth: 182,
    head: [
      [
        'No',
        'No. Pengajuan',
        'Nama Karyawan',
        'Jabatan',
        'Jenis Cuti',
        'Jadwal Cuti',
        'Durasi',
        'Status',
        'Waktu Diajukan',
      ],
    ],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [0, 94, 84], // Teal BNI #005E54
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'center',
      valign: 'middle',
    },
    styles: {
      fontSize: 7,
      cellPadding: 1.8,
      valign: 'middle',
      lineColor: [225, 233, 236],
      lineWidth: 0.1,
      font: 'helvetica',
      overflow: 'linebreak',
    },
    alternateRowStyles: {
      fillColor: [250, 252, 253],
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      1: { halign: 'center', cellWidth: 23 },
      2: { fontStyle: 'bold', cellWidth: 31 },
      3: { cellWidth: 20 },
      4: { cellWidth: 21 },
      5: { halign: 'center', cellWidth: 24 },
      6: { halign: 'center', cellWidth: 13 },
      7: { halign: 'center', cellWidth: 18 },
      8: { halign: 'center', cellWidth: 24 },
    },
    didDrawPage: (data) => {
      const pageCount = (doc as any).internal.getNumberOfPages();
      doc.setFontSize(7.5);
      doc.setTextColor(140, 160, 166);
      doc.text(
        `Halaman ${data.pageNumber} dari ${pageCount}   •   Sistem Monitoring Cuti Pegawai PT Bank Negara Indonesia (Persero) Tbk`,
        14,
        doc.internal.pageSize.height - 8
      );
    },
  });

  doc.save(`monitoring-cuti-${month}.pdf`);
}
