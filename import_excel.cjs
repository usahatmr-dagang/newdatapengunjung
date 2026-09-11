const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

const EXCEL_FILE = 'backup data pengunjung.xlsx';
const DATA_DIR = path.join(__dirname, 'data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Convert Excel Serial Date to YYYY-MM-DD
function excelDateToJSDate(serial) {
  // Excel epoch is 1899-12-30.
  const excelEpoch = new Date(Date.UTC(1899, 11, 30));
  const jsDate = new Date(excelEpoch.getTime() + serial * 86400000);
  return jsDate;
}

function formatDateToYYYYMMDD(date) {
  return date.toISOString().split('T')[0];
}

function formatTimeToHHMM(excelTimeFraction) {
  if (excelTimeFraction == null) return "00:00";
  const totalSeconds = Math.round(excelTimeFraction * 86400);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

const wb = xlsx.readFile(EXCEL_FILE);

const harianSiang = xlsx.utils.sheet_to_json(wb.Sheets['Database pengunjung harian']);
const harianMalam = xlsx.utils.sheet_to_json(wb.Sheets['database_malam']);
const jamSiang = xlsx.utils.sheet_to_json(wb.Sheets['data_siang']);
const jamMalam = xlsx.utils.sheet_to_json(wb.Sheets['data_malam']);

const dailyData = {};

function initDateData(dateStr) {
  if (!dailyData[dateStr]) {
    dailyData[dateStr] = {
      date: dateStr,
      siang: { rekap: {}, history: [] },
      malam: { rekap: {}, history: [] }
    };
  }
}

// Process Daily Siang
harianSiang.forEach(row => {
  if (!row.Tanggal) return;
  const jsDate = excelDateToJSDate(row.Tanggal);
  const dateStr = formatDateToYYYYMMDD(jsDate);
  initDateData(dateStr);
  
  dailyData[dateStr].siang.rekap = {
    total_pengunjung: row['TOTAL PENGUNJUNG HARIAN'] || 0,
    motor: row.motor || 0,
    mobil: row.mobil || 0,
    bus: row.bus || 0,
    sepeda: row.sepeda || 0,
    pps: row.PPS || 0,
    tsa: row.TSA || 0,
    anak: row.Anak || 0,
    dewasa: row.Dewasa || 0,
    bus_gol_1: row['Bus Gol 1'] || 0,
    bus_gol_2: row['Bus Gol 2'] || 0,
    tanggal_str: dateStr
  };
});

// Process Daily Malam
harianMalam.forEach(row => {
  if (!row.Tanggal) return;
  const jsDate = excelDateToJSDate(row.Tanggal);
  const dateStr = formatDateToYYYYMMDD(jsDate);
  initDateData(dateStr);
  
  dailyData[dateStr].malam.rekap = {
    total_pengunjung: row['TOTAL PENGUNJUNG HARIAN'] || 0,
    motor: row.motor || 0,
    mobil: row.mobil || 0,
    bus: row.bus || 0,
    sepeda: row.sepeda || 0,
    anak: row['anak '] || row.anak || 0,
    dewasa: row.dewasa || 0,
    tanggal_str: dateStr
  };
});

// Process Hourly Siang
jamSiang.forEach(row => {
  if (!row.tanggal) return;
  const jsDate = excelDateToJSDate(row.tanggal);
  const dateStr = formatDateToYYYYMMDD(jsDate);
  initDateData(dateStr);
  
  const timeStr = formatTimeToHHMM(row.jam);
  
  dailyData[dateStr].siang.history.push({
    timestamp: `${dateStr}T${timeStr}:00.000`,
    jam: timeStr,
    total_pengunjung: row['TOTAL PENGUNJUNG'] || 0,
    anak: row.anak || 0,
    dewasa: row.dewasa || 0,
    pps: row.PPS || 0,
    tsa: row.TSA || 0,
    motor: row.motor || 0,
    mobil: row.mobil || 0,
    bus: row.bus || 0,
    sepeda: row.sepeda || 0
  });
});

// Process Hourly Malam
jamMalam.forEach(row => {
  if (!row.tanggal) return;
  const jsDate = excelDateToJSDate(row.tanggal);
  const dateStr = formatDateToYYYYMMDD(jsDate);
  initDateData(dateStr);
  
  const timeStr = formatTimeToHHMM(row.jam);
  
  dailyData[dateStr].malam.history.push({
    timestamp: `${dateStr}T${timeStr}:00.000`,
    jam: timeStr,
    total_pengunjung: row['TOTAL PENGUNJUNG'] || 0,
    anak: row.anak || 0,
    dewasa: row.dewasa || 0,
    pps: row.PPS || 0,
    tsa: row.TSA || 0,
    motor: row.motor || 0,
    mobil: row.mobil || 0,
    bus: row.bus || 0,
    sepeda: row.sepeda || 0
  });
});

// Save all to files
let processedCount = 0;
let skippedCount = 0;
Object.values(dailyData).forEach(data => {
  const filePath = path.join(DATA_DIR, `${data.date}.json`);
  
  if (fs.existsSync(filePath)) {
    skippedCount++;
    return; // Skip if date already exists in database
  }

  // Sort history based on jam
  data.siang.history.sort((a, b) => a.jam.localeCompare(b.jam));
  data.malam.history.sort((a, b) => a.jam.localeCompare(b.jam));
  
  // Set last_run as fallback
  data.siang.last_run = new Date().toISOString();
  data.malam.last_run = new Date().toISOString();
  
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  processedCount++;
});

console.log(`✅ Berhasil memproses dan menyimpan ${processedCount} file harian baru ke folder data/!`);
console.log(`⏭️ Dilewati: ${skippedCount} file yang sudah ada di database.`);
