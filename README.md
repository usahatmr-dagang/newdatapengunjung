# 🐅 TMR Scraper & Dashboard - Panduan Lengkap Sistem

Dokumen ini merupakan panduan komprehensif yang berisi seluruh arsitektur, logika, struktur database, dan cara kerja dari sistem **TMR Scraper Data Pendapatan & Pengunjung**. 

---

## 1. 🏗️ Arsitektur Sistem Secara Keseluruhan

Sistem ini terbagi menjadi dua bagian utama yang saling berkomunikasi melalui database cloud:

1. **Backend / Bot Scraper (Python):** Bertugas mengumpulkan data mentah dari website internal TMR secara otomatis, menghitung rekapitulasi, dan menyimpannya.
2. **Frontend / Dashboard (React/Vite):** Bertugas mengambil data yang sudah matang tersebut dan menampilkannya secara *real-time* ke dalam visualisasi antarmuka (UI) yang cantik dan responsif.
3. **Database (Firebase Firestore):** Jembatan penghubung (penyimpanan cloud) tempat robot meletakkan data dan tempat website membaca data.

---

## 2. 🤖 Backend / Bot (Google Cloud VM)

Bagian ini adalah otak utama yang menarik data. Semuanya diatur dalam file `tarik_data.py`.

### Lokasi Penyimpanan Script `tarik_data.py`
- **Lokal (PC Developer):** `c:\Users\user\.gemini\antigravity-ide\scratch\data-pendapatan-pengunjung\tarik_data.py`
- **Server (Google Cloud VM):** `/home/alfatahsamadi/tmr-scraper/tarik_data.py`

### Alur Kerja (Workflow)
1. **Pemicu (Cronjob):** Server Ubuntu di Google Cloud VM memiliki fitur *Cronjob* yang disetting untuk mengeksekusi `tarik_data.py` secara otomatis setiap 15 menit.
2. **Scraping Selenium:** Robot membuka Google Chrome mode *headless* (tanpa layar) lalu masuk ke:
   - **Web 3A:** Untuk menarik data dari Merchant Page, TVM, New Gate, dan Mpos.
   - **Web IWM:** Untuk menarik data dari Old Gate.
3. **Penyimpanan Lokal (JSON):** Data hasil tarikan disimpan sementara ke dalam folder `/data/YYYY-MM-DD.json` (misal: `data/2026-06-18.json`).
4. **Unggah ke Cloud:** Data tersebut kemudian diunggah (*push*) ke Firebase Firestore.

### Logika & Fitur Khusus di `tarik_data.py`
- **Pembagian Shift:** Robot otomatis mendeteksi waktu. Sebelum pukul 16:45 (Weekday) atau 17:30 (Weekend), data dicatat sebagai "Shift Siang". Lewat dari itu masuk "Shift Malam" (Kumulatif - Siang = Malam).
- **Logika Agregasi Kategori:** Semua kata kunci tiket dari web 3A (seperti "DEWASA", "ANAK", "MOBIL", "MOTOR", "BUS KECIL", "PRIMATA", dll) dipetakan ke dalam 21 kode unik (ID 1-21) yang sesuai dengan standar akuntansi tiket TMR.
- **Logika Fallback IWM (Cerdas Penahan Data):** Ini adalah logika pengaman. Jika server IWM *down* atau *timeout* dan mengembalikan data kosong, robot **TIDAK AKAN** menimpa data IWM dengan angka "0". Ia akan membaca kembali file JSON lokal terakhir (`data/YYYY-MM-DD.json`), mengambil angka IWM terakhir yang berhasil didapat, dan menggabungkannya dengan data 3A yang paling baru. Hal ini mencegah grafik *dashboard* terjun ke angka nol.

---

## 3. 🌐 Frontend / Dashboard Web (React)

Aplikasi web yang dilihat oleh pengguna akhir. Dibangun menggunakan React, TypeScript, dan Vite. Di-hosting secara gratis menggunakan **Firebase Hosting** di URL `https://tmr-scraper-db.web.app`.

### Struktur File Utama
- `src/App.tsx`: File kerangka utama yang mengatur navigasi antar halaman (Tab Dashboard, Tab Riwayat, dan Tab Status).
- `src/components/DashboardPengunjung.tsx`: Halaman utama berisi kartu-kartu statistik.
- `src/components/HourlyHistory.tsx`: Tabel riwayat data per 15 menit.
- `src/components/ScraperStatus.tsx`: Monitor kesehatan robot.

### Logika Tampilan (UI) Dashboard
1. **Pengelompokan (Clustering) Metode Pembayaran:**
   - **Kanal Mandiri:** Merchant Page (3A), TVM (3A), dan Mpos (3A) ditampilkan dalam satu baris dengan *progress bar* persentase individual.
   - **Kanal Jakcard (Gabungan):** New Gate (3A) dan Old Gate (IWM) **digabungkan** ke dalam satu kotak (Cluster) besar karena keduanya menggunakan metode pembayaran Jakcard.
   - Persentase kontribusi terhadap total tiket dihitung secara gabungan untuk seluruh Jakcard, namun rincian jumlah pengunjung dan kendaraan (Dewasa, Anak, Motor, Mobil) tetap dirincikan per masing-masing pintu (New Gate vs Old Gate).

### Pencabutan Tombol "Scraper Manual"
Pada versi terbaru ini, tombol pemicu *scraping* manual dari halaman web (Tab Scraper Otomatis) telah dinonaktifkan sepenuhnya. Hal ini karena logika agregasi yang kompleks (terutama fitur Fallback IWM) kini hanya berpusat pada `tarik_data.py` di VM. Memaksa *scraping* dari web akan menimpa dan merusak format database. Kini halaman tersebut murni berfungsi sebagai monitor *read-only*.

---

## 4. 🗄️ Database (Firebase Firestore)

Firestore menggunakan sistem *NoSQL Document*. Seluruh data dilempar ke *Collection* bernama `daily_records`.

### Struktur Dokumen Firestore
Setiap *document* diberi nama (ID) berdasarkan *timestamp* (contoh: `2026-06-18 15:00:00`). Di dalamnya berisi field:
- `date`: Timestamp standar.
- `total_pengunjung`, `anak`, `dewasa`: Total keseluruhan.
- `motor`, `mobil`, `bus`, `sepeda`: Total kendaraan.
- `pps`, `tsa`: Wahana primata dan anak.
- `rekap` (Array/Object): Rincian jumlah *qty* dan *nominal* per kategori ID (1-21) dari gabungan 3A.
- `tickets_3a_by_channel_visit`: Object yang menyimpan detail transaksi per masing-masing kanal penjualan di 3A (TVM, Mpos, Merchant, dll).
- `iwm`: Array yang berisi detail transaksi IWM (Old Gate) lengkap beserta breakdown kendaraan dan orangnya.

---

## 5. 🛠️ Prosedur Update & Deployment

Setiap ada perubahan kode yang dilakukan di komputer lokal, perubahannya harus didorong (*deploy*) ke *Production* dengan cara berikut:

### Jika Mengubah Kode Web (React/UI/Frontend)
Jalankan perintah ini di terminal VSCode/lokal:
```bash
npm run build
npx firebase-tools deploy --only hosting
```

### Jika Mengubah Kode Robot (Python/Backend)
1. Salin isi `tarik_data.py` terbaru.
2. Masuk ke terminal Google Cloud VM (SSH).
3. Timpa file lama dengan perintah:
   ```bash
   cp tarik_data.py tmr-scraper/tarik_data.py
   ```
*(Robot akan otomatis berjalan menggunakan kode terbaru pada menit ke-15 berikutnya, tidak perlu direstart).*

---

## 6. 🧹 Perawatan (Maintenance) Server VM

Karena robot membuka *browser* Google Chrome tanpa henti, server Ubuntu lama-kelamaan akan kepenuhan *Cache* dan *Temp Files*. 

**Skrip Auto Cleanup:**
Di dalam server terdapat file `auto_cleanup.sh` yang mengecek batas kapasitas penyimpanan. Jika penyimpanan menyentuh **80%**, ia otomatis akan menghapus sampah *cache*. Jika penyimpanan masih di bawah 80% (misal 70%), ia tidak akan menghapus apa pun.

**Perintah Sapu Bersih Manual (Force Clean):**
Jika ingin memaksa VM membersihkan penyimpanannya tanpa menunggu 80%, *copy-paste* perintah ini di terminal SSH:
```bash
sudo rm -rf ~/.cache/google-chrome/Default/Cache/* && sudo find /tmp -name ".com.google.Chrome.*" -type d -exec rm -rf {} + && sudo apt-get autoremove -y && sudo apt-get clean && sudo journalctl --vacuum-size=100M
```
