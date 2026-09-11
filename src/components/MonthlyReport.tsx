import React, { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  PointElement, 
  LineElement, 
  BarElement,
  Title, 
  Tooltip, 
  Legend 
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { Calendar, Users } from 'lucide-react';
import type { DailyRecord } from '../types';

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement, BarElement,
  Title, Tooltip, Legend
);

interface MonthlyRecord {
  month: string; // YYYY-MM
  total_pengunjung: number;
  motor: number;
  mobil: number;
  bus: number;
  sepeda: number;
  pps: number;
  tsa: number;
  anak: number;
  dewasa: number;
}

const safeNum = (val: any) => {
  const parsed = parseInt(val, 10);
  return isNaN(parsed) ? 0 : parsed;
};

export const MonthlyReport: React.FC = () => {
  const [data, setData] = useState<MonthlyRecord[]>([]);
  const [rawDocs, setRawDocs] = useState<DailyRecord[]>([]);
  const [selectedMonthStr, setSelectedMonthStr] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchMonthlyData = async () => {
      try {
        setLoading(true);
        const snapshot = await getDocs(collection(db, 'daily_records'));
        const docs = snapshot.docs.map(doc => doc.data() as any);
        setRawDocs(docs);
        
        const monthlyMap: Record<string, MonthlyRecord> = {};
        
        docs.forEach((row: any) => {
           const dateStr = row.date || '';
           if (!dateStr) return;
           const monthStr = dateStr.substring(0, 7); // YYYY-MM
           
           if (!monthlyMap[monthStr]) {
             monthlyMap[monthStr] = {
               month: monthStr,
               total_pengunjung: 0,
               motor: 0, mobil: 0, bus: 0, sepeda: 0,
               pps: 0, tsa: 0, anak: 0, dewasa: 0
             };
           }
           
           const r = monthlyMap[monthStr];
           const s = row.siang?.rekap || {};
           const m = row.malam?.rekap || {};
           
           r.total_pengunjung += safeNum(s.total_pengunjung) + safeNum(m.total_pengunjung);
           r.motor += safeNum(s.motor) + safeNum(m.motor);
           r.mobil += safeNum(s.mobil) + safeNum(m.mobil);
           r.bus += safeNum(s.bus) + safeNum(m.bus);
           r.sepeda += safeNum(s.sepeda) + safeNum(m.sepeda);
           r.pps += safeNum(s.pps) + safeNum(m.pps);
           r.tsa += safeNum(s.tsa) + safeNum(m.tsa);
           r.anak += safeNum(s.anak) + safeNum(m.anak);
           r.dewasa += safeNum(s.dewasa) + safeNum(m.dewasa);
        });
        
        const sorted = Object.values(monthlyMap).sort((a, b) => b.month.localeCompare(a.month));
        setData(sorted);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchMonthlyData();
  }, []);

  const formatNumber = (num: number) => new Intl.NumberFormat('id-ID').format(num || 0);
  
  const formatMonth = (yyyy_mm: string) => {
    const [y, m] = yyyy_mm.split('-');
    const date = new Date(parseInt(y), parseInt(m) - 1, 1);
    return date.toLocaleString('id-ID', { month: 'long', year: 'numeric' });
  };

  const formatDate = (yyyy_mm_dd: string) => {
    const parts = yyyy_mm_dd.split('-');
    if (parts.length !== 3) return yyyy_mm_dd;
    const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    return date.toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
        <div className="spinner" style={{
          width: '40px', height: '40px', border: '3px solid rgba(99, 102, 241, 0.2)',
          borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 1s linear infinite'
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return <div style={{ color: '#ef4444', textAlign: 'center', padding: '40px' }}>Error: {error}</div>;
  }

  // Prepare chart data (reverse to make it chronological: left to right)
  const chartDataReversed = [...data].reverse();
  
  const chartData = {
    labels: chartDataReversed.map(d => formatMonth(d.month)),
    datasets: [
      {
        label: 'Total Pengunjung',
        data: chartDataReversed.map(d => d.total_pengunjung),
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderWidth: 3,
        tension: 0.4,
        fill: true,
        pointBackgroundColor: '#1e293b',
        pointBorderColor: '#3b82f6',
        pointRadius: 4,
        pointHoverRadius: 6
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        titleColor: '#fff',
        bodyColor: '#cbd5e1',
        padding: 12,
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        displayColors: false,
        callbacks: {
          label: function(context: any) {
            return `Pengunjung: ${formatNumber(context.raw)}`;
          }
        }
      }
    },
    scales: {
      y: {
        grid: { color: 'rgba(255,255,255,0.05)' },
        ticks: { color: '#94a3b8' }
      },
      x: {
        grid: { display: false },
        ticks: { color: '#94a3b8' }
      }
    }
  };

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Header Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '16px', borderRadius: '12px', color: '#3b82f6' }}>
            <Calendar size={28} />
          </div>
          <div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Total Bulan Terekam</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff' }}>{data.length} Bulan</div>
          </div>
        </div>
        
        <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '16px', borderRadius: '12px', color: '#10b981' }}>
            <Users size={28} />
          </div>
          <div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Rata-rata Pengunjung / Bulan</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff' }}>
              {data.length > 0 ? formatNumber(Math.round(data.reduce((a, b) => a + b.total_pengunjung, 0) / data.length)) : 0}
            </div>
          </div>
        </div>
      </div>

      {/* Chart Section */}
      <div className="glass-panel">
        <h3 style={{ marginBottom: '20px', color: '#fff', fontSize: '1.1rem' }}>Tren Pengunjung Bulanan</h3>
        <div style={{ height: '300px', width: '100%' }}>
          <Line data={chartData} options={chartOptions as any} />
        </div>
      </div>

      {/* Daily Drilldown Section */}
      <div className="glass-panel" style={{ overflowX: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <h3 style={{ color: '#fff', fontSize: '1.1rem', margin: 0 }}>Laporan Harian per Bulan</h3>
          <select 
            value={selectedMonthStr} 
            onChange={(e) => setSelectedMonthStr(e.target.value)}
            style={{ 
              background: 'rgba(0,0,0,0.5)', color: '#fff', 
              border: '1px solid rgba(255,255,255,0.2)', padding: '8px 12px', 
              borderRadius: '8px', outline: 'none', cursor: 'pointer'
            }}
          >
            <option value="">-- Pilih Bulan --</option>
            {data.map(m => (
              <option key={m.month} value={m.month}>{formatMonth(m.month)}</option>
            ))}
          </select>
        </div>
        
        {selectedMonthStr ? (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', minWidth: '800px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                <th style={{ padding: '12px 8px', textAlign: 'left' }}>Tanggal</th>
                <th style={{ padding: '12px 8px', color: '#3b82f6' }}>Total Pengunjung</th>
                <th style={{ padding: '12px 8px' }}>Dewasa</th>
                <th style={{ padding: '12px 8px' }}>Anak</th>
                <th style={{ padding: '12px 8px' }}>Motor</th>
                <th style={{ padding: '12px 8px' }}>Mobil</th>
                <th style={{ padding: '12px 8px' }}>Bus</th>
                <th style={{ padding: '12px 8px' }}>PPS</th>
                <th style={{ padding: '12px 8px' }}>TSA</th>
              </tr>
            </thead>
            <tbody>
              {rawDocs
                .filter((d: any) => (d.date || '').startsWith(selectedMonthStr))
                .sort((a: any, b: any) => (b.date || '').localeCompare(a.date || ''))
                .map((row: any) => {
                  const s = row.siang?.rekap || {};
                  const m = row.malam?.rekap || {};
                  const total = safeNum(s.total_pengunjung) + safeNum(m.total_pengunjung);
                  const dewasa = safeNum(s.dewasa) + safeNum(m.dewasa);
                  const anak = safeNum(s.anak) + safeNum(m.anak);
                  const motor = safeNum(s.motor) + safeNum(m.motor);
                  const mobil = safeNum(s.mobil) + safeNum(m.mobil);
                  const bus = safeNum(s.bus) + safeNum(m.bus);
                  const pps = safeNum(s.pps) + safeNum(m.pps);
                  const tsa = safeNum(s.tsa) + safeNum(m.tsa);
                  
                  return (
                    <tr key={row.date} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.95rem' }}>
                      <td style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '500', color: '#e2e8f0' }}>
                        {formatDate(row.date || '')}
                      </td>
                      <td style={{ padding: '12px 8px', fontWeight: 'bold', color: '#60a5fa' }}>{formatNumber(total)}</td>
                      <td style={{ padding: '12px 8px', color: '#cbd5e1' }}>{formatNumber(dewasa)}</td>
                      <td style={{ padding: '12px 8px', color: '#cbd5e1' }}>{formatNumber(anak)}</td>
                      <td style={{ padding: '12px 8px', color: '#cbd5e1' }}>{formatNumber(motor)}</td>
                      <td style={{ padding: '12px 8px', color: '#cbd5e1' }}>{formatNumber(mobil)}</td>
                      <td style={{ padding: '12px 8px', color: '#cbd5e1' }}>{formatNumber(bus)}</td>
                      <td style={{ padding: '12px 8px', color: '#cbd5e1' }}>{formatNumber(pps)}</td>
                      <td style={{ padding: '12px 8px', color: '#cbd5e1' }}>{formatNumber(tsa)}</td>
                    </tr>
                  );
              })}
            </tbody>
          </table>
        ) : (
          <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
            Silakan pilih bulan di atas untuk melihat rincian laporan per tanggal.
          </div>
        )}
      </div>

      {/* Table Section */}
      <div className="glass-panel" style={{ overflowX: 'auto' }}>
        <h3 style={{ marginBottom: '16px', color: '#fff', fontSize: '1.1rem' }}>Rincian Data Bulanan</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', minWidth: '800px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              <th style={{ padding: '12px 8px', textAlign: 'left' }}>Bulan</th>
              <th style={{ padding: '12px 8px', color: '#3b82f6' }}>Total Pengunjung</th>
              <th style={{ padding: '12px 8px' }}>Dewasa</th>
              <th style={{ padding: '12px 8px' }}>Anak</th>
              <th style={{ padding: '12px 8px' }}>Motor</th>
              <th style={{ padding: '12px 8px' }}>Mobil</th>
              <th style={{ padding: '12px 8px' }}>Bus</th>
              <th style={{ padding: '12px 8px' }}>PPS</th>
              <th style={{ padding: '12px 8px' }}>TSA</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.month} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.95rem' }}>
                <td style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '500', color: '#e2e8f0' }}>
                  {formatMonth(row.month)}
                </td>
                <td style={{ padding: '12px 8px', fontWeight: 'bold', color: '#60a5fa' }}>{formatNumber(row.total_pengunjung)}</td>
                <td style={{ padding: '12px 8px', color: '#cbd5e1' }}>{formatNumber(row.dewasa)}</td>
                <td style={{ padding: '12px 8px', color: '#cbd5e1' }}>{formatNumber(row.anak)}</td>
                <td style={{ padding: '12px 8px', color: '#cbd5e1' }}>{formatNumber(row.motor)}</td>
                <td style={{ padding: '12px 8px', color: '#cbd5e1' }}>{formatNumber(row.mobil)}</td>
                <td style={{ padding: '12px 8px', color: '#cbd5e1' }}>{formatNumber(row.bus)}</td>
                <td style={{ padding: '12px 8px', color: '#cbd5e1' }}>{formatNumber(row.pps)}</td>
                <td style={{ padding: '12px 8px', color: '#cbd5e1' }}>{formatNumber(row.tsa)}</td>
              </tr>
            ))}
            {data.length === 0 && (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                  Belum ada data bulanan yang tersedia.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
    </div>
  );
};
