# PRD — Sistem Pengajuan dan Monitoring Cuti BNI

Versi: 0.3 — posisi, outlet, dan pengganti sementara (PGS)

Tanggal: 5 Oktober 2026

Bahasa aplikasi: Indonesia  
Dokumen terkait: [Desain](design.md) · [Arsitektur](architecture.md)

## 1. Tujuan dan batas produk

Membangun aplikasi internal untuk pengajuan cuti karyawan, pemeriksaan oleh SDM, serta monitoring kuota cuti bulanan per posisi. Sistem memvalidasi tanggal dan kapasitas sebelum pengajuan dikirim, menjelaskan setiap pemotongan tanggal, serta mengirim email pengingat dan hasil keputusan.

Dokumen ini merupakan rancangan kebutuhan berdasarkan permintaan pengguna, bukan pernyataan kebijakan resmi BNI. Aturan yang belum pasti diberi ID asumsi agar keputusan implementasi dapat ditelusuri.

### Hasil yang diharapkan

- Karyawan memahami tanggal yang boleh dipilih, durasi efektif, dan alasan pengajuan tidak dapat diterima.
- SDM memiliki antrean review, kalender per posisi, dan ringkasan kuota per bulan.
- Tidak ada pengajuan yang melampaui kuota akibat dua pengguna mengirim bersamaan.
- Semua keputusan, perubahan kebijakan, dan pengiriman email memiliki jejak audit.

### Cakupan MVP

1. Login dan akses berbasis peran.
2. Data karyawan, posisi, unit kerja, kontak, dan kalender kerja.
3. Pengajuan reguler dan darurat dengan validasi otomatis.
4. Kuota bulanan per posisi, pembatasan akhir bulan, serta pemeriksaan irisan tanggal.
5. Review, konfirmasi, persetujuan, dan penolakan oleh SDM.
6. Dashboard, kalender, riwayat, detail pengajuan, dan ekspor monitoring SDM.
7. Email pengingat SDM, email keputusan karyawan, retry, dan status pengiriman.
8. Pengelolaan kebijakan dan audit oleh administrator yang berwenang.
9. Master posisi/outlet yang dapat ditambah atau dihapus serta pemeriksaan ketersediaan PGS sebelum approval.

## 2. Pengguna dan kewenangan

| Peran | Kewenangan |
|---|---|
| Karyawan | Melihat profil dan pengajuan sendiri, mengajukan cuti, melihat ketersediaan posisi tanpa alasan pribadi rekan, menarik pengajuan yang masih menunggu review |
| SDM | Melihat pengajuan dalam unit yang menjadi kewenangannya, memeriksa kuota dan konflik, mencatat konfirmasi, menyetujui/menolak, mengekspor monitoring |
| Administrator | Mengelola pengguna, penempatan posisi, kalender, kebijakan, dan konfigurasi notifikasi; tidak otomatis memiliki hak approval |

Satu akun dapat memiliki beberapa peran secara eksplisit. Akses lintas unit harus diberikan secara eksplisit. Rekomendasi pemisahan tugas: SDM tidak menyetujui pengajuan miliknya sendiri; SDM lain yang berwenang memutuskan.

## 3. Keputusan terkonfirmasi dan asumsi

Pengguna telah mengonfirmasi bahwa kuota adalah **jumlah orang per posisi per bulan**, durasi hanya menghitung **hari kerja**, H-3 berarti **tiga hari kerja terakhir bulan**, dan irisan maksimal **2 hari kerja** juga memperhitungkan pengajuan pending. Batas orang yang cuti bersamaan mengikuti kuota posisi. Cuti darurat hanya dikecualikan dari masa tunggu satu bulan. Nama posisi yang benar adalah **BTRM**. Bagian lain yang ditandai asumsi masih memerlukan validasi bisnis.

| ID | Topik | Baseline sementara | Dampak bila berubah |
|---|---|---|---|
| A01 — dikonfirmasi | Arti jatah | Jumlah karyawan berbeda yang boleh mengambil cuti pada posisi tersebut per bulan | Durasi 1–5 hari tidak mengubah pemakaian satu orang |
| A02 | Cakupan kuota | Per unit/cabang dan posisi, bukan gabungan seluruh BNI | Mengubah kunci kapasitas dan otorisasi |
| A03 — dikonfirmasi | Hari yang dihitung | Hanya hari kerja sesuai kalender kerja; perhitungan rentang inklusif | Kalender tiap unit masih perlu disediakan |
| A04 — dikonfirmasi | H-3 akhir bulan | Tiga hari kerja terakhir bulan menurut kalender kerja unit tidak boleh dipakai cuti | Akhir pekan/libur tidak ikut menghitung tiga hari kerja |
| A05 — dikonfirmasi | Posisi sama | Irisan maksimal 2 hari kerja termasuk pending; jumlah orang bersamaan maksimal sebesar kuota posisi | Kuota bulanan tetap habis setelah dipakai orang berbeda walaupun tanggal cutinya berjauhan |
| A06 | Status pemesan kapasitas | Menunggu review dan disetujui sama-sama memakai kuota dan jadwal | Mengubah perilaku antrean |
| A07 | Satu bulan | Satu bulan kalender, bukan 30 hari; tanggal tidak ada disesuaikan ke akhir bulan tujuan | Mengubah tanggal paling awal |
| A08 — dikonfirmasi | Cuti darurat | Hanya bebas masa tunggu satu bulan; aturan kuota orang, H-3 hari kerja, irisan, dan maksimal 5 hari tetap berlaku | Tidak ada pengecualian kapasitas atau kalender untuk darurat |
| A09 | Notifikasi reguler | Pengingat kepada SDM pada tanggal mulai efektif dikurangi satu bulan; jika waktu itu sudah lewat, kirim segera setelah pengajuan | Mengubah waktu penjadwalan |
| A10 — BTRM dikonfirmasi | Ejaan posisi | Nama dan kode posisi adalah BTRM; Klining Staff sementara ditampilkan sebagai Cleaning Staff | Label Cleaning Staff masih perlu dicocokkan dengan master pegawai |
| A11 | Konfirmasi reguler | SDM mencatat konfirmasi karyawan sebelum menyetujui; email ditujukan ke SDM sesuai permintaan | Perlu keputusan jika konfirmasi harus lewat tautan karyawan |
| A12 | Zona waktu | Asia/Jakarta; pengingat terjadwal dikirim pukul 08.00 waktu unit | Dapat dikonfigurasi jika cakupan meluas |

Cuti darurat dapat dimulai hari ini jika memenuhi kalender dan aturan lainnya. SDM tidak memiliki bypass kuota, H-3, irisan, atau batas durasi. Perubahan kuota hanya berlaku ke periode mendatang dan tidak boleh menghapus persetujuan yang sudah ada.

## 4. Master posisi dan kuota bulanan

Angka berikut adalah jumlah orang berbeda yang boleh cuti per posisi per bulan. Satu karyawan memakai satu slot orang, berapa pun durasi cutinya dalam batas 1–5 hari kerja per pengajuan. Tidak ada carry-over atau pinjaman kuota dari bulan/posisi lain. Kuota yang sama menjadi batas jumlah orang pada posisi itu yang boleh cuti bersamaan; aturan irisan maksimal 2 hari tetap diperiksa.

| Kode | Posisi tampilan | Kuota orang/posisi/bulan |
|---|---|---:|
| CS_BINA | CS BINA | 2 |
| TELLER | Teller | 4 |
| CS_FTE | CS FTE | 2 |
| BBO | BBO | 2 |
| BM | BM | 2 |
| BTRM | BTRM | 3 |
| ARM | ARM | 2 |
| PRM | PRM | 2 |
| BTN | BTN | 2 |
| BMB | BMB | 2 |
| BSM | BSM | 2 |
| CBRS | CBRS | 2 |
| CBRS_SPV | CBRS SPV (Supervisor) | 2 |
| CLEANING_STAFF | Cleaning Staff | 2 |

CS BINA dan CS FTE adalah posisi berbeda untuk pemeriksaan kuota/irisan. Penyebutan “CS” secara umum pada contoh tidak otomatis menggabungkan keduanya. Posisi dan unit diambil dari master pegawai, tidak dipilih bebas dalam form.

### Master posisi, outlet, dan aturan PGS

Daftar posisi di atas merupakan data awal. Administrator dapat menambah posisi dengan kode, nama, serta kuota awal orang per bulan, dan menghapus posisi yang sudah tidak digunakan. Administrator juga dapat menambah, mengganti nama, atau menghapus outlet, kemudian menempatkan setiap karyawan pada satu outlet melalui direktori karyawan. Outlet berada di dalam unit/cabang; lingkup SDM dan kuota bulanan tetap per unit/cabang, tidak dipisah per outlet.

Semua posisi dimulai dengan **aturan PGS belum diatur**, termasuk BM. Contoh BM → BBO bukan aturan bawaan. Untuk setiap posisi cuti, administrator dapat memilih satu atau beberapa posisi yang boleh menggantikan, mengizinkan outlet yang sama, dan menentukan apakah pengganti dari outlet lain dilarang, diizinkan dari seluruh outlet dalam cabang, atau hanya dari outlet yang dipilih. Aturan dapat diaktifkan atau dinonaktifkan.

Jika aturan aktif, SDM harus mendapatkan setidaknya satu calon yang tersedia selama seluruh tanggal kerja efektif cuti sebelum menyetujui. **Memilih atau menetapkan satu orang bukan kewajiban**. Aturan yang belum diatur/nonaktif ditampilkan secara jelas dan alur approval tetap berjalan dengan pemeriksaan cuti yang sudah ada.

Calon harus aktif, memiliki akses karyawan, memenuhi posisi dan sumber outlet, serta bukan pemohon. Calon tidak tersedia jika memiliki pengajuan pending/cuti disetujui atau tugas PGS yang sudah dicatat pada satu tanggal efektif yang beririsan. Batas irisan dua hari untuk pengajuan pada posisi sama tidak membolehkan benturan tugas PGS.

SDM boleh mencatat seorang PGS secara opsional saat approval. Pencatatan ini memesan seluruh tanggal efektif sehingga orang tersebut tidak dapat ditetapkan sebagai PGS lain atau mengajukan cuti pada tanggal beririsan. Tugas PGS tidak memakai kuota cuti pribadi. Jika SDM hanya mengecek ketersediaan, sistem menyimpan waktu pemeriksaan tanpa memesan calon tertentu; pengecekan tidak otomatis membentuk penugasan.

Backend memeriksa ulang ketersediaan saat menyimpan keputusan dalam transaksi. Jika calon sudah tidak tersedia, approval ditolak dan SDM perlu memeriksa kembali. Pembatalan cuti yang masih menunggu review atau ditolak tetap mempertahankan tugas PGS; pembatalan yang disetujui melepas tugas tersebut. Riwayat penugasan tetap tersimpan.

Penghapusan master ditolak ketika masih dipakai karyawan, aturan terkait, atau cuti/tugas PGS aktif. Perubahan posisi, outlet, penonaktifan, atau penghapusan karyawan yang memiliki cuti/tugas PGS aktif juga diblokir. Data lama mendapat satu outlet awal secara otomatis; pengajuan, kontak, kuota, dan keputusan lama dipertahankan.

## 5. Aturan bisnis

### BR-01 — Kuota bulanan

- Kuota dihitung pada bulan terjadinya hari cuti efektif, bukan bulan pengajuan.
- Ukuran pemakaian adalah jumlah `employee_id` unik dengan pengajuan aktif pada unit, posisi, dan bulan tersebut.
- Aktif untuk kapasitas berarti `PENDING_SDM` atau `APPROVED`. Draft, ditolak, dan ditarik tidak memakai kapasitas.
- Rumus: `terpakai = jumlah orang unik berstatus pending atau approved`; `tersedia = kuota_orang - terpakai`. Karyawan yang belum memakai slot memerlukan satu slot tersedia.
- Contoh CS BINA berkuota 2 orang: A mengambil cuti tanggal 1 Oktober, sisa 1 orang; B mengambil cuti tanggal 20 Oktober, sisa 0. C tidak dapat mengajukan cuti Oktober walaupun memilih tanggal lain yang kosong.
- Berakhirnya tanggal cuti tidak mengembalikan slot bulan tersebut. Slot baru tersedia pada bulan berikutnya atau ketika semua pengajuan aktif pemilik slot pada bulan itu ditolak/ditarik.
- Beberapa pengajuan dari orang yang sama dalam satu bulan tetap memakai satu slot, sesuai satuan orang unik; tanggalnya tidak boleh beririsan. Batas total hari bulanan per orang tidak ditambahkan tanpa kebijakan tersendiri.
- Maksimal 5 hari adalah batas durasi setiap pengajuan, terpisah dari kuota orang. CS BINA A boleh mengajukan 5 hari kerja dan hanya memakai 1 dari 2 slot apabila tanggal memenuhi aturan lain.
- Jika kuota penuh, tolak pengajuan orang baru dengan penjelasan; jangan memotong durasi untuk mengatasi kuota orang. Pemotongan otomatis hanya berlaku untuk H-3.

### BR-02 — Larangan tiga hari kerja terakhir bulan

Ambil seluruh hari kerja pada bulan tersebut berdasarkan kalender unit, urutkan, lalu larang tiga hari kerja paling akhir. Awal periode terlarang adalah hari kerja ketiga dari belakang. Sabtu/Minggu hanya dihitung jika memang hari kerja unit; hari libur tidak dihitung. Tanggal nonkerja tetap tidak dapat menjadi tanggal cuti efektif.

| Kalender contoh | Tiga hari kerja yang dilarang | Hari kerja terakhir yang boleh cuti |
|---|---|---|
| September 2026, Senin–Jumat tanpa libur tambahan | 28, 29, 30 September | 25 September |
| Oktober 2026, Senin–Jumat tanpa libur tambahan | 28, 29, 30 Oktober | 27 Oktober |
| Oktober 2026, Senin–Jumat, 30 Oktober libur khusus | 27, 28, 29 Oktober | 26 Oktober |

Libur khusus pada baris terakhir adalah fixture ilustrasi, bukan klaim kalender libur resmi. Jika bulan memiliki kurang dari tiga hari kerja, seluruh hari kerjanya terlarang. Kalender yang belum tersedia memblokir pengajuan sampai dikonfigurasi.

### BR-03 — Pemotongan otomatis

- Karyawan memilih tanggal mulai dan tanggal akhir yang diminta. Sistem menyimpan keduanya sebagai rekam niat awal.
- Jika rentang mencapai periode H-3, akhir efektif dipotong menjadi hari kerja terakhir sebelum periode terlarang pada bulan tanggal mulai.
- Rentang tidak diteruskan melompati akhir bulan ke bulan berikutnya. Karyawan membuat pengajuan terpisah untuk bulan berikutnya.
- Durasi = jumlah hari kerja dalam rentang efektif, secara inklusif. Hari nonkerja tidak dihitung.
- Sistem menampilkan tanggal awal/akhir efektif, jumlah hari terpotong, serta penyebabnya sebelum submit. Tidak ada pemotongan tersembunyi setelah persetujuan pengguna.
- Jika hari efektif nol, pengajuan tidak dapat dikirim. Jika lebih dari 5, minta karyawan memperpendek rentang; hanya batas H-3 yang memotong otomatis.
- Backend menghitung ulang saat submit. Jika berbeda dari pratinjau karena kalender/kebijakan berubah, tampilkan pratinjau baru dan minta submit ulang.

### BR-04 — Reguler dan tanggal paling awal

- Pada tanggal submit lokal `D`, tanggal mulai reguler harus `>= tambah_bulan(D, 1)`.
- Tambah bulan mempertahankan nomor tanggal; jika nomor itu tidak ada, gunakan tanggal terakhir bulan tujuan.
- Batas masa tunggu tidak membebaskan aturan H-3 atau kalender kerja.
- Contoh permintaan pengguna: submit 29 September 2026 → batas masa tunggu 29 Oktober 2026. Namun 28–30 Oktober merupakan tiga hari kerja terakhir, sedangkan 31 Oktober–1 November adalah akhir pekan. Dengan kalender Senin–Jumat tanpa libur tambahan, tanggal valid pertama menjadi 2 November 2026.
- Draft yang disimpan kemarin menggunakan tanggal submit yang sebenarnya ketika dikirim, bukan tanggal pembuatan draft.

### BR-05 — Darurat

Tanggal mulai paling awal adalah hari ini menurut waktu server di Asia/Jakarta. Jenis darurat: Cuti Duka, Cuti Sakit, atau Lainnya dengan nama jenis wajib diisi. Permohonan tanggal lampau tidak termasuk MVP. Satu-satunya pengecualian aturan kelayakan adalah masa tunggu satu bulan: kuota orang bulanan, batas orang bersamaan, H-3 hari kerja, maksimal 5 hari kerja, irisan, dan persetujuan SDM tetap berlaku. Email SDM dikirim segera sesuai alur darurat.

### BR-06 — Irisan pada posisi yang sama

- Bandingkan himpunan tanggal cuti efektif dengan setiap pengajuan aktif dari karyawan lain pada unit dan posisi yang sama.
- Irisan 0, 1, atau 2 hari kerja diperbolehkan. Irisan 3 hari kerja atau lebih ditolak.
- Rentang efektif yang persis sama ditolak, termasuk jika durasinya hanya 1–2 hari, untuk mempertahankan larangan “tanggal dan jumlah hari yang sama”.
- Pengajuan milik orang yang sama tidak boleh beririsan satu hari pun, termasuk antara reguler dan darurat.
- Aturan maksimal 2 diterapkan per pasangan. Pada setiap tanggal efektif, jumlah orang berbeda yang cuti bersamaan tidak boleh melebihi kuota posisi: CS BINA 2, Teller 4, BTRM 3, dan posisi lain sesuai tabel. Batas ini memakai angka yang sama dengan kuota bulanan, bukan kuota harian tambahan yang mengisi ulang kapasitas bulanan.
- Contoh tanggal 6–10 Oktober dari pengguna dihitung sebagai 5 hari hanya jika kalender unit menetapkan kelimanya hari kerja. Jika Sabtu libur, 10 Oktober 2026 tidak dihitung dan durasinya 4 hari. Rentang sama tetap ditolak.

### BR-07 — Form pengajuan

| Field | Aturan |
|---|---|
| Kategori | Wajib: Reguler / Darurat |
| Jenis cuti reguler | Teks wajib atau daftar master yang nanti disepakati; jangan mengarang daftar hak cuti |
| Jenis cuti darurat | Duka / Sakit / Lainnya; Lainnya memerlukan nama jenis |
| Alasan | Teks wajib 10–2.000 karakter; hanya karyawan terkait dan SDM berwenang yang melihat |
| Tanggal mulai/akhir diminta | Wajib; diproses oleh aturan tanggal |
| Tanggal dan durasi efektif | Dihitung otomatis, tidak dapat diketik bebas |
| Status | Sistem menetapkan Draft atau Menunggu review; bukan input karyawan |
| Nomor HP | Diisi dari profil, tetap dapat diedit; wajib format nomor telepon valid |
| Email | Diisi dari profil, tetap dapat diedit; wajib format email valid |

Kontak yang diedit disimpan sebagai snapshot pengajuan dan tidak otomatis mengubah profil pegawai. Domain email yang diizinkan mengikuti konfigurasi organisasi. Jika email berbeda dari profil, form menjelaskan bahwa hasil keputusan akan dikirim ke alamat tersebut; email hanya memuat informasi minimum dan tautan yang tetap membutuhkan login.

### BR-08 — Review SDM dan status

| Status internal | Label | Transisi yang diizinkan |
|---|---|---|
| DRAFT | Draft | PENDING_SDM atau hapus draft |
| PENDING_SDM | Menunggu review | APPROVED, REJECTED, WITHDRAWN |
| APPROVED | Disetujui | Terminal dalam MVP |
| REJECTED | Ditolak | Terminal; boleh salin menjadi draft baru |
| WITHDRAWN | Ditarik | Terminal; boleh buat pengajuan baru |

- SDM memeriksa data, kapasitas, benturan, alasan, serta konfirmasi untuk reguler.
- Konfirmasi terpisah dari status pengajuan: `NOT_CONFIRMED`, `CONFIRMED`, `DECLINED`. SDM mencatat kapan, melalui kanal apa, dan catatan singkat.
- Approval reguler hanya tersedia setelah `CONFIRMED`. Jika karyawan tidak jadi, SDM mencatat `DECLINED` dan menolak dengan alasan, atau karyawan menarik pengajuan.
- Darurat dapat langsung direview dan diputuskan tanpa gerbang konfirmasi reguler.
- Penolakan wajib memiliki alasan. Approval dapat memuat catatan opsional.
- Pengajuan terkirim tidak dapat diedit. Karyawan dapat menarik yang masih pending lalu mengajukan ulang. Perubahan/pembatalan cuti yang sudah approved merupakan kebutuhan lanjutan, bukan edit tersembunyi.
- Review yang terlambat tidak menyebabkan persetujuan otomatis. Setelah tanggal mulai lewat, approval diblokir; SDM menolak dengan penjelasan. Pending tetap terlihat dan memakai kapasitas sampai diputuskan/ditarik; dashboard menandai keterlambatan.

### BR-09 — Email

| Kejadian | Penerima | Waktu | Isi minimum |
|---|---|---|---|
| Pengingat reguler | SDM aktif untuk unit terkait | Mulai efektif dikurangi 1 bulan, 08.00 WIB; jika sudah lewat, segera | Nomor permohonan, karyawan, posisi, tanggal efektif, ajakan mengonfirmasi dan review |
| Pengajuan darurat | SDM aktif untuk unit terkait | Segera sesudah submit berhasil | Nomor permohonan, identitas minimum, tanggal, tautan review |
| Disetujui/ditolak | Email snapshot karyawan | Segera sesudah keputusan tersimpan | Status, tanggal efektif, tautan melihat detail dan alasan |

- Seluruh pengajuan langsung masuk dashboard SDM, meskipun pengingat email reguler belum waktunya.
- Pengingat reguler hanya dikirim jika pengajuan masih pending dan belum dikonfirmasi. Keputusan, penarikan, atau konfirmasi sebelum waktu pengingat membuat pesan itu tidak lagi diperlukan.
- Untuk mulai 2 November 2026, jadwal pengingat adalah 2 Oktober 2026. Untuk mulai 29 Oktober secara matematis jadwal 29 September, tetapi tanggal cutinya tidak valid menurut BR-02.
- Email tidak memuat rincian sakit/duka atau alasan pribadi. SDM membuka aplikasi untuk membaca detail.
- Kegagalan email tidak membatalkan pengajuan atau keputusan. Tersedia retry dan peringatan operasional.

## 6. Kebutuhan layar dan monitoring

| Layar | Informasi/aksi inti |
|---|---|
| Dashboard karyawan | Kuota posisi bulan dipilih, disetujui/pending, tombol ajukan, status terakhir |
| Form pengajuan | Kontak, jenis/alasan, kalender, durasi otomatis, pemotongan, konflik, pratinjau |
| Riwayat/detail sendiri | Status, tanggal diminta dan efektif, timeline, keputusan, penarikan pending |
| Dashboard SDM | Filter unit/bulan/posisi/status, kuota orang disetujui/pending/tersedia, antrean terlambat |
| Kalender SDM | Rentang cuti efektif, blok H-3, pembeda pending/approved, filter posisi |
| Detail review | Kontak, alasan, validasi, konfirmasi reguler, approve/reject, audit |
| Admin | Master, kuota berperiode, kalender berversi, peran, penerima email |

Kartu “Disetujui” menghitung orang unik yang memiliki setidaknya satu pengajuan approved; “Menunggu review” menghitung orang unik pending yang belum memiliki approval pada bulan/posisi/unit yang sama. Keduanya tidak tumpang tindih: orang yang memiliki approved dan pending hanya dihitung pada Disetujui. “Tersedia” adalah kuota dikurangi kedua angka tersebut. Tampilkan “Kuota posisi (orang/bulan)” dan hindari label “Sisa hari cuti Anda”. Durasi hari dan jumlah pengajuan adalah metrik terpisah. Ekspor hanya tersedia untuk lingkup SDM yang diizinkan, dicatat di audit, dan secara default tidak membawa alasan pribadi.

## 7. Kebutuhan kualitas

- Bahasa Indonesia, format tanggal `29 Sep 2026`, zona waktu eksplisit pada aktivitas/jadwal.
- Desktop dan ponsel; form dapat dipakai melalui keyboard, status tidak dibedakan dengan warna saja.
- Target awal pratinjau dan submit p95 di bawah 2 detik pada beban uji yang disepakati; pengiriman email berjalan di background.
- Target email segera masuk antrean dalam transaksi yang sama dan dicoba kirim dalam 1 menit ketika layanan sehat. Penerimaan inbox tidak dapat dijamin aplikasi.
- Tidak ada akses alasan cuti antar rekan; otorisasi wajib dilakukan server untuk setiap objek dan ekspor.
- HTTPS, pengelolaan secret, backup terenkripsi, audit keputusan, serta pembatasan akses operator.
- Retensi data, target pemulihan, kapasitas produksi, penyedia email, dan penempatan server ditentukan pemilik sistem sebelum produksi.

## 8. Kriteria penerimaan

Kalender contoh adalah Senin–Jumat tanpa libur tambahan kecuali disebut lain.

| ID | Skenario | Hasil yang diharapkan |
|---|---|---|
| AC01 | Submit reguler 29 Sep 2026, mulai 27 Okt | Ditolak: belum satu bulan |
| AC02 | Submit reguler 29 Sep 2026, mulai 29 Okt | Ditolak: H-3; kalender menyarankan 2 Nov |
| AC03 | Teller baru mulai 26 Okt, akhir diminta 30 Okt, masa tunggu terpenuhi, sisa kuota 4 orang | Efektif 26–27 Okt, 2 hari kerja; pemotongan tampil sebelum submit dan sisa menjadi 3 orang setelah dikirim |
| AC04 | Mulai 29 Okt | Tidak dapat memilih/mengirim karena seluruh awal masuk H-3 |
| AC05 | Mulai 5 Okt, akhir 12 Okt | 6 hari kerja, ditolak; tidak otomatis dipotong menjadi 5 |
| AC06 | Teller A 5–9 Okt; B 8–12 Okt, masa tunggu terpenuhi, kuota masih tersedia | Irisan 2 hari diizinkan; A dan B memakai 2 dari 4 slot, durasi masing-masing 5 dan 3 hari kerja |
| AC07 | Uji mesin irisan: A 5–9 Okt; B 7–9 Okt | Pemeriksaan irisan menolak 3 hari, terpisah dari pemeriksaan kuota |
| AC08 | Teller A dan B sama-sama 8–9 Okt | Ditolak karena rentang efektif identik meskipun 2 hari |
| AC09 | Teller A 5–6 Okt; CS FTE B pada tanggal sama | Tidak konflik posisi; masing-masing memakai satu slot pada kuota posisinya |
| AC10 | CS BINA A cuti 1 Okt, B cuti 20 Okt, C meminta tanggal lain pada Oktober | A mengurangi sisa menjadi 1, B menjadi 0; C ditolak walaupun jadwalnya kosong |
| AC11 | Teller A mengajukan dua rentang terpisah masing-masing 1 hari | Tetap memakai satu slot orang; tiap pengajuan tetap divalidasi |
| AC12 | Dua karyawan baru serentak mengajukan tanggal berbeda, sisa kuota 1 orang | Tepat satu berhasil, satu menerima konflik kapasitas |
| AC13 | Darurat untuk hari ini yang valid | Tidak terkena masa tunggu; email SDM segera diantrekan |
| AC14 | Reguler mulai 2 Nov, submit 29 Sep | Masuk dashboard segera; email SDM dijadwalkan 2 Okt 08.00 WIB |
| AC15 | SDM approve/reject | Status dan audit tersimpan atomik; email keputusan diantrekan |
| AC16 | Provider email gagal | Keputusan tetap tersimpan; retry tercatat tanpa membuat keputusan ulang |
| AC17 | Satu-satunya pengajuan aktif A pada bulan itu ditolak/ditarik | Jadwal dilepas dan satu slot orang kembali tersedia; jika A masih punya pengajuan aktif lain, slot tetap terpakai |
| AC18 | Nomor HP/email diubah di form | Snapshot pengajuan berubah; profil tetap |
| AC19 | Menambah satu bulan ke 31 Jan 2027 / 31 Jan 2028 | Batas masa tunggu 28 Feb / 29 Feb; H-3 tetap membuat tanggal itu terlarang |
| AC20 | Rentang diminta 27 Okt–3 Nov | Efektif hanya 27 Okt, 1 hari; tidak lanjut ke November; UI menjelaskan pengajuan bulan berikutnya terpisah |
| AC21 | User membuka ID permohonan rekan di API | Ditolak sesuai otorisasi; alasan/kontak tidak bocor |
| AC22 | SDM berbeda memutuskan permohonan yang sama serentak | Hanya satu transisi dan satu event keputusan berhasil |
| AC23 | Reguler belum dikonfirmasi lalu SDM approve | Ditolak sampai konfirmasi tercatat |
| AC24 | Hari libur di tengah rentang | Tidak dihitung sebagai durasi atau irisan |
| AC25 | Preview valid, kuota tidak lagi cukup sebelum submit | Submit menolak konflik dan meminta pengguna meninjau ulang |
| AC26 | Teller A 5–6 Okt; B 6–7 Okt, keduanya masing-masing 2 hari | Irisan 1 hari diperbolehkan; memakai 2 dari 4 slot orang; 6 Okt berisi 2 orang bersamaan |
| AC27 | CS BINA A meminta 5 hari efektif yang valid, kuota masih utuh 2 orang | Boleh; memakai satu slot, sisa satu orang; durasi tidak mengurangi kuota orang |
| AC28 | Tanggal cuti A selesai pada 1 Okt; bulan berganti November | Slot A tetap terpakai sepanjang Oktober; November menggunakan bucket baru, tanpa carry-over |
| AC29 | 30 Okt libur khusus pada kalender Senin–Jumat | H-3 menjadi 27–29 Okt; rentang 26–30 Okt dipotong menjadi 26 Okt saja |
| AC30 | Darurat meminta hari dalam H-3 atau pemohon baru saat kuota penuh | Ditolak oleh aturan H-3/kuota; bebas masa tunggu tidak mengabaikan aturan lain |
| AC31 | Orang yang sama punya satu approved dan satu pending pada bulan/posisi yang sama | Dashboard menghitung satu orang Disetujui, nol orang Menunggu review untuk orang itu; penolakan pending tidak melepas slot approved |
| AC32 | CS BINA A dan B memiliki irisan yang diizinkan; C meminta tanggal irisan itu | C ditolak: kuota bulanan dan batas orang bersamaan adalah 2, bukan 3 |

## 9. Tahap pengerjaan dan keputusan sebelum implementasi

1. Validasi asumsi yang tersisa: cakupan unit serta alur konfirmasi/email. Kuota orang, H-3 tiga hari kerja, batas orang bersamaan sesuai kuota, darurat hanya bebas masa tunggu, dan nama BTRM sudah dikonfirmasi pengguna.
2. Selesaikan prototipe form serta review SDM dengan contoh perhitungan nyata.
3. Implementasikan mesin aturan, transaksi reservasi, dan pengujian konkurensi.
4. Implementasikan layar, notifikasi, audit, dan monitoring.
5. UAT bersama SDM dan perwakilan posisi; finalisasi kalender serta penerima email sebelum pilot satu unit.

Keputusan operasional tambahan: jumlah unit/karyawan, kalender kerja tiap unit, daftar jenis reguler, siapa SDM pengganti, SLA review, retensi, dan metode login. Target keberhasilan pilot: seluruh AC lulus, tidak ada kelebihan kuota atau kebocoran data, dan SDM dapat menjelaskan setiap pemotongan/penolakan dari detail pengajuan.
