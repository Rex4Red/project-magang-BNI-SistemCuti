import ExcelJS from 'exceljs';
import { type Leave, type Employee, statusLabel, positionLabel } from '../shared/domain';

function sanitizeCell(val: string | number | null | undefined): string | number {
  if (val === null || val === undefined) return '';
  if (typeof val === 'number') return val;
  const str = String(val);
  if (/^[=+@-]/.test(str)) {
    return "'" + str;
  }
  return str;
}

function formatMonthLabel(m: string): string {
  if (m === 'all') return 'Semua Bulan (Keseluruhan Periode)';
  try {
    return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(new Date(m + '-01T00:00:00'));
  } catch {
    return m;
  }
}

export async function buildXlsxReport(
  rows: Leave[],
  actor: Employee,
  month: string,
  now: Date = new Date()
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Sistem Monitoring Cuti BNI';
  wb.lastModifiedBy = actor.name;
  wb.created = now;
  wb.modified = now;

  const ws = wb.addWorksheet('Monitoring Cuti Pegawai', {
    views: [{ showGridLines: true }],
    pageSetup: {
      paperSize: 9, // A4
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
  });

  // Set column widths
  ws.columns = [
    { key: 'colA', width: 6 },  // No.
    { key: 'colB', width: 24 }, // No. Pengajuan
    { key: 'colC', width: 26 }, // Nama Pegawai
    { key: 'colD', width: 20 }, // Posisi / Jabatan
    { key: 'colE', width: 14 }, // Kategori
    { key: 'colF', width: 20 }, // Jenis Cuti
    { key: 'colG', width: 14 }, // Tgl Mulai
    { key: 'colH', width: 14 }, // Tgl Akhir
    { key: 'colI', width: 14 }, // Hari Kerja
    { key: 'colJ', width: 20 }, // Status
    { key: 'colK', width: 16 }, // Tgl Diajukan
  ];

  const fontSegoe = 'Segoe UI';
  const borderThin: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  };

  const printDate = new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'full',
    timeStyle: 'medium',
    timeZone: 'Asia/Jakarta',
  }).format(now);

  const totalRequests = rows.length;
  const approvedRows = rows.filter((r) => r.status === 'APPROVED');
  const pendingRows = rows.filter((r) => r.status === 'PENDING_SDM');
  const rejectedRows = rows.filter((r) => r.status === 'REJECTED');
  const withdrawnRows = rows.filter((r) => r.status === 'WITHDRAWN');

  const totalDuration = rows.reduce((acc, r) => acc + (r.duration || 0), 0);
  const approvedDuration = approvedRows.reduce((acc, r) => acc + (r.duration || 0), 0);
  const pendingDuration = pendingRows.reduce((acc, r) => acc + (r.duration || 0), 0);
  const rejectedDuration = rejectedRows.reduce((acc, r) => acc + (r.duration || 0), 0);
  const withdrawnDuration = withdrawnRows.reduce((acc, r) => acc + (r.duration || 0), 0);

  const regularRows = rows.filter((r) => r.category === 'REGULAR');
  const emergencyRows = rows.filter((r) => r.category === 'EMERGENCY');
  const regularDuration = regularRows.reduce((acc, r) => acc + (r.duration || 0), 0);
  const emergencyDuration = emergencyRows.reduce((acc, r) => acc + (r.duration || 0), 0);

  // 1. HEADER BANNER
  let currentRow = 2;

  // Title
  ws.mergeCells(`A${currentRow}:K${currentRow}`);
  const titleCell = ws.getCell(`A${currentRow}`);
  titleCell.value = 'PT BANK NEGARA INDONESIA (PERSERO) TBK';
  titleCell.font = { name: fontSegoe, size: 16, bold: true, color: { argb: 'FF005E54' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(currentRow).height = 28;

  currentRow++;
  // Subtitle
  ws.mergeCells(`A${currentRow}:K${currentRow}`);
  const subCell = ws.getCell(`A${currentRow}`);
  subCell.value = 'LAPORAN MONITORING PENGAJUAN CUTI PEGAWAI';
  subCell.font = { name: fontSegoe, size: 12, bold: true, color: { argb: 'FF002D3B' } };
  subCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(currentRow).height = 22;

  currentRow++;
  // Orange Accent Bar
  ws.mergeCells(`A${currentRow}:K${currentRow}`);
  const accentCell = ws.getCell(`A${currentRow}`);
  accentCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF15A22' } };
  ws.getRow(currentRow).height = 5;

  currentRow += 2;

  // 2. METADATA INFO BOX
  const metaStart = currentRow;
  // Row 1
  ws.getCell(`B${currentRow}`).value = 'Unit Kerja';
  ws.getCell(`B${currentRow}`).font = { name: fontSegoe, size: 9.5, bold: true, color: { argb: 'FF475569' } };
  ws.getCell(`C${currentRow}`).value = `: ${actor.unit}`;
  ws.getCell(`C${currentRow}`).font = { name: fontSegoe, size: 9.5, bold: true, color: { argb: 'FF0F172A' } };

  ws.getCell(`G${currentRow}`).value = 'Periode Monitoring';
  ws.getCell(`G${currentRow}`).font = { name: fontSegoe, size: 9.5, bold: true, color: { argb: 'FF475569' } };
  ws.getCell(`H${currentRow}`).value = `: ${formatMonthLabel(month)}`;
  ws.getCell(`H${currentRow}`).font = { name: fontSegoe, size: 9.5, bold: true, color: { argb: 'FF0F172A' } };
  ws.getRow(currentRow).height = 20;

  currentRow++;
  // Row 2
  ws.getCell(`B${currentRow}`).value = 'Petugas SDM';
  ws.getCell(`B${currentRow}`).font = { name: fontSegoe, size: 9.5, bold: true, color: { argb: 'FF475569' } };
  ws.getCell(`C${currentRow}`).value = `: ${actor.name} (${(actor.positionName??positionLabel(actor.position))})`;
  ws.getCell(`C${currentRow}`).font = { name: fontSegoe, size: 9.5, color: { argb: 'FF0F172A' } };

  ws.getCell(`G${currentRow}`).value = 'Waktu Ekspor';
  ws.getCell(`G${currentRow}`).font = { name: fontSegoe, size: 9.5, bold: true, color: { argb: 'FF475569' } };
  ws.getCell(`H${currentRow}`).value = `: ${printDate}`;
  ws.getCell(`H${currentRow}`).font = { name: fontSegoe, size: 9.5, color: { argb: 'FF0F172A' } };
  ws.getRow(currentRow).height = 20;

  currentRow++;
  // Row 3
  ws.getCell(`B${currentRow}`).value = 'Klasifikasi';
  ws.getCell(`B${currentRow}`).font = { name: fontSegoe, size: 9.5, bold: true, color: { argb: 'FF475569' } };
  ws.getCell(`C${currentRow}`).value = ': Dokumen Internal SDM BNI';
  ws.getCell(`C${currentRow}`).font = { name: fontSegoe, size: 9.5, bold: true, color: { argb: 'FF005E54' } };

  ws.getCell(`G${currentRow}`).value = 'Total Pengajuan';
  ws.getCell(`G${currentRow}`).font = { name: fontSegoe, size: 9.5, bold: true, color: { argb: 'FF475569' } };
  ws.getCell(`H${currentRow}`).value = `: ${totalRequests} Pengajuan (${totalDuration} Hari Kerja)`;
  ws.getCell(`H${currentRow}`).font = { name: fontSegoe, size: 9.5, bold: true, color: { argb: 'FF0F172A' } };
  ws.getRow(currentRow).height = 20;

  // Apply light background to metadata area
  for (let r = metaStart; r <= currentRow; r++) {
    for (let c = 2; c <= 11; c++) {
      const cell = ws.getRow(r).getCell(c);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      cell.border = {
        top: r === metaStart ? { style: 'thin', color: { argb: 'FFCBD5E1' } } : undefined,
        bottom: r === currentRow ? { style: 'thin', color: { argb: 'FFCBD5E1' } } : undefined,
        left: c === 2 ? { style: 'thin', color: { argb: 'FFCBD5E1' } } : undefined,
        right: c === 11 ? { style: 'thin', color: { argb: 'FFCBD5E1' } } : undefined,
      };
    }
  }

  currentRow += 2;

  // 3. TABEL RINGKASAN MONITORING CUTI
  ws.getCell(`A${currentRow}`).value = 'I. RINGKASAN MONITORING CUTI';
  ws.getCell(`A${currentRow}`).font = { name: fontSegoe, size: 11, bold: true, color: { argb: 'FF005E54' } };
  currentRow++;

  // Summary Table Header
  const sumHeaderRow = currentRow;
  ws.mergeCells(`B${sumHeaderRow}:D${sumHeaderRow}`);
  ws.getCell(`B${sumHeaderRow}`).value = 'Status / Kategori Cuti';

  ws.mergeCells(`E${sumHeaderRow}:F${sumHeaderRow}`);
  ws.getCell(`E${sumHeaderRow}`).value = 'Jumlah Pengajuan';

  ws.mergeCells(`G${sumHeaderRow}:H${sumHeaderRow}`);
  ws.getCell(`G${sumHeaderRow}`).value = 'Hari Kerja';

  ws.mergeCells(`I${sumHeaderRow}:K${sumHeaderRow}`);
  ws.getCell(`I${sumHeaderRow}`).value = 'Keterangan';

  ws.getRow(sumHeaderRow).height = 24;
  for (let c = 2; c <= 11; c++) {
    const cell = ws.getRow(sumHeaderRow).getCell(c);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF002D3B' } };
    cell.font = { name: fontSegoe, size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = borderThin;
  }

  const summaryItems = [
    {
      label: 'Total Pengajuan Diproses',
      count: totalRequests,
      days: `${totalDuration} hari`,
      desc: 'Semua pengajuan cuti resmi tercatat',
      color: 'FF0F172A',
      bold: true,
      bg: 'FFFFFFFF',
    },
    {
      label: '● Disetujui (Approved)',
      count: approvedRows.length,
      days: `${approvedDuration} hari`,
      desc: 'Pengajuan telah disahkan SDM & kuota terpakai',
      color: 'FF166534',
      bold: true,
      bg: 'FFF8FAFC',
    },
    {
      label: '● Menunggu Review SDM',
      count: pendingRows.length,
      days: `${pendingDuration} hari`,
      desc: 'Menunggu keputusan SDM / konfirmasi H-3',
      color: 'FF854D0E',
      bold: true,
      bg: 'FFFFFFFF',
    },
    {
      label: '● Ditolak (Rejected)',
      count: rejectedRows.length,
      days: `${rejectedDuration} hari`,
      desc: 'Pengajuan ditolak oleh SDM',
      color: 'FF991B1B',
      bold: true,
      bg: 'FFF8FAFC',
    },
  ];

  if (withdrawnRows.length > 0) {
    summaryItems.push({
      label: '● Ditarik (Withdrawn)',
      count: withdrawnRows.length,
      days: `${withdrawnDuration} hari`,
      desc: 'Dibatalkan oleh pemohon sebelum persetujuan',
      color: 'FF64748B',
      bold: false,
      bg: 'FFFFFFFF',
    });
  }

  for (const item of summaryItems) {
    currentRow++;
    const r = currentRow;
    ws.mergeCells(`B${r}:D${r}`);
    ws.getCell(`B${r}`).value = item.label;

    ws.mergeCells(`E${r}:F${r}`);
    ws.getCell(`E${r}`).value = item.count;

    ws.mergeCells(`G${r}:H${r}`);
    ws.getCell(`G${r}`).value = item.days;

    ws.mergeCells(`I${r}:K${r}`);
    ws.getCell(`I${r}`).value = item.desc;

    ws.getRow(r).height = 21;
    for (let c = 2; c <= 11; c++) {
      const cell = ws.getRow(r).getCell(c);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: item.bg } };
      cell.border = borderThin;
      cell.font = { name: fontSegoe, size: 9, bold: item.bold, color: { argb: item.color } };
      cell.alignment = {
        vertical: 'middle',
        horizontal: c >= 5 && c <= 8 ? 'center' : 'left',
      };
    }
  }

  // Summary Category Row
  currentRow++;
  const catRow = currentRow;
  ws.mergeCells(`B${catRow}:K${catRow}`);
  ws.getCell(`B${catRow}`).value = `Distribusi Kategori Cuti: Reguler: ${regularRows.length} pengajuan (${regularDuration} hari kerja)  |  Darurat: ${emergencyRows.length} pengajuan (${emergencyDuration} hari kerja)`;
  ws.getRow(catRow).height = 22;
  for (let c = 2; c <= 11; c++) {
    const cell = ws.getRow(catRow).getCell(c);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    cell.border = borderThin;
    cell.font = { name: fontSegoe, size: 9, bold: true, color: { argb: 'FF334155' } };
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
  }

  currentRow += 2;

  // 4. TABEL RINCIAN DATA PENGAJUAN (DETAIL TABLE)
  ws.getCell(`A${currentRow}`).value = 'II. RINCIAN DATA PENGAJUAN CUTI';
  ws.getCell(`A${currentRow}`).font = { name: fontSegoe, size: 11, bold: true, color: { argb: 'FF005E54' } };
  currentRow++;

  const tableHeaderRow = currentRow;
  const tableHeaders = [
    'No.',
    'Nomor Pengajuan',
    'Nama Pegawai',
    'Posisi / Jabatan',
    'Kategori',
    'Jenis Cuti',
    'Tgl Mulai',
    'Tgl Akhir',
    'Hari Kerja',
    'Status',
    'Tgl Diajukan',
  ];

  ws.getRow(tableHeaderRow).height = 26;
  tableHeaders.forEach((h, idx) => {
    const colNum = idx + 1;
    const cell = ws.getRow(tableHeaderRow).getCell(colNum);
    cell.value = h;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF005E54' } };
    cell.font = { name: fontSegoe, size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = borderThin;
  });

  if (rows.length === 0) {
    currentRow++;
    const emptyRow = currentRow;
    ws.mergeCells(`A${emptyRow}:K${emptyRow}`);
    const emptyCell = ws.getCell(`A${emptyRow}`);
    emptyCell.value = 'Tidak ada data pengajuan cuti untuk periode yang dipilih.';
    emptyCell.font = { name: fontSegoe, size: 9.5, italic: true, color: { argb: 'FF64748B' } };
    emptyCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(emptyRow).height = 36;
    for (let c = 1; c <= 11; c++) {
      ws.getRow(emptyRow).getCell(c).border = borderThin;
    }
  } else {
    rows.forEach((r, idx) => {
      currentRow++;
      const rowNum = currentRow;
      const isEven = idx % 2 === 0;
      const rowBg = isEven ? 'FFFFFFFF' : 'FFF8FAFC';
      ws.getRow(rowNum).height = 22;

      const categoryText = r.category === 'REGULAR' ? 'Reguler' : 'Darurat';
      const submittedDate = r.submittedAt ? r.submittedAt.slice(0, 10) : (r.createdAt ? r.createdAt.slice(0, 10) : '-');
      const statusText = statusLabel[r.status] || r.status;

      let badgeBg = 'FFE2E8F0';
      let badgeColor = 'FF475569';
      if (r.status === 'APPROVED') {
        badgeBg = 'FFDCFCE7';
        badgeColor = 'FF166534';
      } else if (r.status === 'PENDING_SDM') {
        badgeBg = 'FFFEF9C3';
        badgeColor = 'FF854D0E';
      } else if (r.status === 'REJECTED') {
        badgeBg = 'FFFEE2E2';
        badgeColor = 'FF991B1B';
      } else if (r.status === 'WITHDRAWN') {
        badgeBg = 'FFF1F5F9';
        badgeColor = 'FF64748B';
      }

      const values = [
        idx + 1,
        sanitizeCell(r.number),
        sanitizeCell(r.employeeName),
        sanitizeCell((r.positionName??positionLabel(r.position))),
        sanitizeCell(categoryText),
        sanitizeCell(r.subtype || '-'),
        sanitizeCell(r.effectiveStart || r.start),
        sanitizeCell(r.effectiveEnd || r.end),
        r.duration,
        sanitizeCell(statusText),
        sanitizeCell(submittedDate),
      ];

      values.forEach((val, cIdx) => {
        const colNum = cIdx + 1;
        const cell = ws.getRow(rowNum).getCell(colNum);
        cell.value = val;
        cell.border = borderThin;

        if (colNum === 10) {
          // Status column with badge style
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: badgeBg } };
          cell.font = { name: fontSegoe, size: 9, bold: true, color: { argb: badgeColor } };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
          cell.font = {
            name: colNum === 2 ? 'Consolas' : fontSegoe,
            size: colNum === 2 ? 8.5 : 9,
            bold: colNum === 3 || colNum === 9,
            color: { argb: 'FF0F172A' },
          };
          cell.alignment = {
            vertical: 'middle',
            horizontal:
              colNum === 1 || colNum === 2 || colNum === 5 || colNum === 7 || colNum === 8 || colNum === 9 || colNum === 11
                ? 'center'
                : 'left',
          };
        }
      });
    });

    // Total Row
    currentRow++;
    const totalRow = currentRow;
    ws.mergeCells(`A${totalRow}:H${totalRow}`);
    const totLabel = ws.getCell(`A${totalRow}`);
    totLabel.value = 'TOTAL HARI KERJA CUTI:';
    totLabel.font = { name: fontSegoe, size: 9.5, bold: true, color: { argb: 'FF0F172A' } };
    totLabel.alignment = { horizontal: 'right', vertical: 'middle' };

    const totDays = ws.getCell(`I${totalRow}`);
    totDays.value = totalDuration;
    totDays.font = { name: fontSegoe, size: 10, bold: true, color: { argb: 'FF005E54' } };
    totDays.alignment = { horizontal: 'center', vertical: 'middle' };

    ws.mergeCells(`J${totalRow}:K${totalRow}`);
    const totCount = ws.getCell(`J${totalRow}`);
    totCount.value = `(${totalRequests} Pengajuan)`;
    totCount.font = { name: fontSegoe, size: 8.5, bold: true, color: { argb: 'FF475569' } };
    totCount.alignment = { horizontal: 'center', vertical: 'middle' };

    ws.getRow(totalRow).height = 24;
    for (let c = 1; c <= 11; c++) {
      const cell = ws.getRow(totalRow).getCell(c);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF64748B' } },
        bottom: { style: 'double', color: { argb: 'FF64748B' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      };
    }
  }

  currentRow += 2;

  // 5. LEMBAR PENGESAHAN / TANDA TANGAN
  const sigRowStart = currentRow;
  ws.getCell(`B${currentRow}`).value = 'Dibuat oleh,';
  ws.getCell(`B${currentRow}`).font = { name: fontSegoe, size: 9.5 };
  ws.getCell(`I${currentRow}`).value = 'Mengetahui,';
  ws.getCell(`I${currentRow}`).font = { name: fontSegoe, size: 9.5 };

  currentRow++;
  ws.getCell(`B${currentRow}`).value = 'Petugas SDM Unit';
  ws.getCell(`B${currentRow}`).font = { name: fontSegoe, size: 9.5, bold: true };
  ws.getCell(`I${currentRow}`).value = 'Pemimpin Unit Kerja';
  ws.getCell(`I${currentRow}`).font = { name: fontSegoe, size: 9.5, bold: true };

  currentRow += 3;
  ws.getCell(`B${currentRow}`).value = actor.name;
  ws.getCell(`B${currentRow}`).font = { name: fontSegoe, size: 9.5, bold: true, underline: true };
  ws.getCell(`I${currentRow}`).value = '( .................................................. )';
  ws.getCell(`I${currentRow}`).font = { name: fontSegoe, size: 9.5, bold: true };

  currentRow++;
  ws.getCell(`B${currentRow}`).value = (actor.positionName??positionLabel(actor.position));
  ws.getCell(`B${currentRow}`).font = { name: fontSegoe, size: 8.5, color: { argb: 'FF475569' } };
  ws.getCell(`I${currentRow}`).value = actor.unit;
  ws.getCell(`I${currentRow}`).font = { name: fontSegoe, size: 8.5, color: { argb: 'FF475569' } };

  currentRow += 2;

  // 6. CATATAN & DISCLAIMER
  const disclaimers = [
    '* Dokumen ini diunduh secara resmi melalui Sistem Monitoring Cuti BNI.',
    '* Alasan pribadi pemohon dilindungi dan dikecualikan secara sistem dari dokumen ekspor ini.',
    '* Seluruh data dalam laporan ini bersifat rahasia dan hanya digunakan untuk keperluan monitoring SDM internal PT Bank Negara Indonesia (Persero) Tbk.',
  ];

  for (const line of disclaimers) {
    ws.mergeCells(`A${currentRow}:K${currentRow}`);
    const cell = ws.getCell(`A${currentRow}`);
    cell.value = line;
    cell.font = { name: fontSegoe, size: 8, italic: true, color: { argb: 'FF64748B' } };
    currentRow++;
  }

  const arrayBuffer = await wb.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

// Backwards compatibility for .xls endpoint if ever requested
export function buildExcelReport(rows: Leave[], actor: Employee, month: string, now: Date = new Date()): string {
  // Return the XML/HTML version as before for .xls
  const printDate = new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'full',
    timeStyle: 'medium',
    timeZone: 'Asia/Jakarta',
  }).format(now);

  const totalRequests = rows.length;
  const approvedRows = rows.filter((r) => r.status === 'APPROVED');
  const pendingRows = rows.filter((r) => r.status === 'PENDING_SDM');
  const rejectedRows = rows.filter((r) => r.status === 'REJECTED');
  const totalDuration = rows.reduce((acc, r) => acc + (r.duration || 0), 0);

  function escapeHtml(val: string | number | null | undefined): string {
    if (val === null || val === undefined) return '';
    let str = String(val);
    if (/^[=+@-]/.test(str)) str = "'" + str;
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  return '\uFEFF' + `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body>
  <h2>PT BANK NEGARA INDONESIA (PERSERO) TBK</h2>
  <h3>LAPORAN MONITORING PENGAJUAN CUTI PEGAWAI</h3>
  <p>Unit: ${escapeHtml(actor.unit)} | Periode: ${escapeHtml(formatMonthLabel(month))} | SDM: ${escapeHtml(actor.name)}</p>
  <table border="1">
    <tr><th>No</th><th>Nomor</th><th>Nama</th><th>Posisi</th><th>Kategori</th><th>Mulai</th><th>Akhir</th><th>Hari</th><th>Status</th></tr>
    ${rows.map((r, i) => `<tr><td>${i + 1}</td><td>${escapeHtml(r.number)}</td><td>${escapeHtml(r.employeeName)}</td><td>${escapeHtml((r.positionName??positionLabel(r.position)))}</td><td>${escapeHtml(r.category)}</td><td>${r.effectiveStart}</td><td>${r.effectiveEnd}</td><td>${r.duration}</td><td>${escapeHtml(statusLabel[r.status] || r.status)}</td></tr>`).join('')}
  </table>
</body></html>`;
}
