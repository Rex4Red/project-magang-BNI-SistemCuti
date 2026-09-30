# BNI — Ruang Cuti

Aplikasi pengajuan cuti dan monitoring kuota orang per posisi per bulan. Implementasi lokal menggunakan React, TypeScript, Express, dan PostgreSQL embedded (PGlite). Data disimpan di `.data/postgres`, bukan localStorage browser. PostgreSQL eksternal dapat digunakan melalui `DATABASE_URL`.

## Menjalankan lokal

Prasyarat: Node.js 22.12+ atau 24 dan npm.

```powershell
npm.cmd install
npm.cmd run dev
```

Buka http://127.0.0.1:5173. API berada pada http://127.0.0.1:3001. Mode lokal otomatis membuat data sintetis saat database masih kosong. Gunakan tombol akun demo di halaman masuk, lalu klik **Masuk**.

| Peran | Email | Kata sandi lokal |
|---|---|---|
| SDM | sdm@demo.bni.local | BniCuti!2026 |
| Karyawan | karyawan@demo.bni.local | BniCuti!2026 |
| Administrator | admin@demo.bni.local | BniCuti!2026 |

Akun tersebut hanya untuk demonstrasi. Seed hanya berjalan pada database kosong. Jangan gunakan database demo sebagai database operasional.

## Fitur yang tersedia

- Login cookie HttpOnly, peran karyawan/SDM/admin, dan pembatasan data per unit.
- Dashboard bulanan, kuota orang unik, daftar pengajuan, dan kalender posisi.
- Pengajuan reguler/darurat, preview dari server, durasi hari kerja, pemotongan H-3, batas 5 hari, konflik rentang identik dan irisan maksimal 2 hari.
- Draft: simpan, buka kembali, hapus, dan kirim; salin pengajuan ditolak/ditarik ke pengajuan baru.
- Konfirmasi reguler, persetujuan/penolakan SDM, alasan keputusan, penarikan pending, dan timeline.
- Kuota tidak dikurangi dua kali untuk orang yang sama dan tidak dilepas saat tanggal cuti selesai.
- Transaksi database serta idempotensi submit untuk mencegah perebutan kuota dan pengiriman ganda.
- Ekspor CSV SDM tanpa alasan pribadi dan pencatatan audit.
- Admin karyawan/peran, kuota periode mendatang, pengecualian kalender, antrean notifikasi, dan retry email gagal.
- Worker email terjadwal: reguler satu bulan sebelum tanggal mulai efektif; darurat dan keputusan segera diantrekan.
- Font disajikan dari aset lokal, tanpa permintaan font pihak ketiga.

## Contoh alur uji manual

1. Masuk sebagai Karyawan dan pilih **Ajukan cuti**.
2. Pilih Reguler; isi jenis, alasan minimal 10 karakter, kontak, dan tanggal satu bulan ke depan yang bukan H-3.
3. Tinjau tanggal efektif, jumlah hari kerja, dan slot orang. Jika tanggal dipotong, centang persetujuan penyesuaian sebelum mengirim.
4. Masuk sebagai SDM pada browser/profil lain. Buka pengajuan, catat konfirmasi karyawan, lalu setujui atau tolak.
5. Akun karyawan menampilkan keputusan pada riwayat. Admin dapat melihat antrean email pada **Administrasi → Notifikasi email**.

Kuota CS BINA adalah 2 **orang**, sehingga A cuti tanggal 1 dan B cuti tanggal 20 menghabiskan kuota bulan tersebut. Satu permohonan 5 hari kerja tetap memakai satu slot orang. Hari kerja default Senin–Jumat; kalender hari libur organisasi harus diisi admin, bukan diasumsikan sudah tersedia.

## Konfigurasi email dan database

### Demo publik sementara

Persiapan Cloudflare Tunnel tersedia dalam `scripts/public-demo.mjs`. Dari folder proyek, jalankan:

```powershell
node scripts/public-demo.mjs
```

Script membuat URL HTTPS acak, menjalankan build aplikasi pada port 3002, dan menyimpan data demo publik terpisah pada `.data/public-demo`. URL juga disimpan di `.data/public-tunnel/url.txt`. Tunggu tulisan **LINK DEMO** lalu bagikan tautannya. Akun demo sama dengan tabel di atas. Semua akun demo, termasuk Admin, tersedia pada halaman masuk publik, sehingga gunakan hanya data sintetis. Email tetap dalam mode capture.

Biarkan laptop, koneksi internet, dan terminal tetap aktif. Tekan Ctrl+C untuk menghentikan tunnel dan aplikasi publik. Menjalankan kembali dapat menghasilkan URL berbeda. Aplikasi lokal port 5173 tidak berubah. Script belum dijalankan dari sesi agen karena kebijakan lingkungan menolak peluncuran tunnel; akses publik perlu diverifikasi setelah dijalankan langsung oleh pengguna.

Salin `.env.example` ke `.env` bila ingin mengubah konfigurasi. Jangan commit `.env`.

Default `MAIL_MODE=capture`: email disimpan dalam tabel `mail_deliveries` dan job ditandai `CAPTURED`; tidak ada email keluar. Untuk pengiriman sungguhan, isi `MAIL_MODE=smtp`, `SMTP_HOST`, `SMTP_PORT`, kredensial bila diperlukan, dan `MAIL_FROM`. Worker berjalan setiap 10 detik di proses API, sehingga aplikasi harus tetap hidup untuk mengirim pengingat.

Penerima SDM adalah semua akun aktif berperan SDM di unit pemohon. Email hanya memuat identitas minimum, nomor pengajuan, tanggal efektif, dan tautan aplikasi. SMTP belum diuji terhadap server organisasi. Retry provider memiliki semantik at-least-once: kemungkinan duplikasi setelah timeout provider tetap ada.

Untuk PostgreSQL eksternal, isi `DATABASE_URL`. Skema dibuat otomatis saat startup. Adapter eksternal tersedia tetapi belum diuji di lingkungan ini karena layanan Docker/PostgreSQL tidak aktif; pengujian database menggunakan mesin PostgreSQL embedded PGlite.

## Build dan pengujian

```powershell
npm.cmd run build
npm.cmd test
npx.cmd playwright install chromium
npm.cmd run test:e2e
```

Pengujian browser menjalankan server dan database in-memory terpisah pada port 5174/3011, tidak mengubah data demo utama. Screenshot desktop dan ponsel berada dalam `artifacts/`. Pengujian unit/API mencakup konkurensi, idempotensi, kuota unik, akhir bulan, kebocoran akses, keputusan SDM, ekspor, dan capture email.

Hasil verifikasi implementasi awal: 47 tes unit/API dan 3 tes browser lulus, TypeScript dan build lulus. Ini bukan pengganti UAT SDM atau validasi infrastruktur produksi.

Untuk mencoba build lokal, jalankan `npm.cmd run build`, atur `APP_ORIGIN=http://127.0.0.1:3001`, lalu `npm.cmd start` dan buka port 3001. Jangan jalankan dua proses API yang membuka direktori PGlite yang sama.

## Persiapan lingkungan operasional

Gunakan database PostgreSQL kosong yang terpisah; set `NODE_ENV=production`, `DEMO_MODE=false`, `DATABASE_URL`, HTTPS `APP_ORIGIN`, `BOOTSTRAP_EMAIL`, dan `BOOTSTRAP_PASSWORD` minimal 12 karakter. Aplikasi tidak membuat akun demo dalam mode production. Bootstrap menghasilkan akun administrator; buat akun SDM dan karyawan melalui administrasi.

Server mendengarkan loopback untuk diletakkan di belakang reverse proxy. Sesuaikan konfigurasi reverse proxy/HTTPS, domain email yang diizinkan, kalender kerja, backup/restore, retensi, dan penerima SDM dengan organisasi. SMTP nyata, PostgreSQL eksternal, pemulihan backup, SSO, pengujian beban, dan deployment belum diverifikasi. Aplikasi belum dipublikasikan ke internet.

## Struktur proyek

| Lokasi | Isi |
|---|---|
| `src/` | UI React, API client, dan CSS responsif |
| `shared/domain.ts` | Perhitungan kalender, cutoff, kuota, irisan, dan pengingat |
| `server/` | API, otorisasi, transaksi, database, seed, worker email |
| `tests/` | Tes aturan, API/database, dan browser |
| `PRD.md`, `design.md`, `architecture.md` | Kebutuhan dan rancangan yang disepakati |

Catatan implementasi terhadap arsitektur: tahap lokal menyimpan snapshot domain dalam kolom JSONB dengan indeks lingkup pada tabel relasional. Membership kuota dihitung dari pengajuan aktif dalam transaksi yang mengunci baris unit; tabel membership terpisah belum dimaterialisasi. Lock per unit lebih sederhana dan membatasi throughput dibandingkan lock per bucket pada rancangan. Normalisasi lanjutan, pagination server, tampilan mingguan khusus, serta proses migrasi skema berversi masih merupakan pekerjaan peningkatan sebelum skala besar.
