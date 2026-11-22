import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Upload, Trash2, Copy, Image as ImageIcon, Mail, CheckCircle, Sliders, RotateCcw } from 'lucide-react';
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
  latin?: string;
  category?: 'reptilia' | 'mamalia' | 'upload';
  src: string;
  wikiTitle?: string;
  builtin?: boolean;
}

const BUILTIN_PHOTOS: Photo[] = [
  { id: 'b-simpanse', name: 'Simpanse Ragunan', latin: 'Pan troglodytes', category: 'mamalia', src: '/chimpanzee_sidebar.png', builtin: true },
  { id: 'b-harimau', name: 'Harimau Sumatera', latin: 'Panthera tigris sumatrae', category: 'mamalia', src: '/harimau.jpg', builtin: true },
  { id: 'b-gajah', name: 'Gajah Sumatera', latin: 'Elephas maximus sumatranus', category: 'mamalia', src: '/gajah.jpg', builtin: true },
  { id: 'b-jerapah', name: 'Jerapah', latin: 'Giraffa camelopardalis', category: 'mamalia', src: '/jerapah.jpg', builtin: true },
];

// 28 Satwa dari daftar II. KELAS : REPTILIA Taman Margasatwa Ragunan
const REPTILIA_LIST: { id: string; no: number; name: string; latin: string; wikiTitle: string }[] = [
  { id: 'rep-1', no: 1, name: 'Biawak Salvator', latin: 'Varanus salvator', wikiTitle: 'Varanus_salvator' },
  { id: 'rep-2', no: 2, name: 'Biawak Komodo', latin: 'Varanus komodoensis', wikiTitle: 'Komodo_dragon' },
  { id: 'rep-3', no: 3, name: 'Buaya Air Tawar Irian', latin: 'Crocodylus novaeguineae', wikiTitle: 'New_Guinea_crocodile' },
  { id: 'rep-4', no: 4, name: 'Buaya Muara', latin: 'Crocodylus porosus', wikiTitle: 'Saltwater_crocodile' },
  { id: 'rep-5', no: 5, name: 'Buaya Siam', latin: 'Crocodylus siamensis', wikiTitle: 'Siamese_crocodile' },
  { id: 'rep-6', no: 6, name: 'Buaya Sinyulong', latin: 'Tomistoma schlegelii', wikiTitle: 'False_gharial' },
  { id: 'rep-7', no: 7, name: 'Bulus', latin: 'Trionyx cartilagineus', wikiTitle: 'Asiatic_softshell_turtle' },
  { id: 'rep-8', no: 8, name: 'Cincin Mas', latin: 'Boiga d. dendrophila', wikiTitle: 'Boiga_dendrophila' },
  { id: 'rep-9', no: 9, name: 'Iguana Hijau', latin: 'Iguana iguana', wikiTitle: 'Green_iguana' },
  { id: 'rep-10', no: 10, name: 'Iguana Merah', latin: 'Iguana iguana (Red)', wikiTitle: 'Iguana_iguana' },
  { id: 'rep-11', no: 11, name: 'Kadal Panana', latin: 'Tiliqua gigas', wikiTitle: 'Indonesian_blue-tongued_skink' },
  { id: 'rep-12', no: 12, name: 'Koros', latin: 'Ptyas koros', wikiTitle: 'Ptyas_koros' },
  { id: 'rep-13', no: 13, name: 'Kura-kura Aldabra', latin: 'Aldabrachelys gigantea', wikiTitle: 'Aldabra_giant_tortoise' },
  { id: 'rep-14', no: 14, name: 'Kura-kura Kaki Gajah/Darat', latin: 'Testudo emys', wikiTitle: 'Asian_forest_tortoise' },
  { id: 'rep-15', no: 15, name: 'Kura-kura Kalimantan', latin: 'Orlitia borneensis', wikiTitle: 'Malaysian_giant_turtle' },
  { id: 'rep-16', no: 16, name: 'Kura-kura Leher Panjang', latin: 'Chelodina novaeguineae', wikiTitle: 'New_Guinea_snake-necked_turtle' },
  { id: 'rep-17', no: 17, name: 'Kura-kura Moncong Babi', latin: 'Carettochelys insculpta', wikiTitle: 'Pig-nosed_turtle' },
  { id: 'rep-18', no: 18, name: 'Kura-kura Pipi Merah', latin: 'Pseudemys scripta elegans', wikiTitle: 'Red-eared_slider' },
  { id: 'rep-19', no: 19, name: 'Kura-kura Sawah', latin: 'Cuora amboinensis', wikiTitle: 'Southeast_Asian_box_turtle' },
  { id: 'rep-20', no: 20, name: 'Kura-kura Snaping/Purba', latin: 'Macrochelys temminckii', wikiTitle: 'Alligator_snapping_turtle' },
  { id: 'rep-21', no: 21, name: 'Kura-kura Spinosa', latin: 'Heosemys spinosa', wikiTitle: 'Spiny_turtle' },
  { id: 'rep-22', no: 22, name: 'Kura-kura Sulcata', latin: 'Centrochelys sulcata', wikiTitle: 'African_spurred_tortoise' },
  { id: 'rep-23', no: 23, name: 'Labi-Labi', latin: 'Chitra indica', wikiTitle: 'Indian_narrow-headed_softshell_turtle' },
  { id: 'rep-24', no: 24, name: 'Sanca Kembang', latin: 'Python reticulatus', wikiTitle: 'Reticulated_python' },
  { id: 'rep-25', no: 25, name: 'Sanca Sawah Putih', latin: 'Python molurus albino', wikiTitle: 'Burmese_python' },
  { id: 'rep-26', no: 26, name: 'Sendok Raja (King Cobra)', latin: 'Ophiophagus hannah', wikiTitle: 'King_cobra' },
  { id: 'rep-27', no: 27, name: 'Soa-Soa Amboinensis', latin: 'Hydrosaurus amboinensis', wikiTitle: 'Amboina_sailfin_lizard' },
  { id: 'rep-28', no: 28, name: 'Ular Tikus/Ular Sapi', latin: 'Elaphe radiata', wikiTitle: 'Radiated_ratsnake' },
];

const STORAGE_PHOTOS = 'laporan_wa_photos_v1';
const STORAGE_SELECTED = 'laporan_wa_selected_v1';
const STORAGE_WIKI_CACHE = 'laporan_wa_reptilia_wiki_v1';
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

  if (slot === 'penutupan') {
    const candidates1630 = siangHist.filter(h => String(h.jam) <= '16:45');
    if (candidates1630.length > 0) return fromSnapshot(candidates1630[candidates1630.length - 1]);
    if (siangRekap) return fromSnapshot({ ...siangRekap, jam: String(siangRekap.jam_str || '16:30').slice(0, 5) });
  }

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
  fontSize = 28
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
  ctx.font = '800 25px Outfit, Arial, sans-serif';
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
  const [reptiliaPhotos, setReptiliaPhotos] = useState<Photo[]>([]);
  const [galleryTab, setGalleryTab] = useState<'all' | 'reptilia' | 'mamalia'>('all');
  const [selectedPhotoId, setSelectedPhotoId] = useState<string>('b-simpanse');
  const [weather, setWeather] = useState<{ temp: number; desc: string; icon: string } | null>(null);
  const [message, setMessage] = useState<string>('');
  const [syncingCloud, setSyncingCloud] = useState<boolean>(false);

  // Pengaturan posisi satwa di sebelah kanan agar tidak pernah terpotong
  const [photoOffsetX, setPhotoOffsetX] = useState<number>(0);
  const [photoOffsetY, setPhotoOffsetY] = useState<number>(0);
  const [photoZoom, setPhotoZoom] = useState<number>(1.0);
  const [photoFitMode, setPhotoFitMode] = useState<'contain_right' | 'cover_right'>('contain_right');

  // Ambil gambar satwa Kelas Reptilia dari Wikipedia REST API secara otomatis
  useEffect(() => {
    let active = true;
    const loadReptiliaFromWiki = async () => {
      let cachedMap: Record<string, string> = {};
      try {
        const rawCache = localStorage.getItem(STORAGE_WIKI_CACHE);
        if (rawCache) cachedMap = JSON.parse(rawCache);
      } catch {
        /* abaikan */
      }

      // Set daftar awal dari cache yang sudah ada
      const initialList: Photo[] = REPTILIA_LIST.map(item => ({
        id: item.id,
        name: `${item.no}. ${item.name}`,
        latin: item.latin,
        category: 'reptilia' as const,
        src: cachedMap[item.id] || '',
        wikiTitle: item.wikiTitle,
        builtin: true,
      }));
      if (active) setReptiliaPhotos(initialList.filter(p => !!p.src));

      // Fetch yang belum ada di cache secara paralel
      const missing = REPTILIA_LIST.filter(item => !cachedMap[item.id]);
      if (missing.length > 0) {
        await Promise.all(
          missing.map(async item => {
            try {
              const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(item.wikiTitle)}`);
              if (!res.ok) return;
              const d = await res.json();
              const thumbUrl: string = d?.thumbnail?.source || d?.originalimage?.source || '';
              if (thumbUrl) {
                // Ubah ukuran thumbnail Wikipedia ke 960px agar tajam namun cepat dimuat
                const highRes = thumbUrl.replace(/\/\d+px-/, '/960px-');
                cachedMap[item.id] = highRes;
              }
            } catch {
              /* abaikan jika gagal */
            }
          })
        );
        try {
          localStorage.setItem(STORAGE_WIKI_CACHE, JSON.stringify(cachedMap));
        } catch {
          /* abaikan */
        }
      }

      if (active) {
        const loaded: Photo[] = REPTILIA_LIST.map(item => ({
          id: item.id,
          name: `${item.no}. ${item.name}`,
          latin: item.latin,
          category: 'reptilia' as const,
          src: cachedMap[item.id] || '',
          wikiTitle: item.wikiTitle,
          builtin: true,
        })).filter(p => !!p.src);
        setReptiliaPhotos(loaded);
      }
    };

    loadReptiliaFromWiki();
    return () => {
      active = false;
    };
  }, []);

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
          if (typeof d.photo_offset_x === 'number') setPhotoOffsetX(d.photo_offset_x);
          if (typeof d.photo_offset_y === 'number') setPhotoOffsetY(d.photo_offset_y);
          if (typeof d.photo_zoom === 'number') setPhotoZoom(d.photo_zoom);
          if (d.photo_fit_mode === 'contain_right' || d.photo_fit_mode === 'cover_right') {
            setPhotoFitMode(d.photo_fit_mode);
          }
        }
      } catch {
        /* fallback ke localStorage jika offline */
      }
    };
    loadSettings();
  }, []);

  const allPhotos = useMemo(() => [...BUILTIN_PHOTOS, ...reptiliaPhotos, ...uploaded], [reptiliaPhotos, uploaded]);
  const selectedPhoto = allPhotos.find(p => p.id === selectedPhotoId) || allPhotos[0];

  // Konversi gambar satwa yang dipilih ke Base64 Data URL agar bot GitHub Actions bisa langsung menggunakannya tanpa masalah CORS
  const toBase64DataUrl = async (srcUrl: string): Promise<string> => {
    if (!srcUrl || srcUrl.startsWith('data:image/') || srcUrl.startsWith('/')) return srcUrl;
    try {
      const img = await loadImage(srcUrl);
      const maxW = 960;
      const scale = Math.min(1, maxW / img.width);
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL('image/jpeg', 0.82);
    } catch {
      return srcUrl;
    }
  };

  const syncSettingsToCloud = async (
    nextPhotos: Photo[],
    nextSelectedId: string,
    opts?: { offsetX?: number; offsetY?: number; zoom?: number; fitMode?: 'contain_right' | 'cover_right' }
  ) => {
    try {
      setSyncingCloud(true);
      const all = [...BUILTIN_PHOTOS, ...reptiliaPhotos, ...nextPhotos];
      const active = all.find(p => p.id === nextSelectedId) || all[0];
      const portableSrc = await toBase64DataUrl(active?.src || '/chimpanzee_sidebar.png');
      await setDoc(doc(db, 'report_settings', 'config'), {
        selected_photo_id: nextSelectedId,
        selected_photo_name: active?.name || 'Simpanse Ragunan',
        selected_photo_src: portableSrc,
        photo_offset_x: opts?.offsetX ?? photoOffsetX,
        photo_offset_y: opts?.offsetY ?? photoOffsetY,
        photo_zoom: opts?.zoom ?? photoZoom,
        photo_fit_mode: opts?.fitMode ?? photoFitMode,
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
      // 1. Latar dasar krem hangat
      ctx.fillStyle = '#efebde';
      ctx.fillRect(0, 0, W, H);

      // 2. Gambar Satwa khusus di area SEBELAH KANAN (x: 470..1000) agar satwa utuh dan TIDAK TERPOTONG
      if (selectedPhoto) {
        try {
          const img = await loadImage(selectedPhoto.src);
          if (cancelled) return;

          const rightZoneX = 470;
          const rightZoneW = W - rightZoneX; // 530px
          const rightZoneH = H;              // 600px

          // Latar blur/ambient lembut di belakang area kanan agar tidak pernah ada ruang kosong meski foto lanskap lebar
          ctx.save();
          const bgScale = Math.max(rightZoneW / img.width, rightZoneH / img.height) * 1.15;
          const bgW = img.width * bgScale;
          const bgH = img.height * bgScale;
          const bgX = rightZoneX + (rightZoneW - bgW) / 2;
          const bgY = (rightZoneH - bgH) / 2;
          ctx.filter = 'blur(18px) brightness(0.92)';
          ctx.drawImage(img, bgX, bgY, bgW, bgH);
          ctx.restore();

          // Gambar satwa utama ditempatkan di sebelah kanan (pusat di x ~ 745)
          ctx.save();
          let baseScale: number;
          if (photoFitMode === 'contain_right') {
            // Mode anti-terpotong: pastikan tinggi/lebar utama satwa muat penuh di sisi kanan
            baseScale = Math.min(rightZoneW / img.width, rightZoneH / img.height);
            // Jika gambar lanskap sangat melebar, beri sedikit ekstra tinggi agar proporsional di kanan
            if (img.width / img.height > 1.25) {
              baseScale = Math.min((rightZoneW * 1.18) / img.width, rightZoneH / img.height);
            } else {
              baseScale = Math.max(baseScale, Math.min(rightZoneW / img.width, rightZoneH / img.height) * 1.04);
            }
          } else {
            baseScale = Math.max(rightZoneW / img.width, rightZoneH / img.height);
          }

          const finalScale = baseScale * photoZoom;
          const dw = img.width * finalScale;
          const dh = img.height * finalScale;

          // Posisikan tengah foto tepat di area kanan (x = 745) + offset manual pengguna
          const rightCenterX = rightZoneX + rightZoneW / 2 + 10; // ~745
          let dx = rightCenterX - dw / 2 + photoOffsetX;
          // Jika lebar gambar menutup sisi kanan, jaga agar tepi kanan tidak kosong
          if (dx + dw < W && dw >= rightZoneW) {
            dx = W - dw + photoOffsetX;
          }
          const dy = (H - dh) / 2 + photoOffsetY;

          ctx.drawImage(img, dx, dy, dw, dh);
          ctx.restore();
        } catch {
          /* tetap pakai latar krem */
        }
      }

      // 3. Gradien krem halus HANYA di sisi kiri s/d tengah (x: 0..560) agar satwa di kanan (x: 560..1000) 100% JERNIH & TIDAK TERTUTUP
      const grad = ctx.createLinearGradient(0, 0, W, 0);
      grad.addColorStop(0, 'rgba(239,235,222,1)');
      grad.addColorStop(0.45, 'rgba(239,235,222,0.98)');
      grad.addColorStop(0.51, 'rgba(239,235,222,0.72)');
      grad.addColorStop(0.57, 'rgba(239,235,222,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      // 4. Panji biru-emas + Logo DKI (kiri atas)
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

      // 5. Judul DATA PENGUNJUNG
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.font = '900 33px Outfit, Arial, sans-serif';
      ctx.lineWidth = 7;
      ctx.strokeStyle = '#ffffff';
      ctx.strokeText('DATA PENGUNJUNG', 172, 56);
      ctx.fillStyle = '#3b8728';
      ctx.fillText('DATA PENGUNJUNG', 172, 56);

      // 6. Badge tanggal (oranye dengan garis putus-putus, ukuran kompak di sisi kiri)
      roundRect(ctx, 172, 72, 376, 40, 8);
      ctx.fillStyle = '#f7931e';
      ctx.fill();
      ctx.setLineDash([6, 4]);
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = '#4a3520';
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 16.5px Outfit, Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(titleLine || '-', 360, 93);

      const m = metrics;

      // 7. Dewasa & Anak
      drawEmoji(ctx, '🐅', 96, 182, 68);
      drawLabel(ctx, 'Dewasa', 96, 238);
      drawPill(ctx, 96, 258, 118, 36, '#883997', fmt(m?.dewasa || 0), 26);

      drawEmoji(ctx, '🐯', 228, 182, 68);
      drawLabel(ctx, 'Anak', 228, 238);
      drawPill(ctx, 228, 258, 110, 36, '#883997', fmt(m?.anak || 0), 26);

      // 8. TOTAL (dikompakkan di area kiri x: 305..495 agar tidak menyentuh satwa di kanan)
      roundRect(ctx, 338, 164, 130, 36, 3);
      ctx.fillStyle = '#754c24';
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 28px Outfit, Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('TOTAL', 403, 183);

      roundRect(ctx, 306, 200, 194, 58, 3);
      ctx.fillStyle = '#7ab81d';
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 46px Outfit, Arial, sans-serif';
      ctx.fillText(fmt(m?.total || 0), 403, 231);

      // 9. Kendaraan (Sepeda, Motor, Mobil, Bus di x: 88..454)
      drawEmoji(ctx, '🚲', 88, 334, 54);
      drawLabel(ctx, 'Sepeda', 88, 388);
      drawPill(ctx, 88, 406, 98, 34, '#c9403e', fmt(m?.sepeda || 0), 24);

      drawEmoji(ctx, '🏍️', 208, 334, 54);
      drawLabel(ctx, 'Motor', 208, 388);
      drawPill(ctx, 208, 406, 108, 34, '#ec654f', fmt(m?.motor || 0), 24);

      drawEmoji(ctx, '🚗', 330, 334, 54);
      drawLabel(ctx, 'Mobil', 330, 388);
      drawPill(ctx, 330, 406, 108, 34, '#f2b622', fmt(m?.mobil || 0), 24);

      drawEmoji(ctx, '🚌', 448, 334, 54);
      drawLabel(ctx, 'Bus', 448, 388);
      drawPill(ctx, 448, 406, 96, 34, '#8cc63f', fmt(m?.bus || 0), 24);

      // 10. Garis bergelombang putus-putus hijau
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#8cc63f';
      ctx.beginPath();
      for (let x = 36; x <= 465; x += 4) {
        const y = 464 + Math.sin((x - 36) / 8) * 2.5;
        if (x === 36) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();

      // 11. TSA & PPS
      roundRect(ctx, 74, 480, 140, 34, 17);
      ctx.fillStyle = '#f5a028';
      ctx.fill();
      drawEmoji(ctx, '🐊', 94, 497, 19);
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 20px Outfit, Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(fmt(m?.tsa || 0), 144, 498);
      ctx.beginPath();
      ctx.arc(196, 497, 13, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.fillStyle = '#4a3a22';
      ctx.font = '900 10px Outfit, Arial, sans-serif';
      ctx.fillText('TSA', 196, 498);

      roundRect(ctx, 260, 480, 140, 34, 17);
      ctx.fillStyle = '#f5a028';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(278, 497, 13, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.fillStyle = '#4a3a22';
      ctx.font = '900 10px Outfit, Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PPS', 278, 498);
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 20px Outfit, Arial, sans-serif';
      ctx.fillText(fmt(m?.pps || 0), 330, 498);
      drawEmoji(ctx, '🦍', 380, 497, 19);

      // 12. Kotak Keterangan Cuaca (Dirapikan: lebar dinamis mengikuti panjang teks, ikon & teks rata tengah sempurna)
      const weatherStr = weather ? `${weather.temp}° C - ${weather.desc}` : '29° C - Cloudy / Berawan';
      ctx.font = '800 16px Outfit, Arial, sans-serif';
      const textW = ctx.measureText(weatherStr).width;
      const wBoxW = Math.max(326, Math.min(430, Math.round(textW + 88)));
      const wBoxH = 48;
      const wBoxX = Math.max(38, Math.round(237 - wBoxW / 2));
      const wBoxY = 532;

      // Bayangan halus & bingkai luar hijau-kuning seperti contoh
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.14)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 2;
      roundRect(ctx, wBoxX, wBoxY, wBoxW, wBoxH, 12);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.restore();

      roundRect(ctx, wBoxX, wBoxY, wBoxW, wBoxH, 12);
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#99c24d';
      ctx.stroke();

      // Lingkaran latar ikon cuaca di sisi kiri kotak
      const iconCx = wBoxX + 32;
      const iconCy = wBoxY + wBoxH / 2;
      ctx.beginPath();
      ctx.arc(iconCx, iconCy, 17, 0, Math.PI * 2);
      ctx.fillStyle = '#f0f9ff';
      ctx.fill();
      drawEmoji(ctx, weather?.icon || '⛅', iconCx, iconCy + 1, 22);

      // Teks cuaca rata tengah di sisa ruang sebelah kanan ikon
      ctx.fillStyle = '#1f2937';
      ctx.font = '800 16px Outfit, Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const textAreaCenterX = wBoxX + 56 + (wBoxW - 66) / 2;
      ctx.fillText(weatherStr, textAreaCenterX, iconCy + 1);

      // 13. Lengkungan putih kanan bawah + Logo Vector Taman Margasatwa Ragunan yang bersih
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(790, 600);
      ctx.quadraticCurveTo(835, 515, 1000, 485);
      ctx.lineTo(1000, 600);
      ctx.closePath();
      ctx.fill();

      // Ikon daun/tunas hijau khas logo Ragunan
      const lx = 856;
      const ly = 568;
      ctx.beginPath();
      ctx.arc(lx, ly, 16, 0, Math.PI * 2);
      ctx.fillStyle = '#8cc63f';
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 16px Outfit, Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🌿', lx, ly);

      // Teks Logo RAGUNAN
      ctx.textAlign = 'left';
      ctx.fillStyle = '#6b7280';
      ctx.font = '700 8.5px Outfit, Arial, sans-serif';
      ctx.fillText('TAMAN MARGASATWA', 878, 555);
      ctx.fillStyle = '#4a3520';
      ctx.font = '900 20px Outfit, Arial, sans-serif';
      ctx.fillText('RAGUNAN', 878, 571);
      ctx.fillStyle = '#8cc63f';
      ctx.font = '700 7.5px Outfit, Arial, sans-serif';
      ctx.fillText('JAKARTA - INDONESIA', 878, 584);
    };

    render();
    return () => {
      cancelled = true;
    };
  }, [metrics, titleLine, selectedPhoto, weather, photoOffsetX, photoOffsetY, photoZoom, photoFitMode]);

  const choosePhoto = (id: string) => {
    setSelectedPhotoId(id);
    try {
      localStorage.setItem(STORAGE_SELECTED, id);
    } catch {
      /* abaikan */
    }
    syncSettingsToCloud(uploaded, id);
    const chosen = allPhotos.find(p => p.id === id);
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
          const maxW = 1000;
          const scale = Math.min(1, maxW / img.width);
          const c = document.createElement('canvas');
          c.width = Math.round(img.width * scale);
          c.height = Math.round(img.height * scale);
          c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
          const src = c.toDataURL('image/jpeg', 0.82);
          const photo: Photo = {
            id: `u-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            name: file.name.replace(/\.[^.]+$/, ''),
            category: 'upload',
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

  const filteredGallery = useMemo(() => {
    if (galleryTab === 'reptilia') return reptiliaPhotos;
    if (galleryTab === 'mamalia') return [...BUILTIN_PHOTOS, ...uploaded];
    return allPhotos;
  }, [galleryTab, reptiliaPhotos, uploaded, allPhotos]);

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
            Jadwal Kirim: <strong>Pukul 10:00 WIB</strong>, <strong>Pukul 12:00 WIB</strong>, dan <strong>Penutupan Pukul 16:30 WIB (tertulis Pukul 17:00 WIB di laporan)</strong>. Foto satwa &amp; posisi yang Anda atur di bawah otomatis dipakai oleh bot saat mengirim email.
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

      <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ImageIcon size={18} style={{ color: '#10b981' }} /> Pratinjau Gambar Laporan
          </h3>

          {/* Kontrol Posisi & Ukuran Satwa agar selalu pas di kanan & tidak terpotong */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap',
            background: 'rgba(0,0,0,0.25)',
            padding: '6px 12px',
            borderRadius: '10px',
            border: '1px solid rgba(255,255,255,0.08)',
            fontSize: '0.8rem'
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#60a5fa', fontWeight: 600 }}>
              <Sliders size={14} /> Posisi Satwa (Kanan):
            </span>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                className={`btn btn-sm ${photoFitMode === 'contain_right' ? 'btn-primary' : ''}`}
                onClick={() => {
                  setPhotoFitMode('contain_right');
                  syncSettingsToCloud(uploaded, selectedPhotoId, { fitMode: 'contain_right' });
                }}
                style={{ fontSize: '0.75rem', padding: '3px 8px' }}
              >
                Utuh (Anti-Terpotong)
              </button>
              <button
                className={`btn btn-sm ${photoFitMode === 'cover_right' ? 'btn-primary' : ''}`}
                onClick={() => {
                  setPhotoFitMode('cover_right');
                  syncSettingsToCloud(uploaded, selectedPhotoId, { fitMode: 'cover_right' });
                }}
                style={{ fontSize: '0.75rem', padding: '3px 8px' }}
              >
                Penuh Kanan
              </button>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
              Geser Kiri/Kanan:
              <input
                type="range"
                min={-180}
                max={180}
                value={photoOffsetX}
                onChange={e => setPhotoOffsetX(Number(e.target.value))}
                onMouseUp={() => syncSettingsToCloud(uploaded, selectedPhotoId, { offsetX: photoOffsetX })}
                onTouchEnd={() => syncSettingsToCloud(uploaded, selectedPhotoId, { offsetX: photoOffsetX })}
                style={{ width: '85px' }}
              />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
              Geser Atas/Bawah:
              <input
                type="range"
                min={-150}
                max={150}
                value={photoOffsetY}
                onChange={e => setPhotoOffsetY(Number(e.target.value))}
                onMouseUp={() => syncSettingsToCloud(uploaded, selectedPhotoId, { offsetY: photoOffsetY })}
                onTouchEnd={() => syncSettingsToCloud(uploaded, selectedPhotoId, { offsetY: photoOffsetY })}
                style={{ width: '75px' }}
              />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
              Zoom:
              <input
                type="range"
                min={0.75}
                max={1.6}
                step={0.05}
                value={photoZoom}
                onChange={e => setPhotoZoom(Number(e.target.value))}
                onMouseUp={() => syncSettingsToCloud(uploaded, selectedPhotoId, { zoom: photoZoom })}
                onTouchEnd={() => syncSettingsToCloud(uploaded, selectedPhotoId, { zoom: photoZoom })}
                style={{ width: '75px' }}
              />
            </label>
            <button
              className="btn btn-sm"
              onClick={() => {
                setPhotoOffsetX(0);
                setPhotoOffsetY(0);
                setPhotoZoom(1.0);
                setPhotoFitMode('contain_right');
                syncSettingsToCloud(uploaded, selectedPhotoId, { offsetX: 0, offsetY: 0, zoom: 1.0, fitMode: 'contain_right' });
              }}
              style={{ fontSize: '0.75rem', padding: '3px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
              title="Reset posisi satwa"
            >
              <RotateCcw size={13} /> Reset
            </button>
          </div>
        </div>

        <canvas
          ref={canvasRef}
          style={{ width: '100%', maxWidth: '1000px', borderRadius: '12px', border: '1px solid var(--panel-border)', alignSelf: 'center' }}
        />
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Gambar satwa otomatis ditempatkan di area sebelah kanan sehingga tidak tertutup kotak angka TOTAL dan tidak terpotong. Anda juga dapat menggeser posisi atau zoom satwa menggunakan pengatur di atas.
        </span>
      </div>

      <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 style={{ margin: 0 }}>Galeri Satwa Ragunan (Termasuk 28 Satwa Kelas Reptilia)</h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Klik salah satu satwa di bawah untuk mengaktifkannya pada laporan, atau upload foto satwa sendiri.
            </span>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '4px', background: 'rgba(0,0,0,0.25)', padding: '4px', borderRadius: '8px' }}>
              <button
                className={`btn btn-sm ${galleryTab === 'all' ? 'btn-primary' : ''}`}
                onClick={() => setGalleryTab('all')}
                style={{ fontSize: '0.78rem' }}
              >
                Semua ({allPhotos.length})
              </button>
              <button
                className={`btn btn-sm ${galleryTab === 'reptilia' ? 'btn-primary' : ''}`}
                onClick={() => setGalleryTab('reptilia')}
                style={{ fontSize: '0.78rem' }}
              >
                II. Kelas Reptilia ({reptiliaPhotos.length})
              </button>
              <button
                className={`btn btn-sm ${galleryTab === 'mamalia' ? 'btn-primary' : ''}`}
                onClick={() => setGalleryTab('mamalia')}
                style={{ fontSize: '0.78rem' }}
              >
                Mamalia &amp; Upload ({BUILTIN_PHOTOS.length + uploaded.length})
              </button>
            </div>
            <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleUpload} style={{ display: 'none' }} />
            <button className="btn btn-primary" onClick={() => fileRef.current?.click()} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Upload size={15} /> Upload Foto Satwa
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(165px, 1fr))', gap: '12px' }}>
          {filteredGallery.map(p => (
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
              <img src={p.src} alt={p.name} style={{ width: '100%', height: '115px', objectFit: 'cover', display: 'block' }} />
              <div style={{ padding: '6px 8px', fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: selectedPhotoId === p.id ? 700 : 600, color: selectedPhotoId === p.id ? '#34d399' : '#e2e8f0' }}>
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
                {p.latin && (
                  <span style={{ fontSize: '0.72rem', fontStyle: 'italic', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.latin}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
