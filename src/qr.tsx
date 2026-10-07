import QRCode from 'qrcode';

export function QrCodeSvg({
  value,
  size = 100,
  darkColor = '#000000',
  lightColor = '#ffffff',
}: {
  value: string;
  size?: number;
  darkColor?: string;
  lightColor?: string;
}) {
  try {
    const qr = QRCode.create(value, { errorCorrectionLevel: 'M' });
    const modCount = qr.modules.size;
    const margin = 2; // Standar ISO 18004 quiet zone agar cepat dideteksi kamera smartphone
    const total = modCount + margin * 2;
    const cells: { r: number; c: number }[] = [];

    for (let r = 0; r < modCount; r++) {
      for (let c = 0; c < modCount; c++) {
        if (qr.modules.get(r, c)) {
          cells.push({ r: r + margin, c: c + margin });
        }
      }
    }

    return (
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${total} ${total}`}
        shapeRendering="crispEdges"
        style={{ display: 'block', background: lightColor, borderRadius: 4 }}
        role="img"
        aria-label="QR Code Verifikasi Dokumen Cuti"
      >
        <rect width={total} height={total} fill={lightColor} />
        {cells.map(({ r, c }) => (
          <rect key={`${r}-${c}`} x={c} y={r} width={1} height={1} fill={darkColor} />
        ))}
      </svg>
    );
  } catch (e) {
    console.error('Gagal membuat QR Code:', e);
    return (
      <div
        style={{
          width: size,
          height: size,
          background: '#f0f4f6',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          color: '#666',
          borderRadius: 4,
        }}
      >
        QR Gagal
      </div>
    );
  }
}
