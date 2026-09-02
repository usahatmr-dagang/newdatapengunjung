# 🐅 TMR Scraper & Dashboard - Panduan Lengkap Sistem (V2 - GitHub Actions)

Dokumen ini merupakan panduan komprehensif yang berisi seluruh arsitektur, logika jadwal, struktur database, dan cara kerja dari sistem **TMR Scraper Data Pendapatan & Pengunjung** versi terbaru yang kini berjalan tanpa biaya server (Serverless) menggunakan GitHub Actions.

---

## 1. 🏗️ Arsitektur Sistem Secara Keseluruhan

Sistem ini terbagi menjadi 4 komponen utama yang saling bekerja sama:

1. **Pemicu Alarm (cron-job.org):** Layanan pihak ketiga gratis yang menekan tombol *trigger* API GitHub secara persis setiap 15 menit.
2. **Mesin Cloud (GitHub Actions):** Server komputasi gratis yang menjalankan script Python (`tarik_data.py`) setiap kali dipicu. Server ini yang akan membuka Google Chrome rahasia dan menarik data.
3. **Penyimpanan (Firebase Firestore & GitHub Repo):** 
   - Firebase Firestore: Menyimpan data yang sudah matang untuk dikonsumsi Web App.
   - GitHub Repo (Folder `data/`): Menyimpan cadangan data *real-time* berbentuk file `.json`.
4. **Frontend Dashboard (React):** Web App yang menarik data dari Firestore dan menampilkannya menjadi grafik visual.

---

## 2. 🤖 Backend / Bot Scraper (tarik_data.py)

Script ini adalah otak utama yang menarik data dari website 3A dan IWM.

### Logika Sesi Operasional (Jam Kerja Bot)
Bot ini dibuat pintar agar tidak mengonsumsi kuota komputasi GitHub saat TMR sedang tutup. Jika alarm berbunyi di luar jam operasional, bot akan langsung mati secara otomatis (*Auto-Stop*).

Berikut aturan jam operasionalnya:
- **Senin - Jumat (Weekday):**
  - Siang: Pukul 07:00 - 16:30 WIB
  - Malam: Pukul 17:00 - 22:15 WIB
- **Sabtu:**
  - Siang: Pukul 06:30 - 17:30 WIB
  - Malam: Pukul 17:45 - 22:00 WIB
- **Minggu:**
  - Siang: Pukul 06:30 - 17:30 WIB
  - Malam: *Tidak ada* (Libur).

### Logika Ekstraksi Data
- **Pembagian Shift:** Data direkap sebagai "siang" atau "malam" secara otomatis berdasarkan jam server saat bot berjalan.
- **IWM Fallback:** Jika website IWM (Old Gate) sedang lambat/down sehingga tidak bisa ditarik, bot **TIDAK AKAN** mengubah nilainya menjadi 0. Bot akan mengambil riwayat angka terakhir dari file JSON lokal untuk menyelamatkan tampilan Dashboard.

---

## 3. ⚙️ Otomatisasi (GitHub Actions & Cron-job)

### File Workflow (`.github/workflows/scraper.yml`)
File ini adalah konfigurasi agar GitHub tahu apa yang harus dilakukan. Langkah-langkahnya:
1. *Checkout* kode dari repository.
2. *Setup* Python versi 3.10.
3. Install semua *library* (seperti Selenium, Firebase-admin) dari `requirements.txt`.
4. Memasukkan Kunci Rahasia Firebase dari pengaturan rahasia repositori (Secrets).
5. Menjalankan `tarik_data.py`.
6. Melakukan *Commit* dan *Push* file `.json` yang baru ditarik agar tersimpan di repositori GitHub cabang `main`.

### Pemicu Alarm Eksternal (cron-job.org)
Karena jadwal internal bawaan GitHub sering kali tertunda, kita menggunakan cron-job.org:
- **Metode:** POST API Request
- **URL:** `https://api.github.com/repos/usahatmr-dagang/newdatapengunjung/actions/workflows/scraper.yml/dispatches`
- **Jadwal:** Menit ke 0, 15, 30, dan 45.
- **Otentikasi:** Menggunakan Personal Access Token GitHub (`ghp_...`).

---

## 4. 🗄️ Database (Firebase Firestore & JSON)

### JSON Lokal (Di Github)
File cadangan ada di `data/YYYY-MM-DD.json`. File ini sangat berguna bagi bot untuk membandingkan data 15 menit lalu dengan data yang baru ditarik. 

### Firebase Firestore (Untuk Web App)
Menggunakan koleksi bernama `daily_records`. Dokumen dinamai berdasarkan tanggal (`2026-06-18`). Setiap dokumen berisi `rekap` tiket, detail pengunjung, shift `siang` dan `malam`.

---

## 5. 🛠️ Prosedur Perawatan & Update (Maintenance)

Berkat arsitektur serverless di GitHub Actions, **Anda tidak perlu membersihkan cache Google Chrome sama sekali**. Setiap kali bot berjalan, GitHub memberikan mesin (VM) Ubuntu yang benar-benar baru dan kosong, lalu menghancurkannya lagi setelah selesai. Ini membuat sistem 100% bebas dari masalah memori penuh!

### Cara Mengubah Jadwal Jam Operasional:
1. Buka file `tarik_data.py`.
2. Cari bagian `elif 17.0 <= time_val <= 22.25:` (ada di sekitar baris 460+).
3. Anda bisa mengubah angka jam dengan format desimal (contoh: jam 16:30 ditulis `16.5`, jam 17:45 ditulis `17.75`).
4. Setelah diubah, simpan file (Commit & Push) ke GitHub. Perubahan akan langsung aktif di putaran berikutnya.

### Cara Memaksa Bot Berjalan Manual:
Jika Anda ingin mengetes tarikan secara langsung tanpa menunggu alarm:
1. Masuk ke halaman **Actions** di repositori GitHub Anda.
2. Klik nama workflow: **Run Scraper & Push Data**.
3. Di kanan layar, klik tombol **Run workflow** -> tombol hijau **Run workflow**.

---
*Dokumentasi ini dibuat untuk memudahkan pengelolaan jangka panjang (Future-Proof).*
