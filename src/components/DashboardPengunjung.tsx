import React, { useState, useEffect } from 'react';
import type { DailyRecord } from '../types';
import './DashboardInfografis.css';
import { CloudRain, Sun, Cloud, CloudLightning } from 'lucide-react';

interface DashboardPengunjungProps {
  data: DailyRecord[];
}

export const DashboardPengunjung: React.FC<DashboardPengunjungProps> = ({ data }) => {
  const [shiftTab, setShiftTab] = useState<'siang' | 'malam' | 'kumulatif'>('kumulatif');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const [weather, setWeather] = useState({ temp: 31, desc: 'Memuat...', icon: 'cloud' });

  // Reusable card for detailed stats
  const DetailedStatCard = ({ title, data, total, percentage, hideProgress }: { title: string, data: any, total: number, percentage: string, hideProgress?: boolean }) => (
    <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
      
      <div style={{ borderBottom: '2px solid rgba(255,255,255,0.05)', paddingBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: hideProgress ? '0' : '8px' }}>
          <div style={{ fontSize: '1.1rem', color: '#fff', fontWeight: 'bold' }}>
            {title}
          </div>
          {!hideProgress && (
            <div style={{ fontSize: '1.2rem', color: '#3b82f6', fontWeight: 'bold' }}>
              {percentage}%
            </div>
          )}
        </div>
        {!hideProgress ? (
          <>
            <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ width: `${percentage}%`, height: '100%', background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)', borderRadius: '3px', transition: 'width 1s ease-in-out' }}></div>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px', textAlign: 'right' }}>
              Total <strong style={{color: '#fff'}}>{formatNumber(total)}</strong> Pengunjung/Tiket
            </div>
          </>
        ) : (
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Total <strong style={{color: '#fff'}}>{formatNumber(total)}</strong> Pengunjung/Tiket
          </div>
        )}
      </div>
      
      {/* Kategori Pengunjung */}
      <div>
        <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#10b981', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Pengunjung</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.85rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(0,0,0,0.25)', padding: '8px 12px', borderRadius: '8px' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Dewasa</span>
            <span style={{ fontWeight: 'bold', color: '#fff' }}>{formatNumber(data.dewasa)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(0,0,0,0.25)', padding: '8px 12px', borderRadius: '8px' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Anak</span>
            <span style={{ fontWeight: 'bold', color: '#fff' }}>{formatNumber(data.anak)}</span>
          </div>
        </div>
      </div>

      {/* Kategori Kendaraan */}
      <div>
        <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Kendaraan</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.85rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(0,0,0,0.25)', padding: '8px 12px', borderRadius: '8px' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Motor</span>
            <span style={{ fontWeight: 'bold', color: '#fff' }}>{formatNumber(data.motor)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(0,0,0,0.25)', padding: '8px 12px', borderRadius: '8px' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Mobil</span>
            <span style={{ fontWeight: 'bold', color: '#fff' }}>{formatNumber(data.mobil)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(0,0,0,0.25)', padding: '8px 12px', borderRadius: '8px' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Bus Gol I</span>
            <span style={{ fontWeight: 'bold', color: '#fff' }}>{formatNumber(data.gol1)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(0,0,0,0.25)', padding: '8px 12px', borderRadius: '8px' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Bus Gol II</span>
            <span style={{ fontWeight: 'bold', color: '#fff' }}>{formatNumber(data.gol2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(0,0,0,0.25)', padding: '8px 12px', borderRadius: '8px' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Sepeda</span>
            <span style={{ fontWeight: 'bold', color: '#fff' }}>{formatNumber(data.sepeda)}</span>
          </div>
        </div>
      </div>

      {/* Kategori Wahana */}
      <div>
        <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Wahana</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.85rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(0,0,0,0.25)', padding: '8px 12px', borderRadius: '8px' }}>
            <span style={{ color: 'var(--text-secondary)' }}>PPS</span>
            <span style={{ fontWeight: 'bold', color: '#fff' }}>{formatNumber(data.pps)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(0,0,0,0.25)', padding: '8px 12px', borderRadius: '8px' }}>
            <span style={{ color: 'var(--text-secondary)' }}>TSA</span>
            <span style={{ fontWeight: 'bold', color: '#fff' }}>{formatNumber(data.tsa)}</span>
          </div>
        </div>
      </div>
    </div>
  );

  useEffect(() => {
    if (data && data.length > 0) {
      const latest = data[0].date;
      setStartDate(latest);
      setEndDate(latest);
    }
  }, [data]);

  useEffect(() => {
    // Fetch live weather for Ragunan, Jakarta Selatan (-6.3122, 106.8206)
    const fetchWeather = async () => {
      try {
        const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=-6.3122&longitude=106.8206&current_weather=true');
        const d = await res.json();
        if (d.current_weather) {
          const t = Math.round(d.current_weather.temperature);
          const c = d.current_weather.weathercode;
          let desc = 'Cerah';
          let icon = 'sun';
          if (c >= 1 && c <= 3) { desc = 'Berawan'; icon = 'cloud'; }
          else if (c >= 45 && c <= 48) { desc = 'Kabut'; icon = 'cloud'; }
          else if (c >= 51 && c <= 67) { desc = 'Hujan Ringan'; icon = 'rain'; }
          else if (c >= 80 && c <= 82) { desc = 'Hujan Deras'; icon = 'rain'; }
          else if (c >= 95) { desc = 'Badai Petir'; icon = 'lightning'; }
          setWeather({ temp: t, desc, icon });
        }
      } catch (e) {
        setWeather({ temp: 31, desc: 'Gagal memuat cuaca', icon: 'cloud' });
      }
    };
    fetchWeather();
    // Refresh weather every 15 minutes
    const interval = setInterval(fetchWeather, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const formatNumber = (num: number) => new Intl.NumberFormat('id-ID').format(num);

  const filteredRecords = data.filter(r => r.date >= startDate && r.date <= endDate);
  const latestRecord = filteredRecords[0];

  const getFieldVal = (r: DailyRecord, key: string): number => {
    const siangVal = (r.siang?.rekap as any)?.[key] || 0;
    const malamVal = (r.malam?.rekap as any)?.[key] || 0;
    
    if (shiftTab === 'siang') return siangVal;
    if (shiftTab === 'malam') return malamVal;
    
    if (r.siang && r.malam && r.siang.last_run === r.malam.last_run) {
      return siangVal;
    }
    return siangVal + malamVal;
  };

  const rekap = filteredRecords.reduce((acc, r) => {
    let currentRekap: any = {};
    if (shiftTab === 'siang') {
      currentRekap = r.siang?.rekap || {};
    } else if (shiftTab === 'malam') {
      currentRekap = r.malam?.rekap || {};
    } else {
      currentRekap = {
        total_pengunjung: getFieldVal(r, 'total_pengunjung'),
        motor: getFieldVal(r, 'motor'),
        mobil: getFieldVal(r, 'mobil'),
        bus: getFieldVal(r, 'bus'),
        sepeda: getFieldVal(r, 'sepeda'),
        pps: getFieldVal(r, 'pps'),
        tsa: getFieldVal(r, 'tsa'),
        anak: getFieldVal(r, 'anak'),
        dewasa: getFieldVal(r, 'dewasa'),
        bus_gol_1: getFieldVal(r, 'bus_gol_1'),
        bus_gol_2: getFieldVal(r, 'bus_gol_2'),
        boogy_car: getFieldVal(r, 'boogy_car'),
        update_str: r.malam?.rekap?.update_str || r.siang?.rekap?.update_str || '-',
        tanggal_str: r.malam?.rekap?.tanggal_str || r.siang?.rekap?.tanggal_str || '-',
        jam_str: r.malam?.rekap?.jam_str || r.siang?.rekap?.jam_str || '-'
      };
    }

    return {
      total_pengunjung: acc.total_pengunjung + (currentRekap.total_pengunjung || 0),
      motor: acc.motor + (currentRekap.motor || 0),
      mobil: acc.mobil + (currentRekap.mobil || 0),
      bus: acc.bus + (currentRekap.bus || 0),
      sepeda: acc.sepeda + (currentRekap.sepeda || 0),
      pps: acc.pps + (currentRekap.pps || 0),
      tsa: acc.tsa + (currentRekap.tsa || 0),
      anak: acc.anak + (currentRekap.anak || 0),
      dewasa: acc.dewasa + (currentRekap.dewasa || 0),
      bus_gol_1: acc.bus_gol_1 + (currentRekap.bus_gol_1 || 0),
      bus_gol_2: acc.bus_gol_2 + (currentRekap.bus_gol_2 || 0),
      boogy_car: acc.boogy_car + (currentRekap.boogy_car || 0),
      update_str: currentRekap.update_str || acc.update_str,
      tanggal_str: filteredRecords.length === 1 
        ? (currentRekap.tanggal_str || '-') 
        : `${startDate} s/d ${endDate}`,
      jam_str: currentRekap.jam_str || acc.jam_str
    };
  }, {
    total_pengunjung: 0, motor: 0, mobil: 0, bus: 0, sepeda: 0,
    pps: 0, tsa: 0, anak: 0, dewasa: 0, bus_gol_1: 0, bus_gol_2: 0, boogy_car: 0,
    update_str: '-', tanggal_str: '-', jam_str: '-'
  });

  const qtyDewasa = rekap.dewasa || 0;
  const qtyAnak = rekap.anak || 0;
  const qtyTSA = rekap.tsa || 0;
  const qtyPPS = rekap.pps || 0;
  
  const qtySepeda = rekap.sepeda || 0;
  const qtyMotor = rekap.motor || 0;
  const qtyMobil = rekap.mobil || 0;
  const qtyBus = rekap.bus || 0;

  // Format the date like "Selasa, 07 April 2026 pukul 16:00 WIB"
  const getFormattedDateString = () => {
    if (!latestRecord) return 'Tidak ada data';
    const d = new Date(latestRecord.date);
    const day = d.toLocaleDateString('id-ID', { weekday: 'long' });
    const dateStr = d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
    const timeStr = rekap.jam_str || '16:00';
    return `${day}, ${dateStr} pukul ${timeStr} WIB`;
  };

  const getTicketsByChannel = (r: DailyRecord, channel: string): any[] => {
    if (shiftTab === 'siang') return r.siang?.tickets_3a_by_channel_visit?.[channel] || [];
    if (shiftTab === 'kumulatif') return r.malam?.tickets_3a_by_channel_visit?.[channel] || r.siang?.tickets_3a_by_channel_visit?.[channel] || [];
    
    const siangT = r.siang?.tickets_3a_by_channel_visit?.[channel] || [];
    const malamT = r.malam?.tickets_3a_by_channel_visit?.[channel] || [];
    if (siangT.length === 0) return malamT;
    if (malamT.length === 0) return [];
    if (r.siang && r.malam && r.siang.last_run === r.malam.last_run) return [];
    
    return malamT.map(mItem => {
      const sItem = siangT.find(s => s.item === mItem.item);
      if (!sItem) return mItem;
      return { ...mItem, qty: Math.max(0, (mItem.qty || 0) - (sItem.qty || 0)) };
    });
  };

  const parseChannelTickets = (channel: string) => {
    let totals = {
      dewasa: 0, anak: 0, motor: 0, mobil: 0, gol1: 0, gol2: 0, sepeda: 0, pps: 0, tsa: 0
    };
    filteredRecords.forEach(r => {
      const tickets = getTicketsByChannel(r, channel);
      tickets.forEach(t => {
        const kat = ((t.item || '') + ' ' + (t.kategori || '')).toUpperCase();
        const qty = t.qty || 0;
        
        if (kat.includes("PUSAT PRIMATA") || kat.includes("SCHMUTZER")) {
          totals.pps += qty;
        } else if (kat.includes("TAMAN SATWA") || (kat.includes("TSA") && !kat.includes("KENDARAAN"))) {
          totals.tsa += qty;
        } else if (kat.includes("DEWASA")) {
          totals.dewasa += qty;
        } else if (kat.includes("ANAK")) {
          totals.anak += qty;
        } else if (kat.includes("GOL I") && !kat.includes("GOL II") && !kat.includes("GOL III")) {
          totals.gol1 += qty;
        } else if (kat.includes("GOL II") && !kat.includes("GOL III")) {
          totals.gol2 += qty;
        } else if (kat.includes("GOL III") || kat.includes("MOBIL SEDAN") || kat.includes("MINI BUS")) {
          totals.mobil += qty;
        } else if (kat.includes("SEPEDA MOTOR") || (kat.includes("MOTOR") && !kat.includes("GOL"))) {
          totals.motor += qty;
        } else if (kat.includes("SEPEDA") && !kat.includes("MOTOR")) {
          totals.sepeda += qty;
        }
      });
    });
    return totals;
  };

  const merchantData = parseChannelTickets("MERCHANT_PAGE");
  const tvmData = parseChannelTickets("TVM");
  const gateNewData = parseChannelTickets("GATE");
  const mposData = parseChannelTickets("MPOS");

  const getIWMListForRecord = (r: DailyRecord): any[] => {
    if (shiftTab === 'siang') return r.siang?.iwm || [];
    if (shiftTab === 'kumulatif') return r.malam?.iwm || r.siang?.iwm || [];
    
    const siangIwm = r.siang?.iwm || [];
    const malamIwm = r.malam?.iwm || [];
    if (siangIwm.length === 0) return malamIwm;
    if (malamIwm.length === 0) return [];
    if (r.siang && r.malam && r.siang.last_run === r.malam.last_run) return [];
    
    return malamIwm.map(mItem => {
      const sItem = siangIwm.find(s => s.lokasi === mItem.lokasi);
      if (!sItem) return mItem;
      const sub = (valM?: number, valS?: number) => Math.max(0, (valM || 0) - (valS || 0));
      return {
        ...mItem,
        karcis_anak: sub(mItem.karcis_anak, sItem.karcis_anak),
        karcis_dewasa: sub(mItem.karcis_dewasa, sItem.karcis_dewasa),
        parkir_gol_1: sub(mItem.parkir_gol_1, sItem.parkir_gol_1),
        parkir_gol_2: sub(mItem.parkir_gol_2, sItem.parkir_gol_2),
        parkir_gol_3: sub(mItem.parkir_gol_3, sItem.parkir_gol_3),
        parkir_motor: sub(mItem.parkir_motor, sItem.parkir_motor),
        parkir_sepeda: sub(mItem.parkir_sepeda, sItem.parkir_sepeda),
        total: sub(mItem.total, sItem.total)
      };
    });
  };

  const parseIWMTickets = () => {
    let totals = {
      dewasa: 0, anak: 0, motor: 0, mobil: 0, gol1: 0, gol2: 0, sepeda: 0, pps: 0, tsa: 0
    };
    filteredRecords.forEach(r => {
      const iwm = getIWMListForRecord(r);
      iwm.forEach(i => {
        const lok = i.lokasi?.toLowerCase() || '';
        if (lok === 'total') return;

        const k_anak = (i.karcis_anak || i.karcis_masuk || 0);
        const k_dewasa = (i.karcis_dewasa || i.harga_satuan || 0);
        
        if (lok.includes('primata') || lok.includes('schmutzer')) {
           totals.pps += k_anak + k_dewasa;
        } else if (lok.includes('satwa anak') || lok.includes('children zoo')) {
           totals.tsa += k_anak + k_dewasa;
        } else {
           totals.anak += k_anak;
           totals.dewasa += k_dewasa;
        }

        totals.gol1 += (i.parkir_gol_1 || 0);
        totals.gol2 += (i.parkir_gol_2 || 0);
        totals.mobil += (i.parkir_gol_3 || 0);
        totals.motor += (i.parkir_motor || 0);
        totals.sepeda += (i.parkir_sepeda || 0);
      });
    });
    return totals;
  };
  const iwmData = parseIWMTickets();

  const animalImages = [
    "https://images.unsplash.com/photo-1549480017-d76466a4b7e8?auto=format&fit=crop&q=80&w=1920", // Minggu (Harimau)
    "https://images.unsplash.com/photo-1557050543-4d5f4e07ef46?auto=format&fit=crop&q=80&w=1920", // Senin (Gajah)
    "https://images.unsplash.com/photo-1547471080-7cb2ac647132?auto=format&fit=crop&q=80&w=1920", // Selasa (Jerapah)
    "https://images.unsplash.com/photo-1545042746-1db81f62b083?auto=format&fit=crop&q=80&w=1920", // Rabu (Orangutan)
    "https://images.unsplash.com/photo-1526095179574-86e545346ae6?auto=format&fit=crop&q=80&w=1920", // Kamis (Zebra)
    "https://images.unsplash.com/photo-1601275225755-f6a6c1730cb1?auto=format&fit=crop&q=80&w=1920", // Jumat (Kapibara)
    "https://images.unsplash.com/photo-1517825738774-7de9363ef735?auto=format&fit=crop&q=80&w=1920"  // Sabtu (Singa)
  ];
  
  const dayOfWeek = new Date().getDay();
  const selectedAnimalImage = animalImages[dayOfWeek];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Controls remain standard */}
      <div className="glass-panel" style={{ padding: '16px 24px', display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '4px', background: 'rgba(255, 255, 255, 0.05)', padding: '4px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <button className={`btn btn-sm ${shiftTab === 'kumulatif' ? 'btn-primary' : ''}`} onClick={() => setShiftTab('kumulatif')}>Kumulatif</button>
            <button className={`btn btn-sm ${shiftTab === 'siang' ? 'btn-primary' : ''}`} onClick={() => setShiftTab('siang')}>Siang</button>
            <button className={`btn btn-sm ${shiftTab === 'malam' ? 'btn-primary' : ''}`} onClick={() => setShiftTab('malam')}>Malam</button>
          </div>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ background: 'rgba(0, 0, 0, 0.2)', border: '1px solid var(--panel-border)', borderRadius: '6px', padding: '6px 12px', color: '#ffffff' }} />
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ background: 'rgba(0, 0, 0, 0.2)', border: '1px solid var(--panel-border)', borderRadius: '6px', padding: '6px 12px', color: '#ffffff' }} />
        </div>
      </div>

      {/* The Infographic Dashboard */}
      <div 
        className="dashboard-infographic fade-in" 
        style={{ 
          position: 'relative',
          overflow: 'hidden',
          backgroundImage: 'none' // Remove default CSS background
        }}
      >
        {/* Dynamic Zoomed Background Image */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: `url('${selectedAnimalImage}')`,
          backgroundSize: 'cover',
          backgroundPosition: 'left center',
          transform: 'scale(1.35)', // Zoom in 35%
          transformOrigin: 'left center', // Keep left edge locked, push rest to the right
          zIndex: 0
        }} />

        {/* Gradient Overlay for Text Readability */}
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'linear-gradient(90deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.85) 40%, rgba(255,255,255,0) 100%)',
          pointerEvents: 'none',
          zIndex: 1
        }} />

        <div className="info-content" style={{ position: 'relative', zIndex: 2 }}>
          
          <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
            {/* Logo placeholder - using generic text if no logo available, or external url */}
            <div style={{ background: '#1e293b', padding: '10px', borderRadius: '8px', border: '2px solid #fbbf24', height: '80px', width: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: 'white', fontSize: '10px', textAlign: 'center', fontWeight: 'bold' }}>JAYA RAYA</span>
            </div>
            <div>
              <h1 className="header-title">DATA PENGUNJUNG</h1>
              <div className="datetime-badge">
                {getFormattedDateString()}
              </div>
            </div>
          </div>

          <div className="main-stats-container">
            <div className="people-stats">
              <div className="stat-item">
                <div className="stat-icon-wrapper">
                  <span style={{ fontSize: '4rem' }}>🐅</span>
                </div>
                <div className="stat-label">Dewasa</div>
                <div className="stat-number-purple">{formatNumber(qtyDewasa)}</div>
              </div>
              <div className="stat-item">
                <div className="stat-icon-wrapper">
                  <span style={{ fontSize: '3rem' }}>🐯</span>
                </div>
                <div className="stat-label">Anak</div>
                <div className="stat-number-purple">{formatNumber(qtyAnak)}</div>
              </div>
            </div>
            
            <div className="total-block">
              <div className="total-label">TOTAL</div>
              <div className="total-value">{formatNumber(rekap.total_pengunjung || 0)}</div>
            </div>
          </div>

          <div className="vehicle-row">
            <div className="vehicle-stat-item">
              <div className="stat-icon-wrapper">
                <span style={{ fontSize: '2.5rem' }}>🚲</span>
              </div>
              <div className="stat-label">Sepeda</div>
              <div className="stat-number-vehicle bg-dark-red">{formatNumber(qtySepeda)}</div>
            </div>
            <div className="vehicle-stat-item">
              <div className="stat-icon-wrapper">
                <span style={{ fontSize: '2.5rem' }}>🏍️</span>
              </div>
              <div className="stat-label">Motor</div>
              <div className="stat-number-vehicle bg-red">{formatNumber(qtyMotor)}</div>
            </div>
            <div className="vehicle-stat-item">
              <div className="stat-icon-wrapper">
                <span style={{ fontSize: '2.5rem' }}>🚗</span>
              </div>
              <div className="stat-label">Mobil</div>
              <div className="stat-number-vehicle bg-yellow">{formatNumber(qtyMobil)}</div>
            </div>
            <div className="vehicle-stat-item">
              <div className="stat-icon-wrapper">
                <span style={{ fontSize: '2.5rem' }}>🚌</span>
              </div>
              <div className="stat-label">Bus</div>
              <div className="stat-number-vehicle bg-light-green">{formatNumber(qtyBus)}</div>
            </div>
          </div>

          <div className="bottom-row">
            <div className="wahana-pills">
              <div className="wahana-pill">
                <div className="wahana-icon">🐊</div>
                <span>{formatNumber(qtyTSA)}</span>
                <span style={{ fontSize: '0.8rem', marginLeft: '-5px' }}>TSA</span>
              </div>
              <div className="wahana-pill">
                <div className="wahana-icon">🦍</div>
                <span>{formatNumber(qtyPPS)}</span>
                <span style={{ fontSize: '0.8rem', marginLeft: '-5px' }}>PPS</span>
              </div>
            </div>

            <div className="weather-widget">
              {weather.icon === 'sun' && <Sun size={24} color="#ffb300" />}
              {weather.icon === 'cloud' && <Cloud size={24} color="#90caf9" />}
              {weather.icon === 'rain' && <CloudRain size={24} color="#2196f3" />}
              {weather.icon === 'lightning' && <CloudLightning size={24} color="#673ab7" />}
              <span>{weather.temp}° C - {weather.desc}</span>
            </div>
          </div>

        </div>
      </div>

        <div className="glass-panel" style={{ padding: '24px' }}>
        <h3 style={{ marginBottom: '16px', color: 'var(--text-primary)', borderBottom: '1px solid var(--panel-border)', paddingBottom: '12px' }}>
          Rincian Detail per Channel Pembelian
        </h3>
        
        {(() => {
          const merchantTotal = Object.values(merchantData).reduce((a: any, b: any) => a + b, 0) as number;
          const tvmTotal = Object.values(tvmData).reduce((a: any, b: any) => a + b, 0) as number;
          const gateNewTotal = Object.values(gateNewData).reduce((a: any, b: any) => a + b, 0) as number;
          const mposTotal = Object.values(mposData).reduce((a: any, b: any) => a + b, 0) as number;
          const iwmTotal = Object.values(iwmData).reduce((a: any, b: any) => a + b, 0) as number;
          const grandTotal = merchantTotal + tvmTotal + gateNewTotal + mposTotal + iwmTotal;
          const calcPercent = (val: number) => grandTotal > 0 ? ((val / grandTotal) * 100).toFixed(1) : "0.0";

          const combinedGateTotal = gateNewTotal + iwmTotal;

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* Top Row: Merchant, TVM, Mpos */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                <DetailedStatCard title="Merchant Page (3A)" data={merchantData} total={merchantTotal} percentage={calcPercent(merchantTotal)} />
                <DetailedStatCard title="TVM (3A)" data={tvmData} total={tvmTotal} percentage={calcPercent(tvmTotal)} />
                <DetailedStatCard title="Mpos (3A)" data={mposData} total={mposTotal} percentage={calcPercent(mposTotal)} />
              </div>

              {/* Jakcard Cluster */}
              <div style={{ background: 'rgba(16, 185, 129, 0.03)', padding: '24px', borderRadius: '16px', border: '1px solid rgba(16, 185, 129, 0.2)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {/* Cluster Header */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '1.2rem', color: '#10b981', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ display: 'inline-block', width: '8px', height: '20px', background: '#10b981', borderRadius: '4px' }}></span>
                      Pengunjung via Jakcard (Gabungan Semua Gate)
                    </div>
                    <div style={{ fontSize: '1.4rem', color: '#3b82f6', fontWeight: 'bold' }}>
                      {calcPercent(combinedGateTotal)}%
                    </div>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${calcPercent(combinedGateTotal)}%`, height: '100%', background: 'linear-gradient(90deg, #10b981, #3b82f6)', borderRadius: '4px', transition: 'width 1s ease-in-out' }}></div>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'right', marginTop: '4px' }}>
                    Total <strong style={{color: '#fff'}}>{formatNumber(combinedGateTotal)}</strong> Pengunjung/Tiket
                  </div>
                </div>

                {/* Cluster Content */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                  <DetailedStatCard title="New Gate (3A)" data={gateNewData} total={gateNewTotal} percentage="0" hideProgress={true} />
                  <DetailedStatCard title="Old Gate (IWM)" data={iwmData} total={iwmTotal} percentage="0" hideProgress={true} />
                </div>
              </div>

            </div>
          );
        })()}

      </div>

    </div>
  );
};
