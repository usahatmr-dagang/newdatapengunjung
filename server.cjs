const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const app = express();
const PORT = process.env.PORT || 5001;
const DATA_DIR = path.join(__dirname, 'data');

// Scraper execution lock and background scheduler state
let isScraperRunning = false;
let lastRunSlot = ""; // Format: "YYYY-MM-DD HH:MM"

// Middleware
app.use(cors({
  origin: '*', // Allow any origin for local network access
  methods: ['GET', 'POST']
}));
app.use(express.json());

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Endpoint default
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    message: 'TMR API Server is running locally.',
    endpoints: ['/api/records', '/api/run-scraper']
  });
});

// Endpoint 1: Get all records from local data directory
app.get('/api/records', (req, res) => {
  try {
    const files = fs.readdirSync(DATA_DIR);
    const records = [];

    files.forEach(file => {
      if (file.endsWith('.json')) {
        const filePath = path.join(DATA_DIR, file);
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          const data = JSON.parse(content);
          records.push(data);
        } catch (err) {
          console.error(`Gagal membaca file ${file}:`, err);
        }
      }
    });

    // Sort descending by date
    records.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json(records);
  } catch (error) {
    console.error('Error fetching records:', error);
    res.status(500).json({ error: 'Gagal mengambil data dari folder lokal' });
  }
});

// Endpoint 1b: Get history snapshots for a specific date
app.get('/api/history/:date', (req, res) => {
  try {
    const { date } = req.params;
    const filePath = path.join(DATA_DIR, `${date}.json`);
    if (!fs.existsSync(filePath)) {
      return res.json({ date, history: [] });
    }
    const content = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(content);

    // Merge siang & malam history and sort by time
    const siangHistory = (data.siang?.history || []).map(h => ({ ...h, shift: 'siang' }));
    const malamHistory = (data.malam?.history || []).map(h => ({ ...h, shift: 'malam' }));
    const combined = [...siangHistory, ...malamHistory].sort((a, b) => a.jam.localeCompare(b.jam));

    res.json({ date, history: combined });
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({ error: 'Gagal mengambil data history' });
  }
});

// Endpoint 2: Stream scraper run logs (with concurrency lock protection)
app.post('/api/run-scraper', (req, res) => {
  const { shift, mode } = req.body;

  if (shift !== 'siang' && shift !== 'malam') {
    return res.status(400).json({ error: 'Shift tidak valid. Harus siang atau malam.' });
  }

  const validModes = ['pengunjung', 'pendapatan', 'full'];
  const runMode = validModes.includes(mode) ? mode : 'pengunjung';

  const scriptPath = path.join(__dirname, 'tarik_data.py');

  if (!fs.existsSync(scriptPath)) {
    return res.status(404).json({ error: `File script tarik_data.py tidak ditemukan` });
  }

  // Setup streaming response headers
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Transfer-Encoding', 'chunked');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  if (isScraperRunning) {
    res.write(`❌ ERROR: Scraper sedang berjalan (baik manual maupun otomatis di background).\n`);
    res.write(`Silakan tunggu beberapa saat hingga proses selesai.\n`);
    res.end();
    return;
  }

  isScraperRunning = true;

  res.write(`=== MEMULAI SINKRONISASI DATA (${shift.toUpperCase()}) ===\n`);
  res.write(`Mode: ${runMode.toUpperCase()}\n`);
  res.write(`Menjalankan script: python tarik_data.py ${shift} ${runMode}\n`);
  res.write(`Waktu: ${new Date().toLocaleString('id-ID')}\n`);
  res.write(`--------------------------------------------------\n\n`);

  // Spawn Python script
  // Force unbuffered stdout output in Python so logs stream instantly
  const child = spawn('python', ['-u', 'tarik_data.py', shift, runMode], {
    cwd: __dirname,
    env: { ...process.env, PYTHONUNBUFFERED: '1', PYTHONIOENCODING: 'utf-8' }
  });

  child.stdout.on('data', (data) => {
    res.write(data.toString());
  });

  child.stderr.on('data', (data) => {
    res.write(`⚠️ ERROR: ${data.toString()}`);
  });

  child.on('error', (err) => {
    isScraperRunning = false;
    res.write(`\n❌ ERROR KRITIS SISTEM: Gagal memulai proses Python. ${err.message}\n`);
    res.end();
  });

  child.on('close', (code) => {
    isScraperRunning = false;
    res.write(`\n--------------------------------------------------\n`);
    if (code === 0) {
      res.write(`🎉 PROSES SELESAI DENGAN SUKSES! (Exit Code: ${code})\n`);
    } else {
      res.write(`❌ PROSES BERAKHIR DENGAN ERROR. (Exit Code: ${code})\n`);
    }
    res.write(`Waktu Selesai: ${new Date().toLocaleString('id-ID')}\n`);
    res.end();
  });
});

// Helper function to run the scraper in the background for auto-run scheduler
function runScraperBackground(shift, mode = 'pengunjung') {
  if (isScraperRunning) {
    console.log(`[AUTORUN] Scraper sedang berjalan. Slot ${shift} dilewati.`);
    return;
  }

  isScraperRunning = true;
  console.log(`[AUTORUN] [${new Date().toISOString()}] Menjalankan scraper ${shift} (${mode}) otomatis...`);

  const child = spawn('python', ['-u', 'tarik_data.py', shift, mode], {
    cwd: __dirname,
    env: { ...process.env, PYTHONUNBUFFERED: '1', PYTHONIOENCODING: 'utf-8' }
  });

  child.stdout.on('data', (data) => {
    console.log(`[Autoscraper stdout] ${data.toString().trim()}`);
  });

  child.stderr.on('data', (data) => {
    console.error(`[Autoscraper stderr] ${data.toString().trim()}`);
  });

  child.on('error', (err) => {
    isScraperRunning = false;
    console.error(`[AUTORUN ERROR] Gagal menjalankan scraper otomatis: ${err.message}`);
  });

  child.on('close', (code) => {
    isScraperRunning = false;
    console.log(`[AUTORUN] Scraper selesai. Exit code: ${code}`);
  });
}

// Background scheduler running every 30 seconds
setInterval(() => {
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();

  // Batasan jam operasional: 06:00 - 23:00 setiap hari
  if (hour >= 6 && hour <= 23) {
    // Cek kelipatan 15 menit
    if (minute % 15 === 0) {
      // Pembatasan agar tidak jalan setelah pukul 23:00 (misal: 23:15 dibatalkan, 23:00 boleh)
      if (hour === 23 && minute > 0) {
        return;
      }

      const dateStr = now.toISOString().split('T')[0];
      const timeSlot = `${dateStr} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

      if (lastRunSlot !== timeSlot) {
        lastRunSlot = timeSlot;
        const shift = (hour < 16 || (hour === 16 && minute <= 45)) ? 'siang' : 'malam';
        console.log(`[AUTORUN] Mengaktifkan slot ${timeSlot} untuk shift ${shift}...`);
        runScraperBackground(shift);
      }
    }
  }
}, 30000);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server API Lokal berjalan di port ${PORT}, dapat diakses di jaringan lokal.`);
});
