import React from 'react';
import type { DailyRecord } from '../types';
import { CheckCircle, Cpu, Clock, AlertTriangle } from 'lucide-react';

interface ScraperStatusProps {
  data: DailyRecord[];
}

export const ScraperStatus: React.FC<ScraperStatusProps> = ({ data }) => {
  const latestRecord = data[0] || null;
  const siangRun = latestRecord?.siang?.last_run;
  const malamRun = latestRecord?.malam?.last_run;
  
  // Pilih waktu update paling baru di antara siang atau malam
  const lastRunStr = malamRun || siangRun;
  const isSuccess = !!lastRunStr;

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Belum pernah sinkronisasi';
    return new Date(dateStr).toLocaleString('id-ID', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'short'
    });
  };

  // Cek apakah bot tertunda (jika lebih dari 20 menit tidak update)
  const isDelayed = lastRunStr ? (new Date().getTime() - new Date(lastRunStr).getTime()) > 20 * 60 * 1000 : true;

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Cpu size={20} style={{ color: '#06b6d4' }} />
          Status Robot Scraper (Latar Belakang)
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.6' }}>
          Halaman penarikan data manual via tombol web telah <strong>dinonaktifkan</strong> karena Anda telah menggunakan script robot Python (<code>tarik_data.py</code>). Script baru ini jauh lebih cerdas, menangani rincian per-channel, dan berjalan otomatis setiap 15 menit. Menjalankan sinkronisasi manual dari web berpotensi merusak format rincian channel.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '12px', background: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="flex-between">
            <span style={{ fontSize: '0.95rem', color: 'var(--text-secondary)' }}>Status Koneksi ke Database Firebase:</span>
            {isSuccess ? (
              <span className="badge badge-siang" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
                <CheckCircle size={14} /> KONEKSI AKTIF
              </span>
            ) : (
              <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', fontSize: '0.85rem' }}>
                BELUM ADA DATA
              </span>
            )}
          </div>

          <div className="flex-between">
            <span style={{ fontSize: '0.95rem', color: 'var(--text-secondary)' }}>Terakhir Update oleh Robot Python:</span>
            <span style={{ color: '#ffffff', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
               <Clock size={14} style={{ color: '#3b82f6' }}/> {formatDate(lastRunStr)}
            </span>
          </div>

          <div className="flex-between">
            <span style={{ fontSize: '0.95rem', color: 'var(--text-secondary)' }}>Kesehatan Robot:</span>
            {lastRunStr && !isDelayed ? (
              <span style={{ color: '#10b981', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle size={14} /> Normal (Berjalan Sesuai Jadwal)
              </span>
            ) : (
              <span style={{ color: '#f59e0b', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertTriangle size={14} /> Terhenti / Tertunda (Lebih dari 20 Menit)
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
