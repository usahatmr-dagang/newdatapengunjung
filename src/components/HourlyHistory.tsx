import React, { useState, useEffect } from 'react';
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
import { Clock, TrendingUp, Users, Calendar, RefreshCw } from 'lucide-react';
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
  tickets_3a_by_channel_visit?: any;
  iwm?: any[];
}

interface HourlyHistoryProps {
  data: DailyRecord[];
}

export const HourlyHistory: React.FC<HourlyHistoryProps> = ({ data }) => {
  const [selectedDate, setSelectedDate] = useState<string>(data[0]?.date || '');
  const [history, setHistory] = useState<HistorySnapshot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSnapshot, setSelectedSnapshot] = useState<HistorySnapshot | null>(null);

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

  // Chart data
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

    const idx = history.findIndex(h => h.jam === snap.jam);
    let prevSnap: HistorySnapshot | null = null;
    
    if (idx > 0) {
      let prevIdx = idx - 1;
      while (prevIdx >= 0 && history[prevIdx].shift !== snap.shift) {
        prevIdx--;
      }
      if (prevIdx >= 0) {
        prevSnap = history[prevIdx];
      }
    }

    const results: { channel: string; items: { name: string; qty: number }[] }[] = [];

    // Process 3A Channels
    if (snap.tickets_3a_by_channel_visit) {
      Object.keys(snap.tickets_3a_by_channel_visit).forEach(channel => {
        const items = snap.tickets_3a_by_channel_visit[channel] || [];
        const prevItems = prevSnap?.tickets_3a_by_channel_visit?.[channel] || [];
        
        const channelDeltas: { name: string; qty: number }[] = [];
        items.forEach((item: any) => {
          // Try to match by item and kategori, or ticket_name
          const prevItem = prevItems.find((p: any) => 
            (p.item === item.item && p.kategori === item.kategori) || 
            (p.ticket_name && p.ticket_name === item.ticket_name)
          );
          const delta = (item.qty || 0) - (prevItem?.qty || 0);
          if (delta > 0) {
            let name = item.kategori || item.ticket_name || item.item || 'Tiket';
            if (item.item && item.item !== name && !name.includes(item.item)) {
              name = `${item.item} - ${name}`;
            }
            channelDeltas.push({ name, qty: delta });
          }
        });
        
        if (channelDeltas.length > 0) {
          results.push({ channel: channel.replace(/_/g, ' '), items: channelDeltas });
        }
      });
    }

    // Process IWM
    if (snap.iwm && snap.iwm.length > 0) {
      const currentIwm = snap.iwm;
      const prevIwm = prevSnap?.iwm || [];
      const iwmDeltas: { name: string; qty: number }[] = [];
      
      const sumField = (arr: any[], field: string) => arr.reduce((sum, item) => sum + (Number(item[field]) || 0), 0);
      
      const fields = [
        { key: 'karcis_anak', label: 'Anak' },
        { key: 'karcis_dewasa', label: 'Dewasa' },
        { key: 'parkir_gol_1', label: 'Sepeda' },
        { key: 'parkir_gol_2', label: 'Motor' },
        { key: 'parkir_gol_3', label: 'Mobil' },
        { key: 'parkir_gol_4', label: 'Bus Gol I' },
        { key: 'parkir_gol_5', label: 'Bus Gol II' },
      ];
      
      fields.forEach(f => {
        const currSum = sumField(currentIwm, f.key);
        const prevSum = sumField(prevIwm, f.key);
        const delta = currSum - prevSum;
        if (delta > 0) {
          iwmDeltas.push({ name: f.label, qty: delta });
        }
      });
      
      if (iwmDeltas.length > 0) {
        results.push({ channel: 'IWM (OLD GATE)', items: iwmDeltas });
      }
    }

    return results;
  };

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

          {/* Clicked Snapshot Detail */}
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
                        ▲ +{formatNumber(item.delta)} dari jam sebelumnya
                      </span>
                    )}
                  </div>
                ))}
              </div>

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
                      <TrendingUp size={16} /> Rincian Penambahan per Channel
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '12px' }}>
                      {deltas.map((ch, idx) => (
                        <div key={idx} style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '12px' }}>
                          <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '6px', color: '#e2e8f0' }}>
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

          {/* Timeline Table */}
          <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={18} style={{ color: '#6366f1' }} />
              Riwayat Lengkap Per Snapshot
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
        </>
      )}
    </div>
  );
};
