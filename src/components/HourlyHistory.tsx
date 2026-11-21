import React, { useState, useEffect, useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Clock, TrendingUp, Users, Calendar, RefreshCw, Layers, Ticket, MapPin } from 'lucide-react';
import type { DailyRecord } from '../types';

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler
);

interface HistorySnapshot {
  timestamp: string;
  jam: string;
  shift: string;
  total_pengunjung: number;
  anak: number;
  dewasa: number;
  pps: number;
  tsa: number;
  motor: number;
  mobil: number;
  bus: number;
  sepeda: number;
  rekap_3a?: any;
  rekap_iwm?: any;
  tickets_3a_by_channel_visit?: any;
  iwm?: any[];
}

interface SourceMetrics {
  total_pengunjung: number;
  dewasa: number;
  anak: number;
  pps: number;
  tsa: number;
  motor: number;
  mobil: number;
  bus: number;
  bus_gol_1: number;
  bus_gol_2: number;
  sepeda: number;
}

interface ParsedSnapshotBreakdown {
  jam: string;
  shift: string;
  isFirstInShift: boolean;
  isFirstOverall: boolean;
  snapshot: HistorySnapshot;
  // Cumulative/Shift values
  metrics3A: SourceMetrics;
  metricsIWM: SourceMetrics;
  // 15-minute additions (+Δ)
  delta3A: SourceMetrics;
  deltaIWM: SourceMetrics;
  deltaCombined: number;
  // Per-channel 3A cumulative & delta
  channels3A: Record<string, SourceMetrics>;
  deltaChannels3A: Record<string, SourceMetrics>;
  // Per-lokasi IWM cumulative & delta
  lokasiIWM: Record<string, SourceMetrics>;
  deltaLokasiIWM: Record<string, SourceMetrics>;
}

interface HourlyHistoryProps {
  data: DailyRecord[];
}

const emptyMetrics = (): SourceMetrics => ({
  total_pengunjung: 0,
  dewasa: 0,
  anak: 0,
  pps: 0,
  tsa: 0,
  motor: 0,
  mobil: 0,
  bus: 0,
  bus_gol_1: 0,
  bus_gol_2: 0,
  sepeda: 0,
});

const subtractMetrics = (curr: SourceMetrics, prev: SourceMetrics): SourceMetrics => {
  const dewasa = Math.max(0, curr.dewasa - prev.dewasa);
  const anak = Math.max(0, curr.anak - prev.anak);
  const bus_gol_1 = Math.max(0, curr.bus_gol_1 - prev.bus_gol_1);
  const bus_gol_2 = Math.max(0, curr.bus_gol_2 - prev.bus_gol_2);
  return {
    total_pengunjung: Math.max(0, curr.total_pengunjung - prev.total_pengunjung),
    dewasa,
    anak,
    pps: Math.max(0, curr.pps - prev.pps),
    tsa: Math.max(0, curr.tsa - prev.tsa),
    motor: Math.max(0, curr.motor - prev.motor),
    mobil: Math.max(0, curr.mobil - prev.mobil),
    bus: Math.max(0, curr.bus - prev.bus),
    bus_gol_1,
    bus_gol_2,
    sepeda: Math.max(0, curr.sepeda - prev.sepeda),
  };
};

// Extract 3A metrics from tickets_3a_by_channel_visit (handles both standard format and Oct 15-17 shifted format)
const extractRaw3A = (ticketsByChannel: any, fallbackRekap3A?: any): {
  total: SourceMetrics;
  byChannel: Record<string, SourceMetrics>;
} => {
  const total = emptyMetrics();
  const byChannel: Record<string, SourceMetrics> = {};

  if (!ticketsByChannel || typeof ticketsByChannel !== 'object') {
    if (fallbackRekap3A) {
      total.total_pengunjung = Number(fallbackRekap3A.total_pengunjung) || 0;
      total.dewasa = Number(fallbackRekap3A.dewasa) || 0;
      total.anak = Number(fallbackRekap3A.anak) || 0;
      total.pps = Number(fallbackRekap3A.pps) || 0;
      total.tsa = Number(fallbackRekap3A.tsa) || 0;
      total.motor = Number(fallbackRekap3A.motor) || 0;
      total.mobil = Number(fallbackRekap3A.mobil) || 0;
      total.bus = Number(fallbackRekap3A.bus) || 0;
      total.bus_gol_1 = Number(fallbackRekap3A.bus_gol_1) || 0;
      total.bus_gol_2 = Number(fallbackRekap3A.bus_gol_2) || 0;
      total.sepeda = Number(fallbackRekap3A.sepeda) || 0;
    }
    return { total, byChannel };
  }

  Object.keys(ticketsByChannel).forEach(channel => {
    const items: any[] = Array.isArray(ticketsByChannel[channel]) ? ticketsByChannel[channel] : [];
    const ch = emptyMetrics();

    // Detect if this snapshot used the pre-fix shifted column layout (where qty was parsed as 312 from "3-12" and actual qty is in total)
    const isShiftedFormat = items.some(
      (t: any) => Number(t.qty) === 312 && String(t.kategori || '').toUpperCase().startsWith('MPOS,')
    );

    let parkirIdx = 0;
    items.forEach((t: any) => {
      if (isShiftedFormat) {
        const val = Number(t.total) || 0;
        const kat = String(t.kategori || '').toUpperCase();
        if (kat.includes('GATE DEWASA')) {
          ch.dewasa += val;
        } else if (kat.includes('GATE ANAK')) {
          ch.anak += val;
        } else if (kat.includes('PUSAT PRIMATA') || kat.includes('SCHMUTZER')) {
          ch.pps += val;
        } else if (kat.includes('TAMAN SATWA')) {
          ch.tsa += val;
        } else if (kat.includes('KAWASAN PARKIR')) {
          if (parkirIdx === 0) ch.bus_gol_1 += val;
          else if (parkirIdx === 1) ch.bus_gol_2 += val;
          else if (parkirIdx === 2) ch.mobil += val;
          else if (parkirIdx === 3) ch.motor += val;
          else if (parkirIdx === 4) ch.sepeda += val;
          parkirIdx++;
        }
        return;
      }

      const kategori = `${t.item || ''} ${t.kategori || ''} ${t.lokasi || ''}`.toUpperCase();
      const tiket = String(t.kategori || '').toUpperCase();
      const qty = Number(t.qty) || 0;

      if (kategori.includes('PUSAT PRIMATA') || kategori.includes('SCHMUTZER')) {
        ch.pps += qty;
        return;
      }

      if (kategori.includes('TAMAN SATWA') || (kategori.includes('TSA') && !kategori.includes('KENDARAAN'))) {
        ch.tsa += qty;
        return;
      }

      if (
        kategori.includes('KENDARAAN') ||
        kategori.includes('PARKIR') ||
        tiket.includes('MOTOR') ||
        tiket.includes('MOBIL') ||
        tiket.includes('BUS') ||
        tiket.includes('SEPEDA')
      ) {
        if (/\bGOL(?:ONGAN)?\s*III\b/.test(tiket)) {
          ch.mobil += qty;
        } else if (/\bGOL(?:ONGAN)?\s*II\b/.test(tiket)) {
          ch.bus_gol_2 += qty;
        } else if (/\bGOL(?:ONGAN)?\s*I\b/.test(tiket)) {
          ch.bus_gol_1 += qty;
        } else if (tiket.includes('BUS BESAR') || tiket.includes('TRUK BESAR') || tiket.includes('TRUCK BESAR')) {
          ch.bus_gol_1 += qty;
        } else if (
          tiket.includes('BUS KECIL') ||
          tiket.includes('TRUK KECIL') ||
          tiket.includes('TRUCK KECIL') ||
          tiket.includes('PICK UP BESAR')
        ) {
          ch.bus_gol_2 += qty;
        } else if (
          tiket.includes('MOBIL') ||
          tiket.includes('MINIBUS') ||
          tiket.includes('MINI BUS') ||
          tiket.includes('SEDAN') ||
          tiket.includes('PICK UP KECIL')
        ) {
          ch.mobil += qty;
        } else if (tiket.includes('MOTOR') || tiket.includes('RODA TIGA')) {
          ch.motor += qty;
        } else if (tiket.includes('SEPEDA') && !tiket.includes('MOTOR')) {
          ch.sepeda += qty;
        }
        return;
      }

      if (kategori.includes('DEWASA')) {
        ch.dewasa += qty;
      } else if (kategori.includes('ANAK')) {
        ch.anak += qty;
      }
    });

    ch.total_pengunjung = ch.dewasa + ch.anak;
    ch.bus = ch.bus_gol_1 + ch.bus_gol_2;
    byChannel[channel] = ch;

    total.dewasa += ch.dewasa;
    total.anak += ch.anak;
    total.total_pengunjung += ch.total_pengunjung;
    total.pps += ch.pps;
    total.tsa += ch.tsa;
    total.motor += ch.motor;
    total.mobil += ch.mobil;
    total.bus_gol_1 += ch.bus_gol_1;
    total.bus_gol_2 += ch.bus_gol_2;
    total.bus += ch.bus;
    total.sepeda += ch.sepeda;
  });

  return { total, byChannel };
};

// Extract IWM metrics from iwm array
const extractRawIWM = (iwmList: any[] | undefined, fallbackRekapIWM?: any): {
  total: SourceMetrics;
  byLokasi: Record<string, SourceMetrics>;
} => {
  const total = emptyMetrics();
  const byLokasi: Record<string, SourceMetrics> = {};

  if (!Array.isArray(iwmList) || iwmList.length === 0) {
    if (fallbackRekapIWM) {
      total.total_pengunjung = Number(fallbackRekapIWM.total_pengunjung) || 0;
      total.dewasa = Number(fallbackRekapIWM.dewasa) || 0;
      total.anak = Number(fallbackRekapIWM.anak) || 0;
      total.pps = Number(fallbackRekapIWM.pps) || 0;
      total.tsa = Number(fallbackRekapIWM.tsa) || 0;
      total.motor = Number(fallbackRekapIWM.motor) || 0;
      total.mobil = Number(fallbackRekapIWM.mobil) || 0;
      total.bus = Number(fallbackRekapIWM.bus) || 0;
      total.bus_gol_1 = Number(fallbackRekapIWM.bus_gol_1) || 0;
      total.bus_gol_2 = Number(fallbackRekapIWM.bus_gol_2) || 0;
      total.sepeda = Number(fallbackRekapIWM.sepeda) || 0;
    }
    return { total, byLokasi };
  }

  iwmList.forEach((r: any) => {
    const lokName = String(r.lokasi || '').trim();
    const lokLower = lokName.toLowerCase();
    if (!lokName || lokLower === 'total') return;

    const k_anak = Number(r.karcis_anak ?? r.karcis_masuk ?? 0);
    const k_dewasa = Number(r.karcis_dewasa ?? r.harga_satuan ?? 0);
    const p_gol_1 = Number(r.parkir_gol_1 ?? 0);
    const p_gol_2 = Number(r.parkir_gol_2 ?? 0);
    const p_gol_3 = Number(r.parkir_gol_3 ?? 0);
    const p_motor = Number(r.parkir_motor ?? 0);
    const p_sepeda = Number(r.parkir_sepeda ?? 0);

    const loc = emptyMetrics();
    if (lokLower.includes('primata') || lokLower.includes('schmutzer')) {
      loc.pps = k_anak + k_dewasa;
    } else if (lokLower.includes('satwa anak') || lokLower.includes('children zoo')) {
      loc.tsa = k_anak + k_dewasa;
    } else {
      loc.anak = k_anak;
      loc.dewasa = k_dewasa;
    }

    loc.total_pengunjung = loc.dewasa + loc.anak;
    loc.bus_gol_1 = p_gol_1;
    loc.bus_gol_2 = p_gol_2;
    loc.bus = p_gol_1 + p_gol_2;
    loc.mobil = p_gol_3;
    loc.motor = p_motor;
    loc.sepeda = p_sepeda;

    byLokasi[lokName] = loc;

    total.dewasa += loc.dewasa;
    total.anak += loc.anak;
    total.total_pengunjung += loc.total_pengunjung;
    total.pps += loc.pps;
    total.tsa += loc.tsa;
    total.motor += loc.motor;
    total.mobil += loc.mobil;
    total.bus_gol_1 += loc.bus_gol_1;
    total.bus_gol_2 += loc.bus_gol_2;
    total.bus += loc.bus;
    total.sepeda += loc.sepeda;
  });

  return { total, byLokasi };
};

export const HourlyHistory: React.FC<HourlyHistoryProps> = ({ data }) => {
  const [selectedDate, setSelectedDate] = useState<string>(data[0]?.date || '');
  const [history, setHistory] = useState<HistorySnapshot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSnapshot, setSelectedSnapshot] = useState<HistorySnapshot | null>(null);

  // New states for separated 3A vs IWM 15-minute view
  const [viewFilter, setViewFilter] = useState<'all' | 'komparasi' | '3a' | 'iwm'>('all');
  const [splitChartMode, setSplitChartMode] = useState<'delta' | 'kumulatif'>('delta');
  const [tableDisplayMode, setTableDisplayMode] = useState<'both' | 'delta_only'>('both');

  const formatNumber = (num: number) => new Intl.NumberFormat('id-ID').format(num || 0);

  const fetchHistory = (date: string) => {
    setLoading(true);
    setError(null);
    setSelectedSnapshot(null);
    
    // We get history from the DailyRecord directly (which we fetch from Firebase in App.tsx)
    const selectedRecord = data.find(r => r.date === date);
    if (!selectedRecord) {
      setHistory([]);
    } else {
      const siangHistory = (selectedRecord.siang?.history || []).map((h: any) => ({ ...h, shift: 'siang' }));
      const malamHistory = (selectedRecord.malam?.history || []).map((h: any) => ({ ...h, shift: 'malam' }));
      
      const merged = [...siangHistory, ...malamHistory];
      
      // Gunakan Map untuk deduplikasi jam, tapi ambil data dengan total tertinggi
      const historyMap = new Map<string, HistorySnapshot>();
      merged.forEach(item => {
        const existing = historyMap.get(item.jam);
        if (!existing || (item.total_pengunjung || 0) > (existing.total_pengunjung || 0)) {
          historyMap.set(item.jam, item);
        }
      });
      
      const uniqueHistory = Array.from(historyMap.values());
      uniqueHistory.sort((a, b) => a.jam.localeCompare(b.jam));
      
      setHistory(uniqueHistory);
    }
    
    setLoading(false);
  };

  useEffect(() => {
    if (selectedDate) {
      fetchHistory(selectedDate);
    }
  }, [selectedDate, data]);

  // Precompute separated 3A and IWM per-15-minute breakdowns and deltas
  const parsedBreakdowns: ParsedSnapshotBreakdown[] = useMemo(() => {
    if (!history || history.length === 0) return [];

    const selectedRecord = data.find(r => r.date === selectedDate);

    // Raw cumulative extractions per snapshot
    const rawList = history.map(h => ({
      snap: h,
      raw3A: extractRaw3A(h.tickets_3a_by_channel_visit, h.rekap_3a),
      rawIWM: extractRawIWM(h.iwm, h.rekap_iwm),
    }));

    // Carry forward if a portal temporarily returned empty/zero mid-day
    for (let i = 1; i < rawList.length; i++) {
      if (
        rawList[i].raw3A.total.total_pengunjung === 0 &&
        rawList[i - 1].raw3A.total.total_pengunjung > 0
      ) {
        rawList[i].raw3A = rawList[i - 1].raw3A;
      }
      if (
        rawList[i].rawIWM.total.total_pengunjung === 0 &&
        rawList[i - 1].rawIWM.total.total_pengunjung > 0
      ) {
        rawList[i].rawIWM = rawList[i - 1].rawIWM;
      }
    }

    // Find end-of-siang baseline for Malam shift calculation (matching how malam shift works)
    let siangEnd3A = emptyMetrics();
    let siangEndChannels3A: Record<string, SourceMetrics> = {};
    let siangEndIWM = emptyMetrics();
    let siangEndLokasiIWM: Record<string, SourceMetrics> = {};

    const lastSiangIdx = rawList.map(r => r.snap.shift).lastIndexOf('siang');
    if (lastSiangIdx >= 0) {
      siangEnd3A = rawList[lastSiangIdx].raw3A.total;
      siangEndChannels3A = rawList[lastSiangIdx].raw3A.byChannel;
      siangEndIWM = rawList[lastSiangIdx].rawIWM.total;
      siangEndLokasiIWM = rawList[lastSiangIdx].rawIWM.byLokasi;
    } else if (selectedRecord?.siang) {
      const s3a = extractRaw3A(selectedRecord.siang.tickets_3a_by_channel_visit, selectedRecord.siang.rekap_3a);
      const siwm = extractRawIWM(selectedRecord.siang.iwm, selectedRecord.siang.rekap_iwm);
      siangEnd3A = s3a.total;
      siangEndChannels3A = s3a.byChannel;
      siangEndIWM = siwm.total;
      siangEndLokasiIWM = siwm.byLokasi;
    }

    // Build shift-level metrics for each snapshot
    const shiftLevelList = rawList.map(item => {
      const isMalam = item.snap.shift === 'malam';
      if (!isMalam) {
        return {
          snap: item.snap,
          metrics3A: item.raw3A.total,
          channels3A: item.raw3A.byChannel,
          metricsIWM: item.rawIWM.total,
          lokasiIWM: item.rawIWM.byLokasi,
        };
      }

      // For Malam shift, subtract end-of-siang baseline if raw data is full-day cumulative
      const isCumulativeRaw3A = item.raw3A.total.total_pengunjung >= siangEnd3A.total_pengunjung && siangEnd3A.total_pengunjung > 0;
      const isCumulativeRawIWM = item.rawIWM.total.total_pengunjung >= siangEndIWM.total_pengunjung && siangEndIWM.total_pengunjung > 0;

      const m3A = isCumulativeRaw3A ? subtractMetrics(item.raw3A.total, siangEnd3A) : item.raw3A.total;
      const mIWM = isCumulativeRawIWM ? subtractMetrics(item.rawIWM.total, siangEndIWM) : item.rawIWM.total;

      const ch3A: Record<string, SourceMetrics> = {};
      Object.keys(item.raw3A.byChannel).forEach(ch => {
        const currCh = item.raw3A.byChannel[ch];
        const baseCh = siangEndChannels3A[ch] || emptyMetrics();
        ch3A[ch] = isCumulativeRaw3A ? subtractMetrics(currCh, baseCh) : currCh;
      });

      const lokIWM: Record<string, SourceMetrics> = {};
      Object.keys(item.rawIWM.byLokasi).forEach(lok => {
        const currLok = item.rawIWM.byLokasi[lok];
        const baseLok = siangEndLokasiIWM[lok] || emptyMetrics();
        lokIWM[lok] = isCumulativeRawIWM ? subtractMetrics(currLok, baseLok) : currLok;
      });

      return {
        snap: item.snap,
        metrics3A: m3A,
        channels3A: ch3A,
        metricsIWM: mIWM,
        lokasiIWM: lokIWM,
      };
    });

    // Compute per-15-minute deltas (+Δ) within each shift
    return shiftLevelList.map((curr, idx) => {
      let prevInShiftIdx = -1;
      for (let i = idx - 1; i >= 0; i--) {
        if (shiftLevelList[i].snap.shift === curr.snap.shift) {
          prevInShiftIdx = i;
          break;
        }
      }

      const isFirstInShift = prevInShiftIdx === -1;
      const isFirstOverall = idx === 0;

      const prev3A = isFirstInShift ? emptyMetrics() : shiftLevelList[prevInShiftIdx].metrics3A;
      const prevIWM = isFirstInShift ? emptyMetrics() : shiftLevelList[prevInShiftIdx].metricsIWM;

      const delta3A = subtractMetrics(curr.metrics3A, prev3A);
      const deltaIWM = subtractMetrics(curr.metricsIWM, prevIWM);

      const deltaChannels3A: Record<string, SourceMetrics> = {};
      Object.keys(curr.channels3A).forEach(ch => {
        const prevCh = isFirstInShift
          ? emptyMetrics()
          : (shiftLevelList[prevInShiftIdx].channels3A[ch] || emptyMetrics());
        deltaChannels3A[ch] = subtractMetrics(curr.channels3A[ch], prevCh);
      });

      const deltaLokasiIWM: Record<string, SourceMetrics> = {};
      Object.keys(curr.lokasiIWM).forEach(lok => {
        const prevLok = isFirstInShift
          ? emptyMetrics()
          : (shiftLevelList[prevInShiftIdx].lokasiIWM[lok] || emptyMetrics());
        deltaLokasiIWM[lok] = subtractMetrics(curr.lokasiIWM[lok], prevLok);
      });

      const prevCombinedTotal = isFirstInShift ? 0 : shiftLevelList[prevInShiftIdx].snap.total_pengunjung;
      const deltaCombined = Math.max(0, curr.snap.total_pengunjung - prevCombinedTotal);

      return {
        jam: curr.snap.jam,
        shift: curr.snap.shift,
        isFirstInShift,
        isFirstOverall,
        snapshot: curr.snap,
        metrics3A: curr.metrics3A,
        metricsIWM: curr.metricsIWM,
        delta3A,
        deltaIWM,
        deltaCombined,
        channels3A: curr.channels3A,
        deltaChannels3A,
        lokasiIWM: curr.lokasiIWM,
        deltaLokasiIWM,
      };
    });
  }, [history, data, selectedDate]);

  // Lookup breakdown by jam
  const getBreakdownByJam = (jam: string): ParsedSnapshotBreakdown | undefined =>
    parsedBreakdowns.find(b => b.jam === jam);

  // Chart data (Original Combined Chart - Unchanged)
  const chartData = {
    labels: history.map(h => h.jam),
    datasets: [
      {
        label: 'Total Pengunjung',
        data: history.map(h => h.total_pengunjung),
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        fill: true,
        tension: 0.4,
        pointRadius: 5,
        pointHoverRadius: 8,
        pointBackgroundColor: history.map(h => h.shift === 'malam' ? '#6366f1' : '#10b981'),
        borderWidth: 2.5,
      },
      {
        label: 'Dewasa',
        data: history.map(h => h.dewasa),
        borderColor: '#f59e0b',
        backgroundColor: 'transparent',
        fill: false,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 7,
        borderWidth: 2,
        borderDash: [5, 3],
      },
      {
        label: 'Anak',
        data: history.map(h => h.anak),
        borderColor: '#06b6d4',
        backgroundColor: 'transparent',
        fill: false,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 7,
        borderWidth: 2,
        borderDash: [5, 3],
      }
    ]
  };

  // New Comparison Chart Data (3A vs IWM per 15 minutes)
  const splitComparisonChartData = {
    labels: parsedBreakdowns.map(b => b.jam),
    datasets: [
      {
        label: splitChartMode === 'delta' ? 'Penambahan Dashboard 3A (+Δ 15 Menit)' : 'Total Kumulatif Dashboard 3A',
        data: parsedBreakdowns.map(b =>
          splitChartMode === 'delta' ? b.delta3A.total_pengunjung : b.metrics3A.total_pengunjung
        ),
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.15)',
        fill: true,
        tension: 0.35,
        pointRadius: 5,
        pointHoverRadius: 8,
        pointBackgroundColor: '#3b82f6',
        borderWidth: 2.5,
      },
      {
        label: splitChartMode === 'delta' ? 'Penambahan Dashboard IWM (+Δ 15 Menit)' : 'Total Kumulatif Dashboard IWM',
        data: parsedBreakdowns.map(b =>
          splitChartMode === 'delta' ? b.deltaIWM.total_pengunjung : b.metricsIWM.total_pengunjung
        ),
        borderColor: '#f59e0b',
        backgroundColor: 'rgba(245, 158, 11, 0.15)',
        fill: true,
        tension: 0.35,
        pointRadius: 5,
        pointHoverRadius: 8,
        pointBackgroundColor: '#f59e0b',
        borderWidth: 2.5,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: '#9ca3af',
          font: { family: 'Outfit', size: 12 },
          padding: 16,
        }
      },
      tooltip: {
        callbacks: {
          label: (context: any) => ` ${context.dataset.label}: ${formatNumber(context.raw)}`
        },
        backgroundColor: 'rgba(17, 24, 39, 0.95)',
        borderColor: 'rgba(99, 102, 241, 0.3)',
        borderWidth: 1,
        padding: 12,
        titleFont: { family: 'Outfit', size: 13 },
        bodyFont: { family: 'Outfit', size: 12 },
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.04)' },
        ticks: { color: '#9ca3af', font: { family: 'Outfit', size: 11 } }
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.04)' },
        ticks: { color: '#9ca3af', font: { family: 'Outfit', size: 11 } }
      }
    },
    onClick: (_: any, elements: any[]) => {
      if (elements.length > 0) {
        const idx = elements[0].index;
        setSelectedSnapshot(history[idx]);
      }
    }
  };

  // Calculate delta (kenaikan vs snapshot sebelumnya)
  const getDelta = (snap: HistorySnapshot, field: keyof HistorySnapshot): number => {
    const idx = history.findIndex(h => h.jam === snap.jam);
    if (idx <= 0) return snap[field] as number;
    
    // Cari snapshot sebelumnya dari shift yang sama
    let prevIdx = idx - 1;
    while (prevIdx >= 0 && history[prevIdx].shift !== snap.shift) {
      prevIdx--;
    }
    
    if (prevIdx < 0) return snap[field] as number; // Jika ini snapshot pertama di shift tersebut
    
    const prev = history[prevIdx];
    return Math.max(0, (snap[field] as number) - (prev[field] as number));
  };

  // Calculate detailed channel deltas
  const getChannelDeltas = (snap: HistorySnapshot) => {
    if (!snap.tickets_3a_by_channel_visit && !snap.iwm) return null;

    const breakdown = getBreakdownByJam(snap.jam);
    const results: { channel: string; source: '3A' | 'IWM'; items: { name: string; qty: number }[] }[] = [];

    if (breakdown) {
      // 1. Process 3A Channels using accurate breakdown
      const channelLabels: Record<string, string> = {
        GATE: '3A - GATE (NEW GATE)',
        TVM: '3A - TVM',
        MERCHANT_PAGE: '3A - MERCHANT PAGE',
        MPOS: '3A - MPOS',
      };
      Object.keys(breakdown.deltaChannels3A).forEach(chKey => {
        const d = breakdown.deltaChannels3A[chKey];
        const items: { name: string; qty: number }[] = [];
        if (d.dewasa > 0) items.push({ name: 'Tiket Dewasa', qty: d.dewasa });
        if (d.anak > 0) items.push({ name: 'Tiket Anak', qty: d.anak });
        if (d.pps > 0) items.push({ name: 'Wahana PPS (Schmutzer)', qty: d.pps });
        if (d.tsa > 0) items.push({ name: 'Wahana TSA (Satwa Anak)', qty: d.tsa });
        if (d.motor > 0) items.push({ name: 'Parkir Motor', qty: d.motor });
        if (d.mobil > 0) items.push({ name: 'Parkir Mobil (Gol III)', qty: d.mobil });
        if (d.bus_gol_1 > 0) items.push({ name: 'Parkir Bus Gol I', qty: d.bus_gol_1 });
        if (d.bus_gol_2 > 0) items.push({ name: 'Parkir Bus Gol II', qty: d.bus_gol_2 });
        if (d.sepeda > 0) items.push({ name: 'Parkir Sepeda', qty: d.sepeda });

        if (items.length > 0) {
          results.push({
            channel: channelLabels[chKey] || `3A - ${chKey.replace(/_/g, ' ')}`,
            source: '3A',
            items,
          });
        }
      });

      // 2. Process IWM summary & per-lokasi deltas
      const dIwm = breakdown.deltaIWM;
      const iwmItems: { name: string; qty: number }[] = [];
      if (dIwm.dewasa > 0) iwmItems.push({ name: 'Karcis Dewasa', qty: dIwm.dewasa });
      if (dIwm.anak > 0) iwmItems.push({ name: 'Karcis Anak', qty: dIwm.anak });
      if (dIwm.pps > 0) iwmItems.push({ name: 'Pusat Primata (PPS)', qty: dIwm.pps });
      if (dIwm.tsa > 0) iwmItems.push({ name: 'Children Zoo (TSA)', qty: dIwm.tsa });
      if (dIwm.motor > 0) iwmItems.push({ name: 'Parkir Motor', qty: dIwm.motor });
      if (dIwm.mobil > 0) iwmItems.push({ name: 'Parkir Mobil (Gol III)', qty: dIwm.mobil });
      if (dIwm.bus_gol_1 > 0) iwmItems.push({ name: 'Parkir Bus Gol I', qty: dIwm.bus_gol_1 });
      if (dIwm.bus_gol_2 > 0) iwmItems.push({ name: 'Parkir Bus Gol II', qty: dIwm.bus_gol_2 });
      if (dIwm.sepeda > 0) iwmItems.push({ name: 'Parkir Sepeda', qty: dIwm.sepeda });

      if (iwmItems.length > 0) {
        results.push({
          channel: 'IWM (OLD GATE - TOTAL)',
          source: 'IWM',
          items: iwmItems,
        });
      }

      // Per-lokasi IWM additions
      Object.keys(breakdown.deltaLokasiIWM).forEach(lokName => {
        const dl = breakdown.deltaLokasiIWM[lokName];
        const lokItems: { name: string; qty: number }[] = [];
        if (dl.dewasa > 0) lokItems.push({ name: 'Dewasa', qty: dl.dewasa });
        if (dl.anak > 0) lokItems.push({ name: 'Anak', qty: dl.anak });
        if (dl.pps > 0) lokItems.push({ name: 'Tiket PPS', qty: dl.pps });
        if (dl.tsa > 0) lokItems.push({ name: 'Tiket TSA', qty: dl.tsa });
        if (dl.motor > 0) lokItems.push({ name: 'Motor', qty: dl.motor });
        if (dl.mobil > 0) lokItems.push({ name: 'Mobil', qty: dl.mobil });
        if (dl.bus > 0) lokItems.push({ name: 'Bus', qty: dl.bus });
        if (dl.sepeda > 0) lokItems.push({ name: 'Sepeda', qty: dl.sepeda });

        if (lokItems.length > 0) {
          results.push({
            channel: `IWM - ${lokName}`,
            source: 'IWM',
            items: lokItems,
          });
        }
      });
    }

    return results;
  };

  // Helper to render table cells with cumulative value and +Δ increment badge
  const renderMetricCell = (
    cumVal: number,
    deltaVal: number,
    isFirstOverall: boolean,
    accentColor = '#34d399',
    mainColor?: string
  ) => {
    if (tableDisplayMode === 'delta_only') {
      if (isFirstOverall) {
        return (
          <span style={{ color: cumVal > 0 ? accentColor : 'var(--text-muted)', fontWeight: cumVal > 0 ? 600 : 400 }}>
            {cumVal > 0 ? `+${formatNumber(cumVal)}` : '0'}
          </span>
        );
      }
      return (
        <span style={{ color: deltaVal > 0 ? accentColor : 'var(--text-muted)', fontWeight: deltaVal > 0 ? 700 : 400 }}>
          {deltaVal > 0 ? `+${formatNumber(deltaVal)}` : '0'}
        </span>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.25 }}>
        <span style={{ color: mainColor || '#ffffff', fontWeight: mainColor ? 700 : 500 }}>
          {formatNumber(cumVal)}
        </span>
        {!isFirstOverall && deltaVal > 0 && (
          <span style={{ fontSize: '0.73rem', color: accentColor, fontWeight: 600 }}>
            +{formatNumber(deltaVal)}
          </span>
        )}
      </div>
    );
  };

  // Summary totals for 3A & IWM on the selected date
  const summary3AandIWM = useMemo(() => {
    if (parsedBreakdowns.length === 0) {
      return {
        latest3A: emptyMetrics(),
        latestIWM: emptyMetrics(),
        peakDelta3A: { val: 0, jam: '-' },
        peakDeltaIWM: { val: 0, jam: '-' },
      };
    }

    // Sum end of siang + end of malam if both shifts exist
    const lastSiang = [...parsedBreakdowns].reverse().find(b => b.shift === 'siang');
    const lastMalam = [...parsedBreakdowns].reverse().find(b => b.shift === 'malam');

    const combineShiftMetrics = (a?: SourceMetrics, b?: SourceMetrics): SourceMetrics => {
      const mA = a || emptyMetrics();
      const mB = b || emptyMetrics();
      return {
        total_pengunjung: mA.total_pengunjung + mB.total_pengunjung,
        dewasa: mA.dewasa + mB.dewasa,
        anak: mA.anak + mB.anak,
        pps: mA.pps + mB.pps,
        tsa: mA.tsa + mB.tsa,
        motor: mA.motor + mB.motor,
        mobil: mA.mobil + mB.mobil,
        bus: mA.bus + mB.bus,
        bus_gol_1: mA.bus_gol_1 + mB.bus_gol_1,
        bus_gol_2: mA.bus_gol_2 + mB.bus_gol_2,
        sepeda: mA.sepeda + mB.sepeda,
      };
    };

    const latest3A = combineShiftMetrics(lastSiang?.metrics3A, lastMalam?.metrics3A);
    const latestIWM = combineShiftMetrics(lastSiang?.metricsIWM, lastMalam?.metricsIWM);

    let peakDelta3A = { val: 0, jam: '-' };
    let peakDeltaIWM = { val: 0, jam: '-' };

    parsedBreakdowns.forEach((b, idx) => {
      if (idx === 0 && parsedBreakdowns.length > 1) return; // skip initial baseline snapshot for peak 15-min delta
      if (b.delta3A.total_pengunjung > peakDelta3A.val) {
        peakDelta3A = { val: b.delta3A.total_pengunjung, jam: b.jam };
      }
      if (b.deltaIWM.total_pengunjung > peakDeltaIWM.val) {
        peakDeltaIWM = { val: b.deltaIWM.total_pengunjung, jam: b.jam };
      }
    });

    return { latest3A, latestIWM, peakDelta3A, peakDeltaIWM };
  }, [parsedBreakdowns]);

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Controls */}
      <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Calendar size={18} style={{ color: '#6366f1' }} />
          <span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>Pilih Tanggal:</span>
        </div>
        <select
          className="input-select"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
        >
          {data.map(d => (
            <option key={d.date} value={d.date}>
              {new Date(d.date + 'T00:00:00').toLocaleDateString('id-ID', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
              })}
            </option>
          ))}
        </select>

        {/* Sub-view Filter Buttons */}
        <div style={{
          display: 'flex',
          gap: '6px',
          flexWrap: 'wrap',
          background: 'rgba(0, 0, 0, 0.25)',
          padding: '4px',
          borderRadius: '10px',
          border: '1px solid rgba(255, 255, 255, 0.08)'
        }}>
          <button
            className={`btn btn-sm ${viewFilter === 'all' ? 'btn-primary' : ''}`}
            onClick={() => setViewFilter('all')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem' }}
          >
            <Layers size={14} />
            Semua (Gabungan + Terpisah)
          </button>
          <button
            className={`btn btn-sm ${viewFilter === 'komparasi' ? 'btn-primary' : ''}`}
            onClick={() => setViewFilter('komparasi')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem' }}
          >
            <TrendingUp size={14} />
            Komparasi 3A vs IWM
          </button>
          <button
            className={`btn btn-sm ${viewFilter === '3a' ? 'btn-primary' : ''}`}
            onClick={() => setViewFilter('3a')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem' }}
          >
            <Ticket size={14} />
            Per 15m Dashboard 3A
          </button>
          <button
            className={`btn btn-sm ${viewFilter === 'iwm' ? 'btn-primary' : ''}`}
            onClick={() => setViewFilter('iwm')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem' }}
          >
            <MapPin size={14} />
            Per 15m Dashboard IWM
          </button>
        </div>

        <button
          className="btn"
          onClick={() => fetchHistory(selectedDate)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}
        >
          <RefreshCw size={15} />
          Refresh
        </button>
      </div>

      {/* Status */}
      {loading && (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '20px', height: '20px',
              border: '2px solid rgba(99,102,241,0.2)',
              borderTopColor: '#6366f1',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }} />
            Mengambil data history...
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {error && !loading && (
        <div className="glass-panel" style={{
          borderLeft: '4px solid #ef4444',
          background: 'rgba(239,68,68,0.05)',
          padding: '16px 20px',
          color: '#fca5a5'
        }}>
          ⚠️ {error}
        </div>
      )}

      {!loading && !error && history.length === 0 && (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '48px 20px' }}>
          <Clock size={48} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
          <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', margin: 0 }}>
            Belum ada data history untuk tanggal ini.
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '6px' }}>
            Data akan tersedia setelah scraper dijalankan minimal sekali.
          </p>
        </div>
      )}

      {!loading && history.length > 0 && (
        <>
          {/* ===================================================================== */}
          {/* BAGIAN 1: TAMPILAN GABUNGAN YANG SUDAH ADA (TETAP UTUH)               */}
          {/* ===================================================================== */}
          {viewFilter === 'all' && (
            <>
              {/* Summary KPI Strip */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
                {[
                  { label: 'Snapshot Tersimpan', value: history.length + ' titik', color: '#6366f1', icon: <Clock size={18} /> },
                  { label: 'Rentang Waktu', value: `${history[0]?.jam} – ${history[history.length - 1]?.jam}`, color: '#10b981', icon: <TrendingUp size={18} /> },
                  { label: 'Puncak Pengunjung', value: formatNumber(Math.max(...history.map(h => h.total_pengunjung))), color: '#f59e0b', icon: <Users size={18} /> },
                  { label: 'Jam Tersibuk', value: history.reduce((a, b) => a.total_pengunjung > b.total_pengunjung ? a : b)?.jam || '-', color: '#06b6d4', icon: <Clock size={18} /> },
                ].map((kpi, i) => (
                  <div key={i} className="glass-panel" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: kpi.color }}>
                      {kpi.icon}
                      <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>{kpi.label}</span>
                    </div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#ffffff' }}>{kpi.value}</div>
                  </div>
                ))}
              </div>

              {/* Chart */}
              <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <TrendingUp size={20} style={{ color: '#10b981' }} />
                  Grafik Perkembangan Pengunjung Per Jam
                  <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--text-muted)', marginLeft: '4px' }}>
                    — klik titik untuk lihat detail
                  </span>
                </h3>
                <div style={{ height: '280px' }}>
                  <Line data={chartData} options={chartOptions} />
                </div>
              </div>
            </>
          )}

          {/* Clicked Snapshot Detail (Muncul di semua mode saat baris/titik diklik) */}
          {selectedSnapshot && (
            <div className="glass-panel" style={{
              borderLeft: '4px solid #6366f1',
              background: 'rgba(99,102,241,0.05)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Clock size={18} style={{ color: '#6366f1' }} />
                  Detail Snapshot Pukul {selectedSnapshot.jam} WIB
                  <span style={{
                    fontSize: '0.75rem', padding: '2px 10px', borderRadius: '20px',
                    background: selectedSnapshot.shift === 'malam' ? 'rgba(99,102,241,0.2)' : 'rgba(16,185,129,0.2)',
                    color: selectedSnapshot.shift === 'malam' ? '#818cf8' : '#34d399',
                    fontWeight: 600
                  }}>
                    Shift {String(selectedSnapshot.shift || (selectedSnapshot.jam >= '15:00' ? 'MALAM' : 'SIANG')).toUpperCase()}
                  </span>
                </h3>
                <button
                  className="btn"
                  style={{ padding: '4px 12px', fontSize: '0.8rem' }}
                  onClick={() => setSelectedSnapshot(null)}
                >✕ Tutup</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                {[
                  { label: 'Total Pengunjung', value: formatNumber(selectedSnapshot.total_pengunjung), delta: getDelta(selectedSnapshot, 'total_pengunjung'), color: '#10b981' },
                  { label: 'Dewasa', value: formatNumber(selectedSnapshot.dewasa), delta: getDelta(selectedSnapshot, 'dewasa'), color: '#f59e0b' },
                  { label: 'Anak', value: formatNumber(selectedSnapshot.anak), delta: getDelta(selectedSnapshot, 'anak'), color: '#06b6d4' },
                  { label: 'PPS', value: formatNumber(selectedSnapshot.pps), delta: getDelta(selectedSnapshot, 'pps'), color: '#a78bfa' },
                  { label: 'TSA', value: formatNumber(selectedSnapshot.tsa), delta: getDelta(selectedSnapshot, 'tsa'), color: '#f472b6' },
                  { label: 'Motor', value: formatNumber(selectedSnapshot.motor), delta: getDelta(selectedSnapshot, 'motor'), color: '#94a3b8' },
                  { label: 'Mobil', value: formatNumber(selectedSnapshot.mobil), delta: getDelta(selectedSnapshot, 'mobil'), color: '#94a3b8' },
                  { label: 'Bus', value: formatNumber(selectedSnapshot.bus), delta: getDelta(selectedSnapshot, 'bus'), color: '#94a3b8' },
                  { label: 'Sepeda', value: formatNumber(selectedSnapshot.sepeda), delta: getDelta(selectedSnapshot, 'sepeda'), color: '#94a3b8' },
                ].map((item, i) => (
                  <div key={i} style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid var(--panel-border)',
                    borderRadius: '10px',
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{item.label}</span>
                    <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#ffffff' }}>{item.value}</span>
                    {item.delta > 0 && (
                      <span style={{ fontSize: '0.78rem', color: item.color }}>
                        ▲ +{formatNumber(item.delta)} dari 15 menit sebelumnya
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* Perbandingan Penambahan 15 Menit: Dashboard 3A vs Dashboard IWM */}
              {(() => {
                const b = getBreakdownByJam(selectedSnapshot.jam);
                if (!b) return null;
                return (
                  <div style={{ marginTop: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '14px' }}>
                    {/* Box 3A */}
                    <div style={{
                      background: 'rgba(59, 130, 246, 0.07)',
                      border: '1px solid rgba(59, 130, 246, 0.25)',
                      borderRadius: '12px',
                      padding: '14px 16px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', borderBottom: '1px solid rgba(59,130,246,0.2)', paddingBottom: '8px' }}>
                        <span style={{ fontWeight: 700, color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Ticket size={16} /> Dashboard 3A (Pukul {b.jam})
                        </span>
                        <span style={{
                          background: 'rgba(59, 130, 246, 0.2)',
                          color: '#93c5fd',
                          padding: '2px 10px',
                          borderRadius: '14px',
                          fontSize: '0.82rem',
                          fontWeight: 700
                        }}>
                          +{formatNumber(b.delta3A.total_pengunjung)} pengunjung (15m)
                        </span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', fontSize: '0.82rem' }}>
                        {[
                          { label: 'Total 3A', val: b.metrics3A.total_pengunjung, d: b.delta3A.total_pengunjung },
                          { label: 'Dewasa', val: b.metrics3A.dewasa, d: b.delta3A.dewasa },
                          { label: 'Anak', val: b.metrics3A.anak, d: b.delta3A.anak },
                          { label: 'PPS', val: b.metrics3A.pps, d: b.delta3A.pps },
                          { label: 'TSA', val: b.metrics3A.tsa, d: b.delta3A.tsa },
                          { label: 'Motor', val: b.metrics3A.motor, d: b.delta3A.motor },
                          { label: 'Mobil', val: b.metrics3A.mobil, d: b.delta3A.mobil },
                          { label: 'Bus', val: b.metrics3A.bus, d: b.delta3A.bus },
                          { label: 'Sepeda', val: b.metrics3A.sepeda, d: b.delta3A.sepeda },
                        ].map((m, idx) => (
                          <div key={idx} style={{ background: 'rgba(0,0,0,0.25)', padding: '6px 10px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>{m.label}</span>
                            <span style={{ fontWeight: 600, color: '#fff' }}>
                              {formatNumber(m.val)}
                              {m.d > 0 && <span style={{ color: '#34d399', marginLeft: '4px' }}>(+{formatNumber(m.d)})</span>}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Box IWM */}
                    <div style={{
                      background: 'rgba(245, 158, 11, 0.07)',
                      border: '1px solid rgba(245, 158, 11, 0.25)',
                      borderRadius: '12px',
                      padding: '14px 16px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', borderBottom: '1px solid rgba(245,158,11,0.2)', paddingBottom: '8px' }}>
                        <span style={{ fontWeight: 700, color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <MapPin size={16} /> Dashboard IWM (Pukul {b.jam})
                        </span>
                        <span style={{
                          background: 'rgba(245, 158, 11, 0.2)',
                          color: '#fde68a',
                          padding: '2px 10px',
                          borderRadius: '14px',
                          fontSize: '0.82rem',
                          fontWeight: 700
                        }}>
                          +{formatNumber(b.deltaIWM.total_pengunjung)} pengunjung (15m)
                        </span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', fontSize: '0.82rem' }}>
                        {[
                          { label: 'Total IWM', val: b.metricsIWM.total_pengunjung, d: b.deltaIWM.total_pengunjung },
                          { label: 'Dewasa', val: b.metricsIWM.dewasa, d: b.deltaIWM.dewasa },
                          { label: 'Anak', val: b.metricsIWM.anak, d: b.deltaIWM.anak },
                          { label: 'PPS', val: b.metricsIWM.pps, d: b.deltaIWM.pps },
                          { label: 'TSA', val: b.metricsIWM.tsa, d: b.deltaIWM.tsa },
                          { label: 'Motor', val: b.metricsIWM.motor, d: b.deltaIWM.motor },
                          { label: 'Mobil', val: b.metricsIWM.mobil, d: b.deltaIWM.mobil },
                          { label: 'Bus', val: b.metricsIWM.bus, d: b.deltaIWM.bus },
                          { label: 'Sepeda', val: b.metricsIWM.sepeda, d: b.deltaIWM.sepeda },
                        ].map((m, idx) => (
                          <div key={idx} style={{ background: 'rgba(0,0,0,0.25)', padding: '6px 10px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>{m.label}</span>
                            <span style={{ fontWeight: 600, color: '#fff' }}>
                              {formatNumber(m.val)}
                              {m.d > 0 && <span style={{ color: '#34d399', marginLeft: '4px' }}>(+{formatNumber(m.d)})</span>}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Rincian Penambahan per Channel */}
              {(() => {
                const deltas = getChannelDeltas(selectedSnapshot);
                if (!deltas) return null;
                if (deltas.length === 0) return (
                  <div style={{ marginTop: '20px', padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Tidak ada penambahan tiket dari channel manapun pada snapshot ini.
                  </div>
                );
                
                return (
                  <div style={{ marginTop: '24px' }}>
                    <h4 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', color: '#818cf8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <TrendingUp size={16} /> Rincian Penambahan per Channel & Pintu (15 Menit Ini)
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '12px' }}>
                      {deltas.map((ch, idx) => (
                        <div key={idx} style={{
                          background: 'rgba(0,0,0,0.2)',
                          border: `1px solid ${ch.source === '3A' ? 'rgba(59,130,246,0.25)' : 'rgba(245,158,11,0.25)'}`,
                          borderRadius: '8px',
                          padding: '12px'
                        }}>
                          <div style={{
                            fontWeight: 600,
                            fontSize: '0.88rem',
                            marginBottom: '8px',
                            borderBottom: '1px solid rgba(255,255,255,0.05)',
                            paddingBottom: '6px',
                            color: ch.source === '3A' ? '#60a5fa' : '#fbbf24'
                          }}>
                            {ch.channel}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {ch.items.map((item, i) => (
                              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>{item.name}</span>
                                <span style={{ color: '#34d399', fontWeight: 600 }}>+{formatNumber(item.qty)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Timeline Table (Original Combined Table - Unchanged) */}
          {viewFilter === 'all' && (
            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={18} style={{ color: '#6366f1' }} />
                Riwayat Lengkap Per Snapshot (Gabungan 3A + IWM)
              </h3>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Pukul</th>
                      <th>Shift</th>
                      <th style={{ textAlign: 'right' }}>Total</th>
                      <th style={{ textAlign: 'right' }}>Dewasa</th>
                      <th style={{ textAlign: 'right' }}>Anak</th>
                      <th style={{ textAlign: 'right' }}>PPS</th>
                      <th style={{ textAlign: 'right' }}>TSA</th>
                      <th style={{ textAlign: 'right' }}>Motor</th>
                      <th style={{ textAlign: 'right' }}>Mobil</th>
                      <th style={{ textAlign: 'right' }}>Bus</th>
                      <th style={{ textAlign: 'right' }}>Sepeda</th>
                      <th style={{ textAlign: 'right' }}>Δ Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h, idx) => {
                      // Cari total pengunjung sebelumnya di shift yang sama
                      let prevTotal = 0;
                      let isFirstInShift = true;
                      for (let i = idx - 1; i >= 0; i--) {
                        if (history[i].shift === h.shift) {
                          prevTotal = history[i].total_pengunjung;
                          isFirstInShift = false;
                          break;
                        }
                      }
                      
                      const delta = Math.max(0, h.total_pengunjung - prevTotal);
                      const isSelected = selectedSnapshot?.jam === h.jam;
                      return (
                        <tr
                          key={h.jam}
                          onClick={() => setSelectedSnapshot(isSelected ? null : h)}
                          style={{
                            cursor: 'pointer',
                            background: isSelected ? 'rgba(99,102,241,0.12)' : undefined,
                            transition: 'background 0.2s'
                          }}
                        >
                          <td style={{ fontWeight: 700, color: isSelected ? '#818cf8' : '#ffffff' }}>
                            {h.jam} WIB
                          </td>
                          <td>
                            <span style={{
                              fontSize: '0.75rem', padding: '2px 8px', borderRadius: '20px',
                              background: h.shift === 'malam' ? 'rgba(99,102,241,0.2)' : 'rgba(16,185,129,0.15)',
                              color: h.shift === 'malam' ? '#818cf8' : '#34d399',
                              fontWeight: 600
                            }}>
                              {String(h.shift || (h.jam >= '15:00' ? 'MALAM' : 'SIANG')).toUpperCase()}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: '#10b981' }}>
                            {formatNumber(h.total_pengunjung)}
                          </td>
                          <td style={{ textAlign: 'right' }}>{formatNumber(h.dewasa)}</td>
                          <td style={{ textAlign: 'right' }}>{formatNumber(h.anak)}</td>
                          <td style={{ textAlign: 'right', color: '#a78bfa' }}>{formatNumber(h.pps)}</td>
                          <td style={{ textAlign: 'right', color: '#f472b6' }}>{formatNumber(h.tsa)}</td>
                          <td style={{ textAlign: 'right' }}>{formatNumber(h.motor)}</td>
                          <td style={{ textAlign: 'right' }}>{formatNumber(h.mobil)}</td>
                          <td style={{ textAlign: 'right' }}>{formatNumber(h.bus)}</td>
                          <td style={{ textAlign: 'right' }}>{formatNumber(h.sepeda)}</td>
                          <td style={{ textAlign: 'right', color: delta > 0 ? '#34d399' : 'var(--text-muted)' }}>
                            {isFirstInShift && idx !== 0 ? `+${formatNumber(delta)}` : (idx === 0 ? '—' : `+${formatNumber(delta)}`)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ===================================================================== */}
          {/* BAGIAN 2: FITUR TAMBAHAN - DATA PER 15 MENIT TERPISAH (3A vs IWM)     */}
          {/* ===================================================================== */}
          <div style={{
            marginTop: viewFilter === 'all' ? '12px' : '0',
            paddingTop: viewFilter === 'all' ? '20px' : '0',
            borderTop: viewFilter === 'all' ? '2px dashed rgba(99, 102, 241, 0.3)' : 'none',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px'
          }}>
            {/* Header & Mode Angka Toggle */}
            <div className="glass-panel" style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
              background: 'linear-gradient(90deg, rgba(59,130,246,0.08) 0%, rgba(245,158,11,0.08) 100%)',
              border: '1px solid rgba(99, 102, 241, 0.25)'
            }}>
              <div>
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: '#ffffff' }}>
                  <Layers size={20} style={{ color: '#60a5fa' }} />
                  Data & Penambahan Per 15 Menit Terpisah: Dashboard 3A vs Dashboard IWM
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                  Pantau rincian kenaikan (<strong style={{ color: '#34d399' }}>+Δ per 15 menit</strong>) dan total kumulatif secara terpisah dari masing-masing sumber dashboard.
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Tampilan Angka Tabel:</span>
                <div style={{
                  display: 'flex',
                  gap: '4px',
                  background: 'rgba(0,0,0,0.3)',
                  padding: '4px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.08)'
                }}>
                  <button
                    className={`btn btn-sm ${tableDisplayMode === 'both' ? 'btn-primary' : ''}`}
                    onClick={() => setTableDisplayMode('both')}
                    style={{ fontSize: '0.78rem', padding: '4px 10px' }}
                  >
                    Kumulatif + Penambahan (+Δ)
                  </button>
                  <button
                    className={`btn btn-sm ${tableDisplayMode === 'delta_only' ? 'btn-primary' : ''}`}
                    onClick={() => setTableDisplayMode('delta_only')}
                    style={{ fontSize: '0.78rem', padding: '4px 10px' }}
                  >
                    Hanya Penambahan (+Δ 15m)
                  </button>
                </div>
              </div>
            </div>

            {/* Summary KPI Cards: 3A vs IWM */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
              <div className="glass-panel" style={{ padding: '14px 16px', borderLeft: '4px solid #3b82f6' }}>
                <div style={{ fontSize: '0.8rem', color: '#60a5fa', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Ticket size={16} /> Total Pengunjung 3A
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#ffffff', marginTop: '4px' }}>
                  {formatNumber(summary3AandIWM.latest3A.total_pengunjung)}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Dewasa: <strong style={{ color: '#e2e8f0' }}>{formatNumber(summary3AandIWM.latest3A.dewasa)}</strong> | Anak: <strong style={{ color: '#e2e8f0' }}>{formatNumber(summary3AandIWM.latest3A.anak)}</strong>
                </div>
              </div>

              <div className="glass-panel" style={{ padding: '14px 16px', borderLeft: '4px solid #60a5fa' }}>
                <div style={{ fontSize: '0.8rem', color: '#93c5fd', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <TrendingUp size={16} /> Lonjakan 15m Tertinggi (3A)
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#34d399', marginTop: '4px' }}>
                  +{formatNumber(summary3AandIWM.peakDelta3A.val)}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Pada pukul <strong style={{ color: '#e2e8f0' }}>{summary3AandIWM.peakDelta3A.jam} WIB</strong>
                </div>
              </div>

              <div className="glass-panel" style={{ padding: '14px 16px', borderLeft: '4px solid #f59e0b' }}>
                <div style={{ fontSize: '0.8rem', color: '#fbbf24', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <MapPin size={16} /> Total Pengunjung IWM
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#ffffff', marginTop: '4px' }}>
                  {formatNumber(summary3AandIWM.latestIWM.total_pengunjung)}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Dewasa: <strong style={{ color: '#e2e8f0' }}>{formatNumber(summary3AandIWM.latestIWM.dewasa)}</strong> | Anak: <strong style={{ color: '#e2e8f0' }}>{formatNumber(summary3AandIWM.latestIWM.anak)}</strong>
                </div>
              </div>

              <div className="glass-panel" style={{ padding: '14px 16px', borderLeft: '4px solid #fbbf24' }}>
                <div style={{ fontSize: '0.8rem', color: '#fde68a', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <TrendingUp size={16} /> Lonjakan 15m Tertinggi (IWM)
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#34d399', marginTop: '4px' }}>
                  +{formatNumber(summary3AandIWM.peakDeltaIWM.val)}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Pada pukul <strong style={{ color: '#e2e8f0' }}>{summary3AandIWM.peakDeltaIWM.jam} WIB</strong>
                </div>
              </div>
            </div>

            {/* Grafik Perbandingan 3A vs IWM Per 15 Menit */}
            {(viewFilter === 'all' || viewFilter === 'komparasi') && (
              <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <TrendingUp size={20} style={{ color: '#3b82f6' }} />
                    Grafik Perbandingan Dashboard 3A vs Dashboard IWM (Per 15 Menit)
                  </h3>
                  <div style={{
                    display: 'flex',
                    gap: '4px',
                    background: 'rgba(0,0,0,0.3)',
                    padding: '4px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.08)'
                  }}>
                    <button
                      className={`btn btn-sm ${splitChartMode === 'delta' ? 'btn-primary' : ''}`}
                      onClick={() => setSplitChartMode('delta')}
                      style={{ fontSize: '0.78rem', padding: '4px 10px' }}
                    >
                      Grafik Penambahan (+Δ per 15m)
                    </button>
                    <button
                      className={`btn btn-sm ${splitChartMode === 'kumulatif' ? 'btn-primary' : ''}`}
                      onClick={() => setSplitChartMode('kumulatif')}
                      style={{ fontSize: '0.78rem', padding: '4px 10px' }}
                    >
                      Grafik Total Kumulatif
                    </button>
                  </div>
                </div>
                <div style={{ height: '270px' }}>
                  <Line data={splitComparisonChartData} options={chartOptions} />
                </div>
              </div>
            )}

            {/* Tabel Komparasi Langsung Penambahan Per 15 Menit (3A vs IWM) */}
            {(viewFilter === 'all' || viewFilter === 'komparasi') && (
              <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Layers size={18} style={{ color: '#818cf8' }} />
                    Tabel Perbandingan Penambahan Per 15 Menit (Dashboard 3A vs Dashboard IWM)
                  </h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Klik baris jam untuk melihat rincian per channel 3A & per pintu IWM
                  </span>
                </div>
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Pukul</th>
                        <th>Shift</th>
                        <th style={{ textAlign: 'right', color: '#60a5fa' }}>Total 3A</th>
                        <th style={{ textAlign: 'right', color: '#34d399', background: 'rgba(59,130,246,0.08)' }}>+Δ 3A (15m)</th>
                        <th style={{ textAlign: 'right', color: '#93c5fd' }}>Δ Dewasa 3A</th>
                        <th style={{ textAlign: 'right', color: '#93c5fd' }}>Δ Anak 3A</th>
                        <th style={{ textAlign: 'right', color: '#fbbf24' }}>Total IWM</th>
                        <th style={{ textAlign: 'right', color: '#34d399', background: 'rgba(245,158,11,0.08)' }}>+Δ IWM (15m)</th>
                        <th style={{ textAlign: 'right', color: '#fde68a' }}>Δ Dewasa IWM</th>
                        <th style={{ textAlign: 'right', color: '#fde68a' }}>Δ Anak IWM</th>
                        <th style={{ textAlign: 'right', color: '#10b981' }}>Total Gabungan</th>
                        <th style={{ textAlign: 'right', color: '#34d399' }}>+Δ Gabungan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedBreakdowns.map((b) => {
                        const isSelected = selectedSnapshot?.jam === b.jam;
                        const d3A = b.delta3A.total_pengunjung;
                        const dIWM = b.deltaIWM.total_pengunjung;
                        return (
                          <tr
                            key={`comp-${b.jam}`}
                            onClick={() => setSelectedSnapshot(isSelected ? null : b.snapshot)}
                            style={{
                              cursor: 'pointer',
                              background: isSelected ? 'rgba(99,102,241,0.14)' : undefined,
                              transition: 'background 0.2s'
                            }}
                          >
                            <td style={{ fontWeight: 700, color: isSelected ? '#818cf8' : '#ffffff' }}>
                              {b.jam} WIB
                            </td>
                            <td>
                              <span style={{
                                fontSize: '0.73rem', padding: '2px 8px', borderRadius: '20px',
                                background: b.shift === 'malam' ? 'rgba(99,102,241,0.2)' : 'rgba(16,185,129,0.15)',
                                color: b.shift === 'malam' ? '#818cf8' : '#34d399',
                                fontWeight: 600
                              }}>
                                {b.shift.toUpperCase()}
                              </span>
                            </td>
                            {/* 3A */}
                            <td style={{ textAlign: 'right', fontWeight: 700, color: '#60a5fa' }}>
                              {formatNumber(b.metrics3A.total_pengunjung)}
                            </td>
                            <td style={{
                              textAlign: 'right',
                              fontWeight: 700,
                              background: 'rgba(59,130,246,0.06)',
                              color: !b.isFirstOverall && d3A > 0 ? '#34d399' : 'var(--text-muted)'
                            }}>
                              {b.isFirstOverall ? '—' : (d3A > 0 ? `+${formatNumber(d3A)}` : '0')}
                            </td>
                            <td style={{ textAlign: 'right', color: !b.isFirstOverall && b.delta3A.dewasa > 0 ? '#93c5fd' : 'var(--text-muted)' }}>
                              {b.isFirstOverall ? '—' : (b.delta3A.dewasa > 0 ? `+${formatNumber(b.delta3A.dewasa)}` : '0')}
                            </td>
                            <td style={{ textAlign: 'right', color: !b.isFirstOverall && b.delta3A.anak > 0 ? '#93c5fd' : 'var(--text-muted)' }}>
                              {b.isFirstOverall ? '—' : (b.delta3A.anak > 0 ? `+${formatNumber(b.delta3A.anak)}` : '0')}
                            </td>

                            {/* IWM */}
                            <td style={{ textAlign: 'right', fontWeight: 700, color: '#fbbf24' }}>
                              {formatNumber(b.metricsIWM.total_pengunjung)}
                            </td>
                            <td style={{
                              textAlign: 'right',
                              fontWeight: 700,
                              background: 'rgba(245,158,11,0.06)',
                              color: !b.isFirstOverall && dIWM > 0 ? '#34d399' : 'var(--text-muted)'
                            }}>
                              {b.isFirstOverall ? '—' : (dIWM > 0 ? `+${formatNumber(dIWM)}` : '0')}
                            </td>
                            <td style={{ textAlign: 'right', color: !b.isFirstOverall && b.deltaIWM.dewasa > 0 ? '#fde68a' : 'var(--text-muted)' }}>
                              {b.isFirstOverall ? '—' : (b.deltaIWM.dewasa > 0 ? `+${formatNumber(b.deltaIWM.dewasa)}` : '0')}
                            </td>
                            <td style={{ textAlign: 'right', color: !b.isFirstOverall && b.deltaIWM.anak > 0 ? '#fde68a' : 'var(--text-muted)' }}>
                              {b.isFirstOverall ? '—' : (b.deltaIWM.anak > 0 ? `+${formatNumber(b.deltaIWM.anak)}` : '0')}
                            </td>

                            {/* Gabungan */}
                            <td style={{ textAlign: 'right', fontWeight: 700, color: '#10b981' }}>
                              {formatNumber(b.snapshot.total_pengunjung)}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: !b.isFirstOverall && b.deltaCombined > 0 ? '#34d399' : 'var(--text-muted)' }}>
                              {b.isFirstOverall ? '—' : (b.deltaCombined > 0 ? `+${formatNumber(b.deltaCombined)}` : '0')}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ===================================================================== */}
            {/* TABEL TERPISAH 1: KHUSUS DASHBOARD 3A PER 15 MENIT                    */}
            {/* ===================================================================== */}
            {(viewFilter === 'all' || viewFilter === '3a') && (
              <div className="glass-panel" style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                borderTop: '3px solid #3b82f6'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: '#60a5fa' }}>
                      <Ticket size={19} />
                      Riwayat & Penambahan Per 15 Menit — DASHBOARD 3A
                    </h3>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Mencakup seluruh channel 3A (New Gate, TVM, Merchant Page, MPOS). Angka hijau <strong style={{ color: '#34d399' }}>+Δ</strong> menunjukkan penambahan dari 15 menit sebelumnya.
                    </span>
                  </div>
                </div>

                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Pukul</th>
                        <th>Shift</th>
                        <th style={{ textAlign: 'right', color: '#60a5fa' }}>Total 3A</th>
                        <th style={{ textAlign: 'right', color: '#34d399', background: 'rgba(59,130,246,0.1)' }}>+Δ 3A (15m)</th>
                        <th style={{ textAlign: 'right' }}>Dewasa</th>
                        <th style={{ textAlign: 'right' }}>Anak</th>
                        <th style={{ textAlign: 'right', color: '#a78bfa' }}>PPS</th>
                        <th style={{ textAlign: 'right', color: '#f472b6' }}>TSA</th>
                        <th style={{ textAlign: 'right' }}>Motor</th>
                        <th style={{ textAlign: 'right' }}>Mobil</th>
                        <th style={{ textAlign: 'right' }}>Bus</th>
                        <th style={{ textAlign: 'right' }}>Sepeda</th>
                        <th style={{ textAlign: 'right', color: '#93c5fd' }}>Δ Gate</th>
                        <th style={{ textAlign: 'right', color: '#93c5fd' }}>Δ TVM</th>
                        <th style={{ textAlign: 'right', color: '#93c5fd' }}>Δ Online</th>
                        <th style={{ textAlign: 'right', color: '#93c5fd' }}>Δ MPOS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedBreakdowns.map((b) => {
                        const isSelected = selectedSnapshot?.jam === b.jam;
                        const d3A = b.delta3A.total_pengunjung;
                        const dGate = b.deltaChannels3A['GATE']?.total_pengunjung || 0;
                        const dTvm = b.deltaChannels3A['TVM']?.total_pengunjung || 0;
                        const dMerchant = b.deltaChannels3A['MERCHANT_PAGE']?.total_pengunjung || 0;
                        const dMpos = b.deltaChannels3A['MPOS']?.total_pengunjung || 0;

                        return (
                          <tr
                            key={`3a-${b.jam}`}
                            onClick={() => setSelectedSnapshot(isSelected ? null : b.snapshot)}
                            style={{
                              cursor: 'pointer',
                              background: isSelected ? 'rgba(59,130,246,0.15)' : undefined,
                              transition: 'background 0.2s'
                            }}
                          >
                            <td style={{ fontWeight: 700, color: isSelected ? '#60a5fa' : '#ffffff' }}>
                              {b.jam} WIB
                            </td>
                            <td>
                              <span style={{
                                fontSize: '0.73rem', padding: '2px 8px', borderRadius: '20px',
                                background: b.shift === 'malam' ? 'rgba(99,102,241,0.2)' : 'rgba(16,185,129,0.15)',
                                color: b.shift === 'malam' ? '#818cf8' : '#34d399',
                                fontWeight: 600
                              }}>
                                {b.shift.toUpperCase()}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: '#60a5fa' }}>
                              {formatNumber(b.metrics3A.total_pengunjung)}
                            </td>
                            <td style={{
                              textAlign: 'right',
                              fontWeight: 700,
                              background: 'rgba(59,130,246,0.06)',
                              color: !b.isFirstOverall && d3A > 0 ? '#34d399' : 'var(--text-muted)'
                            }}>
                              {b.isFirstOverall ? '—' : (d3A > 0 ? `+${formatNumber(d3A)}` : '0')}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              {renderMetricCell(b.metrics3A.dewasa, b.delta3A.dewasa, b.isFirstOverall)}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              {renderMetricCell(b.metrics3A.anak, b.delta3A.anak, b.isFirstOverall)}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              {renderMetricCell(b.metrics3A.pps, b.delta3A.pps, b.isFirstOverall, '#c4b5fd', '#a78bfa')}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              {renderMetricCell(b.metrics3A.tsa, b.delta3A.tsa, b.isFirstOverall, '#fbcfe8', '#f472b6')}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              {renderMetricCell(b.metrics3A.motor, b.delta3A.motor, b.isFirstOverall)}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              {renderMetricCell(b.metrics3A.mobil, b.delta3A.mobil, b.isFirstOverall)}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              {renderMetricCell(b.metrics3A.bus, b.delta3A.bus, b.isFirstOverall)}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              {renderMetricCell(b.metrics3A.sepeda, b.delta3A.sepeda, b.isFirstOverall)}
                            </td>
                            {/* Per-channel 3A visitor delta */}
                            <td style={{ textAlign: 'right', color: !b.isFirstOverall && dGate > 0 ? '#93c5fd' : 'var(--text-muted)', fontSize: '0.84rem' }}>
                              {b.isFirstOverall ? formatNumber(b.channels3A['GATE']?.total_pengunjung || 0) : (dGate > 0 ? `+${formatNumber(dGate)}` : '0')}
                            </td>
                            <td style={{ textAlign: 'right', color: !b.isFirstOverall && dTvm > 0 ? '#93c5fd' : 'var(--text-muted)', fontSize: '0.84rem' }}>
                              {b.isFirstOverall ? formatNumber(b.channels3A['TVM']?.total_pengunjung || 0) : (dTvm > 0 ? `+${formatNumber(dTvm)}` : '0')}
                            </td>
                            <td style={{ textAlign: 'right', color: !b.isFirstOverall && dMerchant > 0 ? '#93c5fd' : 'var(--text-muted)', fontSize: '0.84rem' }}>
                              {b.isFirstOverall ? formatNumber(b.channels3A['MERCHANT_PAGE']?.total_pengunjung || 0) : (dMerchant > 0 ? `+${formatNumber(dMerchant)}` : '0')}
                            </td>
                            <td style={{ textAlign: 'right', color: !b.isFirstOverall && dMpos > 0 ? '#93c5fd' : 'var(--text-muted)', fontSize: '0.84rem' }}>
                              {b.isFirstOverall ? formatNumber(b.channels3A['MPOS']?.total_pengunjung || 0) : (dMpos > 0 ? `+${formatNumber(dMpos)}` : '0')}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ===================================================================== */}
            {/* TABEL TERPISAH 2: KHUSUS DASHBOARD IWM PER 15 MENIT                   */}
            {/* ===================================================================== */}
            {(viewFilter === 'all' || viewFilter === 'iwm') && (
              <div className="glass-panel" style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                borderTop: '3px solid #f59e0b'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: '#fbbf24' }}>
                      <MapPin size={19} />
                      Riwayat & Penambahan Per 15 Menit — DASHBOARD IWM (Old Gate)
                    </h3>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Mencakup seluruh pintu & wahana di portal IWM. Angka hijau <strong style={{ color: '#34d399' }}>+Δ</strong> menunjukkan penambahan dari 15 menit sebelumnya.
                    </span>
                  </div>
                </div>

                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Pukul</th>
                        <th>Shift</th>
                        <th style={{ textAlign: 'right', color: '#fbbf24' }}>Total IWM</th>
                        <th style={{ textAlign: 'right', color: '#34d399', background: 'rgba(245,158,11,0.1)' }}>+Δ IWM (15m)</th>
                        <th style={{ textAlign: 'right' }}>Dewasa</th>
                        <th style={{ textAlign: 'right' }}>Anak</th>
                        <th style={{ textAlign: 'right', color: '#a78bfa' }}>PPS</th>
                        <th style={{ textAlign: 'right', color: '#f472b6' }}>TSA</th>
                        <th style={{ textAlign: 'right' }}>Motor</th>
                        <th style={{ textAlign: 'right' }}>Mobil</th>
                        <th style={{ textAlign: 'right' }}>Bus</th>
                        <th style={{ textAlign: 'right' }}>Sepeda</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedBreakdowns.map((b) => {
                        const isSelected = selectedSnapshot?.jam === b.jam;
                        const dIWM = b.deltaIWM.total_pengunjung;

                        return (
                          <tr
                            key={`iwm-${b.jam}`}
                            onClick={() => setSelectedSnapshot(isSelected ? null : b.snapshot)}
                            style={{
                              cursor: 'pointer',
                              background: isSelected ? 'rgba(245,158,11,0.15)' : undefined,
                              transition: 'background 0.2s'
                            }}
                          >
                            <td style={{ fontWeight: 700, color: isSelected ? '#fbbf24' : '#ffffff' }}>
                              {b.jam} WIB
                            </td>
                            <td>
                              <span style={{
                                fontSize: '0.73rem', padding: '2px 8px', borderRadius: '20px',
                                background: b.shift === 'malam' ? 'rgba(99,102,241,0.2)' : 'rgba(16,185,129,0.15)',
                                color: b.shift === 'malam' ? '#818cf8' : '#34d399',
                                fontWeight: 600
                              }}>
                                {b.shift.toUpperCase()}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: '#fbbf24' }}>
                              {formatNumber(b.metricsIWM.total_pengunjung)}
                            </td>
                            <td style={{
                              textAlign: 'right',
                              fontWeight: 700,
                              background: 'rgba(245,158,11,0.06)',
                              color: !b.isFirstOverall && dIWM > 0 ? '#34d399' : 'var(--text-muted)'
                            }}>
                              {b.isFirstOverall ? '—' : (dIWM > 0 ? `+${formatNumber(dIWM)}` : '0')}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              {renderMetricCell(b.metricsIWM.dewasa, b.deltaIWM.dewasa, b.isFirstOverall)}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              {renderMetricCell(b.metricsIWM.anak, b.deltaIWM.anak, b.isFirstOverall)}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              {renderMetricCell(b.metricsIWM.pps, b.deltaIWM.pps, b.isFirstOverall, '#c4b5fd', '#a78bfa')}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              {renderMetricCell(b.metricsIWM.tsa, b.deltaIWM.tsa, b.isFirstOverall, '#fbcfe8', '#f472b6')}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              {renderMetricCell(b.metricsIWM.motor, b.deltaIWM.motor, b.isFirstOverall)}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              {renderMetricCell(b.metricsIWM.mobil, b.deltaIWM.mobil, b.isFirstOverall)}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              {renderMetricCell(b.metricsIWM.bus, b.deltaIWM.bus, b.isFirstOverall)}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              {renderMetricCell(b.metricsIWM.sepeda, b.deltaIWM.sepeda, b.isFirstOverall)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
