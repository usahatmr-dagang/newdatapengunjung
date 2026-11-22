import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Upload, Trash2, Copy, Image as ImageIcon, Mail, CheckCircle } from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { DailyRecord } from '../types';

interface LaporanWAProps {
  data: DailyRecord[];
}

type Slot = '10:00' | '12:00' | 'penutupan' | 'terkini';

interface Metrics {
  dewasa: number;
  anak: number;
  total: number;
  sepeda: number;
  motor: number;
  mobil: number;
  bus: number;
  tsa: number;
  pps: number;
  jamData: string;
}

interface Photo {
  id: string;
  name: string;
  src: string;
  builtin?: boolean;
}

const BUILTIN_PHOTOS: Photo[] = [
  { id: 'b-simpanse', name: 'Simpanse Ragunan', src: '/chimpanzee_sidebar.png', builtin: true },
  { id: 'b-harimau', name: 'Harimau Sumatera', src: '/harimau.jpg', builtin: true },
  { id: 'b-gajah', name: 'Gajah Sumatera', src: '/gajah.jpg', builtin: true },
  { id: 'b-jerapah', name: 'Jerapah', src: '/jerapah.jpg', builtin: true },
];

const STORAGE_PHOTOS = 'laporan_wa_photos_v1';
const STORAGE_SELECTED = 'laporan_wa_selected_v1';
const EMAIL_RECIPIENTS = ['alfaditmr@gmail.com', 'lilopambudi1300@gmail.com'];

const SLOT_CFG: Record<Slot, { cut: string; label: string | null; title: string }> = {
  '10:00': { cut: '10:00', label: '10:00', title: 'Laporan Pukul 10:00 WIB' },
  '12:00': { cut: '12:00', label: '12:00', title: 'Laporan Pukul 12:00 WIB' },
  penutupan: { cut: '16:30', label: '17:00', title: 'Laporan Penutupan (Data 16:30, Tampil 17:00 WIB)' },
  terkini: { cut: '23:59', label: null, title: 'Data Terkini' },
};

const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

const num = (v: any) => Number(v) || 0;

const fromSnapshot = (h: any): Metrics => ({
  dewasa: num(h.dewasa),
  anak: num(h.anak),
  total: num(h.total_pengunjung),
  sepeda: num(h.sepeda),
  motor: num(h.motor),
  mobil: num(h.mobil),
  bus: num(h.bus),
  tsa: num(h.tsa),
  pps: num(h.pps),
  jamData: String(h.jam || ''),
});

const sumMetrics = (a: Metrics, b: Metrics): Metrics => ({
  dewasa: a.dewasa + b.dewasa,
  anak: a.anak + b.anak,
  total: a.total + b.total,
  sepeda: a.sepeda + b.sepeda,
  motor: a.motor + b.motor,
  mobil: a.mobil + b.mobil,
  bus: a.bus + b.bus,
  tsa: a.tsa + b.tsa,
  pps: a.pps + b.pps,
  jamData: b.jamData || a.jamData,
});

const getMetrics = (record: DailyRecord | undefined, slot: Slot): Metrics | null => {
  if (!record) return null;
  const cut = SLOT_CFG[slot].cut;
  const siangHist: any[] = (record.siang?.history || []).slice().sort((a: any, b: any) => String(a.jam).localeCompare(String(b.jam)));
  const malamHist: any[] = (record.malam?.history || []).slice().sort((a: any, b: any) => String(a.jam).localeCompare(String(b.jam)));

  const siangRekap = record.siang?.rekap as any;
  const malamRekap = record.malam?.rekap as any;

  if (slot === 'terkini') {
    const s: Metrics | null = siangRekap
      ? fromSnapshot({ ...siangRekap, total_pengunjung: siangRekap.total_pengunjung, jam: String(siangRekap.jam_str || '').slice(0, 5) })
      : null;
    const m: Metrics | null = malamRekap
      ? fromSnapshot({ ...malamRekap, total_pengunjung: malamRekap.total_pengunjung, jam: String(malamRekap.jam_str || '').slice(0, 5) })
      : null;
    if (s && m) return sumMetrics(s, m);
    return s || m;
  }

  // Untuk slot Penutupan (data 16:30, tampil 17:00): utamakan rekap siang final atau snapshot <= 16:45
  if (slot === 'penutupan') {
    const candidates1630 = siangHist.filter(h => String(h.jam) <= '16:45');
    if (candidates1630.length > 0) return fromSnapshot(candidates1630[candidates1630.length - 1]);
    if (siangRekap) return fromSnapshot({ ...siangRekap, jam: String(siangRekap.jam_str || '16:30').slice(0, 5) });
  }

  // Slot jam tetap (10:00 / 12:00): ambil snapshot siang terakhir <= batas jam
  const candidates = siangHist.filter(h => String(h.jam) <= cut);
  if (candidates.length > 0) return fromSnapshot(candidates[candidates.length - 1]);

  if (siangRekap && String(siangRekap.jam_str || '').slice(0, 5) <= cut) {
    return fromSnapshot({ ...siangRekap, jam: String(siangRekap.jam_str || '').slice(0, 5) });
  }
  if (candidates.length === 0 && malamHist.length > 0 && cut >= '16:30') {
    return fromSnapshot(malamHist[malamHist.length - 1]);
  }
  return null;
};

const fmt = (n: number) => new Intl.NumberFormat('en-US').format(n || 0);

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Gagal memuat gambar'));
    img.src = src;
  });

const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

const drawPill = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  y: number,
  w: number,
  h: number,
  color: string,
  text: string,
  fontSize = 30
) => {
  const x = cx - w / 2;
  ctx.beginPath();
  ctx.moveTo(x + 14, y);
  ctx.lineTo(x + w - 14, y);
  ctx.lineTo(x + w, y + h / 2);
  ctx.lineTo(x + w - 14, y + h);
  ctx.lineTo(x + 14, y + h);
  ctx.lineTo(x, y + h / 2);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = `800 ${fontSize}px Outfit, Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, cx, y + h / 2 + 1);
};

const drawEmoji = (ctx: CanvasRenderingContext2D, emoji: string, cx: number, cy: number, size: number) => {
  ctx.font = `${size}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#000';
  ctx.fillText(emoji, cx, cy);
};

const drawLabel = (ctx: CanvasRenderingContext2D, text: string, cx: number, y: number) => {
  ctx.font = '800 26px Outfit, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#4a3a22';
  ctx.fillText(text, cx, y);
};

export const LaporanWA: React.FC<LaporanWAProps> = ({ data }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [selectedDate, setSelectedDate] = useState<string>(data[0]?.date || '');
  const [slot, setSlot] = useState<Slot>('12:00');
  const [uploaded, setUploaded] = useState<Photo[]>([]);
  const [selectedPhotoId, setSelectedPhotoId] = useState<string>('b-simpanse');
  const [weather, setWeather] = useState<{ temp: number; desc: string; icon: string } | null>(null);
  const [message, setMessage] = useState<string>('');
  const [syncingCloud, setSyncingCloud] = useState<boolean>(false);

  // Muat foto upload & pilihan terakhir dari Firestore (dan fallback localStorage)
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const raw = localStorage.getItem(STORAGE_PHOTOS);
        if (raw) setUploaded(JSON.parse(raw));
        const sel = localStorage.getItem(STORAGE_SELECTED);
        if (sel) setSelectedPhotoId(sel);
      } catch {
        /* abaikan */
      }

      try {
        const snap = await getDoc(doc(db, 'report_settings', 'config'));
        if (snap.exists()) {
          const d = snap.data();
          if (Array.isArray(d.uploaded_photos)) {
            setUploaded(d.uploaded_photos);
            try {
              localStorage.setItem(STORAGE_PHOTOS, JSON.stringify(d.uploaded_photos));
            } catch {
              /* abaikan */
            }
          }
          if (d.selected_photo_id) {
            setSelectedPhotoId(d.selected_photo_id);
            try {
              localStorage.setItem(STORAGE_SELECTED, d.selected_photo_id);
            } catch {
              /* abaikan */
            }
          }
        }
      } catch {
        /* fallback ke localStorage jika offline */
      }
    };
    loadSettings();
  }, []);

  const syncSettingsToCloud = async (nextPhotos: Photo[], nextSelectedId: string) => {
    try {
      setSyncingCloud(true);
      const all = [...BUILTIN_PHOTOS, ...nextPhotos];
      const active = all.find(p => p.id === nextSelectedId) || all[0];
      await setDoc(doc(db, 'report_settings', 'config'), {
        selected_photo_id: nextSelectedId,
        selected_photo_name: active?.name || 'Simpanse Ragunan',
        selected_photo_src: active?.src || '/chimpanzee_sidebar.png',
        uploaded_photos: nextPhotos,
        email_recipients: EMAIL_RECIPIENTS,
        updated_at: new Date().toISOString(),
      }, { merge: true });
    } catch {
      /* tetap jalan dengan localStorage */
    } finally {
      setSyncingCloud(false);
    }
  };

  useEffect(() => {
    if (!selectedDate && data[0]?.date) setSelectedDate(data[0].date);
  }, [data, selectedDate]);

  // Cuaca Ragunan
  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=-6.3122&longitude=106.8206&current_weather=true');
        const d = await res.json();
        if (d.current_weather) {
          const c = d.current_weather.weathercode;
          let desc = 'Sunny / Cerah';
          let icon = '☀️';
          if (c >= 1 && c <= 3) { desc = 'Cloudy / Berawan'; icon = '⛅'; }
          else if (c >= 45 && c <= 48) { desc = 'Fog / Kabut'; icon = '🌫️'; }
          else if (c >= 51 && c <= 67) { desc = 'Light Rain / Hujan Ringan'; icon = '🌦️'; }
          else if (c >= 80 && c <= 82) { desc = 'Heavy Rain / Hujan Deras'; icon = '🌧️'; }
          else if (c >= 95) { desc = 'Thunderstorm / Badai Petir'; icon = '⛈️'; }
          setWeather({ temp: Math.round(d.current_weather.temperature), desc, icon });
        }
      } catch {
        setWeather(null);
      }
    };
    fetchWeather();
  }, []);

  const allPhotos = useMemo(() => [...BUILTIN_PHOTOS, ...uploaded], [uploaded]);
  const selectedPhoto = allPhotos.find(p => p.id === selectedPhotoId) || allPhotos[0];

  const record = useMemo(() => data.find(r => r.date === selectedDate), [data, selectedDate]);
  const metrics = useMemo(() => getMetrics(record, slot), [record, slot]);

  const titleLine = useMemo(() => {
    if (!selectedDate) return '';
    const d = new Date(selectedDate + 'T00:00:00');
    const cfg = SLOT_CFG[slot];
    const jam = cfg.label || (metrics?.jamData ? metrics.jamData : '--:--');
    return `${HARI[d.getDay()]}, ${String(d.getDate()).padStart(2, '0')} ${BULAN[d.getMonth()]} ${d.getFullYear()} pukul ${jam} WIB`;
  }, [selectedDate, slot, metrics]);

  // Gambar infografis ke canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let cancelled = false;

    const W = 1000;
    const H = 600;
    canvas.width = W;
    canvas.height = H;

    const render = async () => {
      // Latar dasar krem
      ctx.fillStyle = '#e9e4d6';
      ctx.fillRect(0, 0, W, H);

      if (selectedPhoto) {
        try {
          const img = await loadImage(selectedPhoto.src);
          if (cancelled) return;
          const scale = Math.max(W / img.width, H / img.height);
          const dw = img.width * scale;
          const dh = img.height * scale;
          const dx = W - dw;
          const dy = (H - dh) / 2;
          ctx.drawImage(img, dx, dy, dw, dh);
        } catch {
          /* tetap pakai latar polos */
        }
      }

      // Gradien krem/putih di sisi kiri agar teks & angka tajam seperti contoh
      const grad = ctx.createLinearGradient(0, 0, W, 0);
      grad.addColorStop(0, 'rgba(239,235,222,0.97)');
      grad.addColorStop(0.44, 'rgba(239,235,222,0.90)');
      grad.addColorStop(0.62, 'rgba(239,235,222,0.35)');
      grad.addColorStop(0.78, 'rgba(239,235,222,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      // Panji biru-emas + Logo DKI (kiri atas)
      ctx.fillStyle = '#f5b400';
      ctx.beginPath();
      ctx.moveTo(42, 0);
      ctx.lineTo(138, 0);
      ctx.lineTo(138, 110);
      ctx.lineTo(90, 132);
      ctx.lineTo(42, 110);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.moveTo(47, 0);
      ctx.lineTo(133, 0);
      ctx.lineTo(133, 105);
      ctx.lineTo(90, 125);
      ctx.lineTo(47, 105);
      ctx.closePath();
      ctx.fill();

      try {
        const logoDki = await loadImage('/logo-dki.png');
        if (cancelled) return;
        const lh = 76;
        const lw = (logoDki.width / logoDki.height) * lh;
        ctx.drawImage(logoDki, 90 - lw / 2, 18, lw, lh);
      } catch {
        drawEmoji(ctx, '🏛️', 90, 58, 40);
      }

      // Judul DATA PENGUNJUNG
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.font = '900 34px Outfit, Arial, sans-serif';
      ctx.lineWidth = 7;
      ctx.strokeStyle = '#ffffff';
      ctx.strokeText('DATA PENGUNJUNG', 180, 58);
      ctx.fillStyle = '#3b8728';
      ctx.fillText('DATA PENGUNJUNG', 180, 58);

      // Badge tanggal (oranye dengan garis putus-putus)
      roundRect(ctx, 180, 74, 445, 42, 8);
      ctx.fillStyle = '#f7931e';
      ctx.fill();
      ctx.setLineDash([6, 5]);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#4a3520';
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 19px Outfit, Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(titleLine || '-', 402, 96);

      const m = metrics;

      // Dewasa & Anak
      drawEmoji(ctx, '🐅', 105, 184, 72);
      drawLabel(ctx, 'Dewasa', 105, 240);
      drawPill(ctx, 105, 260, 122, 38, '#883997', fmt(m?.dewasa || 0), 28);

      drawEmoji(ctx, '🐯', 246, 184, 72);
      drawLabel(ctx, 'Anak', 246, 240);
      drawPill(ctx, 246, 260, 114, 38, '#883997', fmt(m?.anak || 0), 28);

      // TOTAL
      roundRect(ctx, 362, 165, 138, 38, 2);
      ctx.fillStyle = '#754c24';
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 30px Outfit, Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('TOTAL', 431, 185);

      roundRect(ctx, 326, 203, 210, 62, 2);
      ctx.fillStyle = '#7ab81d';
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 52px Outfit, Arial, sans-serif';
      ctx.fillText(fmt(m?.total || 0), 431, 236);

      // Kendaraan
      drawEmoji(ctx, '🚲', 105, 336, 58);
      drawLabel(ctx, 'Sepeda', 105, 392);
      drawPill(ctx, 105, 410, 106, 36, '#c9403e', fmt(m?.sepeda || 0), 26);

      drawEmoji(ctx, '🏍️', 244, 336, 58);
      drawLabel(ctx, 'Motor', 244, 392);
      drawPill(ctx, 244, 410, 114, 36, '#ec654f', fmt(m?.motor || 0), 26);

      drawEmoji(ctx, '🚗', 376, 336, 58);
      drawLabel(ctx, 'Mobil', 376, 392);
      drawPill(ctx, 376, 410, 114, 36, '#f2b622', fmt(m?.mobil || 0), 26);

      drawEmoji(ctx, '🚌', 504, 336, 58);
      drawLabel(ctx, 'Bus', 504, 392);
      drawPill(ctx, 504, 410, 106, 36, '#8cc63f', fmt(m?.bus || 0), 26);

      // Garis bergelombang putus-putus hijau
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#8cc63f';
      ctx.beginPath();
      for (let x = 34; x <= 450; x += 4) {
        const y = 468 + Math.sin((x - 34) / 8) * 3;
        if (x === 34) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();

      // TSA & PPS
      roundRect(ctx, 78, 484, 134, 34, 17);
      ctx.fillStyle = '#f5a028';
      ctx.fill();
      drawEmoji(ctx, '🐊', 98, 501, 20);
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 21px Outfit, Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(fmt(m?.tsa || 0), 146, 502);
      ctx.beginPath();
      ctx.arc(194, 501, 13, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.fillStyle = '#4a3a22';
      ctx.font = '900 10px Outfit, Arial, sans-serif';
      ctx.fillText('TSA', 194, 502);

      roundRect(ctx, 272, 484, 134, 34, 17);
      ctx.fillStyle = '#f5a028';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(290, 501, 13, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.fillStyle = '#4a3a22';
      ctx.font = '900 10px Outfit, Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PPS', 290, 502);
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 21px Outfit, Arial, sans-serif';
      ctx.fillText(fmt(m?.pps || 0), 338, 502);
      drawEmoji(ctx, '🦍', 388, 501, 20);

      // Kotak Cuaca
      roundRect(ctx, 94, 535, 294, 50, 10);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#99c24d';
      ctx.stroke();
      drawEmoji(ctx, weather?.icon || '⛅', 132, 560, 32);
      ctx.fillStyle = '#222222';
      ctx.font = '800 16px Outfit, Arial, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(weather ? `${weather.temp}° C - ${weather.desc}` : '29° C - Cloudy / Berawan', 165, 561);

      // Lengkungan putih kanan bawah + Logo Ragunan asli
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(815, 600);
      ctx.quadraticCurveTo(845, 520, 1000, 490);
      ctx.lineTo(1000, 600);
      ctx.closePath();
      ctx.fill();

      try {
        const logoR = await loadImage('/logo-ragunan.png');
        if (cancelled) return;
        const rh = 54;
        const rw = (logoR.width / logoR.height) * rh;
        ctx.drawImage(logoR, 986 - rw, 590 - rh, rw, rh);
      } catch {
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.font = '900 22px Outfit, Arial, sans-serif';
        ctx.fillStyle = '#4a3a22';
        ctx.fillText('RAGUNAN', 980, 570);
      }
    };

    render();
    return () => {
      cancelled = true;
    };
  }, [metrics, titleLine, selectedPhoto, weather]);

  const choosePhoto = (id: string) => {
    setSelectedPhotoId(id);
    try {
      localStorage.setItem(STORAGE_SELECTED, id);
    } catch {
      /* abaikan */
    }
    syncSettingsToCloud(uploaded, id);
    const chosen = [...BUILTIN_PHOTOS, ...uploaded].find(p => p.id === id);
    if (chosen) {
      setMessage(`Satwa "${chosen.name}" dipilih & disinkronkan untuk laporan email otomatis.`);
    }
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const img = await loadImage(String(reader.result));
          // Perkecil agar ringan disimpan di Firestore & localStorage
          const maxW = 1000;
          const scale = Math.min(1, maxW / img.width);
          const c = document.createElement('canvas');
          c.width = Math.round(img.width * scale);
          c.height = Math.round(img.height * scale);
          c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
          const src = c.toDataURL('image/jpeg', 0.8);
          const photo: Photo = {
            id: `u-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            name: file.name.replace(/\.[^.]+$/, ''),
            src,
          };
          setUploaded(prev => {
            const next = [...prev, photo];
            try {
              localStorage.setItem(STORAGE_PHOTOS, JSON.stringify(next));
            } catch {
              setMessage('Penyimpanan browser penuh. Hapus beberapa foto lama dulu.');
              return prev;
            }
            setSelectedPhotoId(photo.id);
            try {
              localStorage.setItem(STORAGE_SELECTED, photo.id);
            } catch {
              /* abaikan */
            }
            syncSettingsToCloud(next, photo.id);
            setMessage(`Foto satwa "${photo.name}" berhasil diupload & diaktifkan untuk laporan email otomatis.`);
            return next;
          });
        } catch {
          setMessage('Gagal membaca file gambar.');
        }
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const deletePhoto = (id: string) => {
    const next = uploaded.filter(p => p.id !== id);
    const nextSel = selectedPhotoId === id ? 'b-simpanse' : selectedPhotoId;
    setUploaded(next);
    setSelectedPhotoId(nextSel);
    try {
      localStorage.setItem(STORAGE_PHOTOS, JSON.stringify(next));
      localStorage.setItem(STORAGE_SELECTED, nextSel);
    } catch {
      /* abaikan */
    }
    syncSettingsToCloud(next, nextSel);
  };

  const getBlob = (): Promise<Blob | null> =>
    new Promise(resolve => {
      const canvas = canvasRef.current;
      if (!canvas) return resolve(null);
      canvas.toBlob(b => resolve(b), 'image/png');
    });

  const downloadPng = async () => {
    const blob = await getBlob();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const jamName = (SLOT_CFG[slot].label || metrics?.jamData || 'terkini').replace(':', '');
    a.href = url;
    a.download = `laporan-pengunjung-${selectedDate}-${jamName}.png`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyImage = async () => {
    try {
      const blob = await getBlob();
      if (!blob) return;
      // @ts-ignore ClipboardItem tersedia di browser modern
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setMessage('Gambar disalin ke clipboard. Tinggal paste (Ctrl+V) di WhatsApp atau Email.');
    } catch {
      setMessage('Browser tidak mengizinkan salin gambar. Gunakan tombol Download PNG.');
    }
  };

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Banner Jadwal Email Otomatis */}
      <div className="glass-panel" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px',
        background: 'linear-gradient(90deg, rgba(16,185,129,0.1) 0%, rgba(59,130,246,0.1) 100%)',
        border: '1px solid rgba(16,185,129,0.3)'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: '#34d399', fontSize: '0.95rem' }}>
            <Mail size={18} />
            Pengiriman Laporan Otomatis via Email (Aktif di Server Bot)
          </div>
          <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
            Tujuan: <strong style={{ color: '#fff' }}>alfaditmr@gmail.com</strong> &amp; <strong style={{ color: '#fff' }}>lilopambudi1300@gmail.com</strong>
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Jadwal Kirim: <strong>Pukul 10:00 WIB</strong>, <strong>Pukul 12:00 WIB</strong>, dan <strong>Penutupan Pukul 16:30 WIB (tertulis Pukul 17:00 WIB di laporan)</strong>. Foto satwa yang Anda pilih di bawah ini otomatis dipakai oleh bot saat mengirim email.
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: syncingCloud ? '#fbbf24' : '#34d399', fontWeight: 600 }}>
          <CheckCircle size={15} />
          {syncingCloud ? 'Menyimpan pilihan satwa ke Cloud...' : `Satwa Aktif: ${selectedPhoto?.name || 'Simpanse'}`}
        </div>
      </div>

      <div className="glass-panel" style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
        <span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>Tanggal:</span>
        <select className="input-select" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}>
          {data.map(d => (
            <option key={d.date} value={d.date}>
              {new Date(d.date + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </option>
          ))}
        </select>

        <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.05)', padding: '4px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', flexWrap: 'wrap' }}>
          {(Object.keys(SLOT_CFG) as Slot[]).map(s => (
            <button key={s} className={`btn btn-sm ${slot === s ? 'btn-primary' : ''}`} onClick={() => setSlot(s)} style={{ fontSize: '0.82rem' }}>
              {s === 'penutupan' ? 'Penutupan (Data 16:30 → 17:00)' : s === 'terkini' ? 'Data Terkini' : `Pukul ${s}`}
            </button>
          ))}
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button className="btn" onClick={copyImage} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Copy size={15} /> Salin Gambar
          </button>
          <button className="btn btn-primary" onClick={downloadPng} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Download size={15} /> Download PNG
          </button>
        </div>
      </div>

      {!metrics && (
        <div className="glass-panel" style={{ borderLeft: '4px solid #f59e0b', color: '#fcd34d' }}>
          Belum ada data untuk {SLOT_CFG[slot].title} pada tanggal ini. Coba pilih jam/tanggal lain.
        </div>
      )}

      {message && (
        <div className="glass-panel" style={{ borderLeft: '4px solid #6366f1', padding: '10px 16px', fontSize: '0.9rem' }}>
          {message}
        </div>
      )}

      <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ImageIcon size={18} style={{ color: '#10b981' }} /> Pratinjau Gambar Laporan
        </h3>
        <canvas
          ref={canvasRef}
          style={{ width: '100%', maxWidth: '1000px', borderRadius: '12px', border: '1px solid var(--panel-border)', alignSelf: 'center' }}
        />
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Data jam tetap (10:00, 12:00, dan Penutupan 16:30) diambil dari snapshot Shift Siang pada jam tersebut. Untuk Penutupan, data diambil pukul 16:30 namun di laporan ditulis sebagai pukul 17:00 WIB.
        </span>
      </div>

      <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <h3 style={{ margin: 0 }}>Galeri &amp; Upload Foto Satwa Ragunan</h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Klik foto satwa untuk mengaktifkannya. Anda dapat mengupload foto satwa asli dari Taman Margasatwa Ragunan.
            </span>
          </div>
          <div>
            <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleUpload} style={{ display: 'none' }} />
            <button className="btn btn-primary" onClick={() => fileRef.current?.click()} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Upload size={15} /> Upload Foto Satwa Ragunan
            </button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px' }}>
          {allPhotos.map(p => (
            <div
              key={p.id}
              onClick={() => choosePhoto(p.id)}
              style={{
                position: 'relative',
                cursor: 'pointer',
                borderRadius: '10px',
                overflow: 'hidden',
                border: selectedPhotoId === p.id ? '3px solid #10b981' : '3px solid transparent',
                background: 'rgba(0,0,0,0.25)',
                boxShadow: selectedPhotoId === p.id ? '0 0 12px rgba(16,185,129,0.35)' : 'none',
              }}
            >
              <img src={p.src} alt={p.name} style={{ width: '100%', height: '110px', objectFit: 'cover', display: 'block' }} />
              <div style={{ padding: '6px 8px', fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: selectedPhotoId === p.id ? 700 : 400, color: selectedPhotoId === p.id ? '#34d399' : undefined }}>
                  {p.name}
                </span>
                {!p.builtin && (
                  <button
                    onClick={e => { e.stopPropagation(); deletePhoto(p.id); }}
                    style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', padding: 0 }}
                    title="Hapus foto"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
