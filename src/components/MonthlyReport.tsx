import React, { useState, useEffect } from 'react';
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

export const MonthlyReport: React.FC = () => {
  const [data, setData] = useState<MonthlyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchMonthlyData = async () => {
      try {
        setLoading(true);
        const host = window.location.hostname;
        const res = await fetch(`http://${host}:5001/api/monthly_records`);
        if (!res.ok) throw new Error('Gagal mengambil data bulanan');
        const json = await res.json();
        // The API returns descending by month, let's keep it that way for the table,
        // but for charts we usually want ascending (oldest to newest).
        setData(json);
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
