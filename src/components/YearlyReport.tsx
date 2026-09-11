import React, { useState, useEffect } from 'react';
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  BarElement,
  Title, 
  Tooltip, 
  Legend 
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { CalendarDays, TrendingUp } from 'lucide-react';

ChartJS.register(
  CategoryScale, LinearScale, BarElement,
  Title, Tooltip, Legend
);

interface YearlyRecord {
  year: string; // YYYY
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

export const YearlyReport: React.FC = () => {
  const [data, setData] = useState<YearlyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchYearlyData = async () => {
      try {
        setLoading(true);
        const host = window.location.hostname;
        const res = await fetch(`http://${host}:5001/api/yearly_records`);
        if (!res.ok) throw new Error('Gagal mengambil data tahunan');
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchYearlyData();
  }, []);

  const formatNumber = (num: number) => new Intl.NumberFormat('id-ID').format(num || 0);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
        <div className="spinner" style={{
          width: '40px', height: '40px', border: '3px solid rgba(99, 102, 241, 0.2)',
          borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 1s linear infinite'
        }} />
      </div>
    );
  }

  if (error) {
    return <div style={{ color: '#ef4444', textAlign: 'center', padding: '40px' }}>Error: {error}</div>;
  }

  // Prepare chart data (reverse to make it chronological: left to right)
  const chartDataReversed = [...data].reverse();
  
  const chartData = {
    labels: chartDataReversed.map(d => d.year),
    datasets: [
      {
        label: 'Total Pengunjung',
        data: chartDataReversed.map(d => d.total_pengunjung),
        backgroundColor: 'rgba(16, 185, 129, 0.8)',
        borderRadius: 6,
        barThickness: 40,
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
          <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '16px', borderRadius: '12px', color: '#10b981' }}>
            <CalendarDays size={28} />
          </div>
          <div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Total Tahun Terekam</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff' }}>{data.length} Tahun</div>
          </div>
        </div>
        
        <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '16px', borderRadius: '12px', color: '#f59e0b' }}>
            <TrendingUp size={28} />
          </div>
          <div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Total Seluruh Pengunjung</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff' }}>
              {formatNumber(data.reduce((a, b) => a + b.total_pengunjung, 0))}
            </div>
          </div>
        </div>
      </div>

      {/* Chart Section */}
      <div className="glass-panel">
        <h3 style={{ marginBottom: '20px', color: '#fff', fontSize: '1.1rem' }}>Komparasi Pengunjung Tahunan</h3>
        <div style={{ height: '300px', width: '100%' }}>
          <Bar data={chartData} options={chartOptions as any} />
        </div>
      </div>

      {/* Table Section */}
      <div className="glass-panel" style={{ overflowX: 'auto' }}>
        <h3 style={{ marginBottom: '16px', color: '#fff', fontSize: '1.1rem' }}>Rincian Data Tahunan</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', minWidth: '800px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              <th style={{ padding: '12px 8px', textAlign: 'left' }}>Tahun</th>
              <th style={{ padding: '12px 8px', color: '#10b981' }}>Total Pengunjung</th>
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
              <tr key={row.year} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.95rem' }}>
                <td style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '500', color: '#e2e8f0', fontSize: '1.1rem' }}>
                  {row.year}
                </td>
                <td style={{ padding: '12px 8px', fontWeight: 'bold', color: '#34d399' }}>{formatNumber(row.total_pengunjung)}</td>
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
                  Belum ada data tahunan yang tersedia.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
    </div>
  );
};
