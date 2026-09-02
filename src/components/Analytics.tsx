import React from 'react';
import { Bar, Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import type { DailyRecord } from '../types';
import { Sun, Moon, DollarSign } from 'lucide-react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

interface AnalyticsProps {
  data: DailyRecord[];
}

export const Analytics: React.FC<AnalyticsProps> = ({ data }) => {
  const formatNumber = (num: number) => new Intl.NumberFormat('id-ID').format(num);
  const formatIDR = (num: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);

  const latestRecord = data[0] || null;

  if (!latestRecord) {
    return (
      <div className="glass-panel text-center fade-in">
        <p style={{ color: 'var(--text-secondary)' }}>Tidak ada data tersedia untuk dianalisis.</p>
      </div>
    );
  }

  // Helper to detect weekend for Schmutzer (PPS) rates
  const isWeekend = (dateStr: string) => {
    if (!dateStr) return false;
    const day = new Date(dateStr).getDay();
    return day === 0 || day === 6; // Sunday or Saturday
  };

  // Get details
  const siangRekap = latestRecord.siang?.rekap;
  const malamRekap = latestRecord.malam?.rekap;

  const siangRekapPendapatan = latestRecord.siang?.rekap_pendapatan || siangRekap;
  const malamRekapPendapatan = latestRecord.malam?.rekap_pendapatan || malamRekap;

  const totalSiang = siangRekap?.total_pengunjung || 0;
  const totalMalam = malamRekap?.total_pengunjung || 0;
  const totalBoth = totalSiang + totalMalam;

  // Calculate revenues per category using exact spreadsheet rates
  const dateStr = latestRecord.date;
  const isWk = isWeekend(dateStr);
  const ppsRateSiang = isWk ? 7500 : 6000;

  // Day (Siang) revenues
  const revSiangAnak = (siangRekapPendapatan?.anak || 0) * 3000;
  const revSiangDewasa = (siangRekapPendapatan?.dewasa || 0) * 4000;
  const revSiangMotor = (siangRekapPendapatan?.motor || 0) * 3000;
  const revSiangMobil = (siangRekapPendapatan?.mobil || 0) * 6000;
  const revSiangSepeda = (siangRekapPendapatan?.sepeda || 0) * 1000;
  const revSiangBus = ((siangRekapPendapatan?.bus_gol_1 || 0) * 15000) + ((siangRekapPendapatan?.bus_gol_2 || 0) * 12500);
  const revSiangPPS = (siangRekapPendapatan?.pps || 0) * ppsRateSiang;
  const revSiangTSA = (siangRekapPendapatan?.tsa || 0) * 2500;

  const revSiangTotal = revSiangAnak + revSiangDewasa + revSiangMotor + revSiangMobil + revSiangSepeda + revSiangBus + revSiangPPS + revSiangTSA;

  // Night (Malam) revenues
  const revMalamAnak = (malamRekapPendapatan?.anak || 0) * 3000;
  const revMalamDewasa = (malamRekapPendapatan?.dewasa || 0) * 4000;
  const revMalamMotor = (malamRekapPendapatan?.motor || 0) * 3000;
  const revMalamMobil = (malamRekapPendapatan?.mobil || 0) * 6000;
  const revMalamSepeda = (malamRekapPendapatan?.sepeda || 0) * 1000;
  const revMalamBus = 0; // Bus is day shift only
  const revMalamPPS = (malamRekapPendapatan?.pps || 0) * 7500;
  const revMalamBoogy = (malamRekapPendapatan?.boogy_car || 0) * 250000;

  const revMalamTotal = revMalamAnak + revMalamDewasa + revMalamMotor + revMalamMobil + revMalamSepeda + revMalamBus + revMalamPPS + revMalamBoogy;

  const totalRevenue = revSiangTotal + revMalamTotal;

  // 1. Visitor Ratio (Day vs Night)
  const ratioChartData = {
    labels: ['Siang (Day)', 'Malam (Night)'],
    datasets: [{
      data: [totalSiang, totalMalam],
      backgroundColor: ['rgba(6, 182, 212, 0.85)', 'rgba(168, 85, 247, 0.85)'],
      borderColor: ['#06b6d4', '#a855f7'],
      borderWidth: 1
    }]
  };

  // 2. Ticket Categories (Anak vs Dewasa)
  const categoryChartData = {
    labels: ['Anak (Children)', 'Dewasa (Adult)'],
    datasets: [
      {
        label: 'Siang',
        data: [siangRekap?.anak || 0, siangRekap?.dewasa || 0],
        backgroundColor: '#06b6d4',
        borderRadius: 6
      },
      {
        label: 'Malam',
        data: [malamRekap?.anak || 0, malamRekap?.dewasa || 0],
        backgroundColor: '#a855f7',
        borderRadius: 6
      }
    ]
  };

  // 3. Category-by-Category Revenue Comparison
  const categoryRevenueChartData = {
    labels: ['Tiket Anak', 'Tiket Dewasa', 'Motor', 'Mobil', 'Sepeda', 'Bus', 'PPS (Schmutzer)', 'TSA / Boogy Car'],
    datasets: [
      {
        label: 'Siang (Day)',
        data: [
          revSiangAnak,
          revSiangDewasa,
          revSiangMotor,
          revSiangMobil,
          revSiangSepeda,
          revSiangBus,
          revSiangPPS,
          revSiangTSA
        ],
        backgroundColor: 'rgba(6, 182, 212, 0.8)',
        borderRadius: 4
      },
      {
        label: 'Malam (Night)',
        data: [
          revMalamAnak,
          revMalamDewasa,
          revMalamMotor,
          revMalamMobil,
          revMalamSepeda,
          revMalamBus,
          revMalamPPS,
          revMalamBoogy
        ],
        backgroundColor: 'rgba(168, 85, 247, 0.8)',
        borderRadius: 4
      }
    ]
  };

  // 4. IWM Revenue by Locations Comparison (Conditional)
  const siangIWM = latestRecord.siang?.iwm || [];
  const malamIWM = latestRecord.malam?.iwm || [];

  const locationMap: { [key: string]: { siang: number; malam: number } } = {};
  siangIWM.forEach(item => {
    if (item.lokasi && item.lokasi.toLowerCase() !== 'total') {
      locationMap[item.lokasi] = { siang: item.total || 0, malam: 0 };
    }
  });
  malamIWM.forEach(item => {
    if (item.lokasi && item.lokasi.toLowerCase() !== 'total') {
      if (!locationMap[item.lokasi]) {
        locationMap[item.lokasi] = { siang: 0, malam: item.total || 0 };
      } else {
        locationMap[item.lokasi].malam = item.total || 0;
      }
    }
  });

  const locations = Object.keys(locationMap);
  const showIWMChart = locations.length > 0;

  const locationRevenueChartData = {
    labels: locations,
    datasets: [
      {
        label: 'Siang',
        data: locations.map(loc => locationMap[loc].siang),
        backgroundColor: 'rgba(6, 182, 212, 0.7)',
        borderRadius: 4
      },
      {
        label: 'Malam',
        data: locations.map(loc => locationMap[loc].malam),
        backgroundColor: 'rgba(168, 85, 247, 0.7)',
        borderRadius: 4
      }
    ]
  };

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Overview insights */}
      <div className="metrics-grid">
        <div className="glass-panel" style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div style={{ padding: '12px', background: 'rgba(6, 182, 212, 0.15)', borderRadius: '12px' }}>
            <Sun size={28} style={{ color: '#06b6d4' }} />
          </div>
          <div>
            <h4 style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Porsi Kunjungan Siang</h4>
            <div style={{ fontSize: '1.6rem', fontWeight: 700 }}>{totalBoth > 0 ? ((totalSiang / totalBoth) * 100).toFixed(1) : 0}%</div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{formatNumber(totalSiang)} pengunjung</p>
          </div>
        </div>

        <div className="glass-panel" style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div style={{ padding: '12px', background: 'rgba(16, 185, 129, 0.15)', borderRadius: '12px' }}>
            <DollarSign size={28} style={{ color: '#10b981' }} />
          </div>
          <div>
            <h4 style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Estimasi Pendapatan Harian</h4>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{formatIDR(totalRevenue)}</div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Siang: {formatIDR(revSiangTotal)} | Malam: {formatIDR(revMalamTotal)}</p>
          </div>
        </div>

        <div className="glass-panel" style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div style={{ padding: '12px', background: 'rgba(168, 85, 247, 0.15)', borderRadius: '12px' }}>
            <Moon size={28} style={{ color: '#a855f7' }} />
          </div>
          <div>
            <h4 style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Porsi Kunjungan Malam</h4>
            <div style={{ fontSize: '1.6rem', fontWeight: 700 }}>{totalBoth > 0 ? ((totalMalam / totalBoth) * 100).toFixed(1) : 0}%</div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{formatNumber(totalMalam)} pengunjung</p>
          </div>
        </div>
      </div>

      {/* Main Analysis Visualizations */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        
        {/* Day/Night Ratio */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
          <h3 style={{ alignSelf: 'flex-start' }}>Rasio Pengunjung (Siang vs Malam)</h3>
          <div style={{ position: 'relative', height: '240px', width: '100%' }}>
            <Pie 
              data={ratioChartData} 
              options={{ 
                responsive: true, 
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: 'bottom',
                    labels: { color: '#9ca3af', font: { family: 'Outfit' } }
                  }
                }
              }} 
            />
          </div>
        </div>

        {/* Visitor Demographics */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3>Kategori Tiket Pengunjung</h3>
          <div style={{ position: 'relative', height: '240px' }}>
            <Bar 
              data={categoryChartData} 
              options={{ 
                responsive: true, 
                maintainAspectRatio: false,
                plugins: {
                  legend: { labels: { color: '#9ca3af', font: { family: 'Outfit' } } }
                },
                scales: {
                  x: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#9ca3af', font: { family: 'Outfit' } } },
                  y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#9ca3af', font: { family: 'Outfit' } } }
                }
              }} 
            />
          </div>
        </div>

      </div>

      {/* Revenue by Category Grouped Bar Chart */}
      <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h3>Perbandingan Estimasi Pendapatan per Kategori (Siang vs Malam)</h3>
        <div style={{ position: 'relative', height: '320px' }}>
          <Bar 
            data={categoryRevenueChartData} 
            options={{ 
              responsive: true, 
              maintainAspectRatio: false,
              plugins: {
                legend: { position: 'top', labels: { color: '#9ca3af', font: { family: 'Outfit' } } },
                tooltip: {
                  callbacks: {
                    label: (context: any) => `${context.dataset.label}: ${formatIDR(context.raw)}`
                  }
                }
              },
              scales: {
                x: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#9ca3af', font: { family: 'Outfit' } } },
                y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#9ca3af', font: { family: 'Outfit' } } }
              }
            }} 
          />
        </div>
      </div>

      {/* Conditional IWM Revenue per Location Bar Chart */}
      {showIWMChart && (
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3>Perbandingan Pendapatan per Lokasi Pintu (IWM)</h3>
          <div style={{ position: 'relative', height: '320px' }}>
            <Bar 
              data={locationRevenueChartData} 
              options={{ 
                responsive: true, 
                maintainAspectRatio: false,
                plugins: {
                  legend: { position: 'top', labels: { color: '#9ca3af', font: { family: 'Outfit' } } },
                  tooltip: {
                    callbacks: {
                      label: (context: any) => `${context.dataset.label}: ${formatIDR(context.raw)}`
                    }
                  }
                },
                scales: {
                  x: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#9ca3af', font: { family: 'Outfit' } } },
                  y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#9ca3af', font: { family: 'Outfit' } } }
                }
              }} 
            />
          </div>
        </div>
      )}

    </div>
  );
};

