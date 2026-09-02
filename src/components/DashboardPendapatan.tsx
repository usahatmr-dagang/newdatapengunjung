import React, { useState, useEffect } from 'react';
import type { DailyRecord } from '../types';
import { DollarSign, FileText, Building, CreditCard } from 'lucide-react';

interface DashboardPendapatanProps {
  data: DailyRecord[];
}

// Terbilang translation helper in TypeScript
const terbilang = (angka: number): string => {
  const huruf = ["", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan", "sepuluh", "sebelas"];
  if (angka < 12) return huruf[angka];
  else if (angka < 20) return terbilang(angka - 10) + " belas";
  else if (angka < 100) return terbilang(Math.floor(angka / 10)) + " puluh " + terbilang(angka % 10);
  else if (angka < 200) return "seratus " + terbilang(angka - 100);
  else if (angka < 1000) return terbilang(Math.floor(angka / 100)) + " ratus " + terbilang(angka % 100);
  else if (angka < 2000) return "seribu " + terbilang(angka - 1000);
  else if (angka < 1000000) return terbilang(Math.floor(angka / 1000)) + " ribu " + terbilang(angka % 1000);
  else if (angka < 1000000000) return terbilang(Math.floor(angka / 1000000)) + " juta " + terbilang(angka % 1000000);
  else if (angka < 1000000000000) return terbilang(Math.floor(angka / 1000000000)) + " miliar " + terbilang(angka % 1000000000);
  return "";
};

const generateTerbilang = (nominal: number): string => {
  if (nominal === 0) return "Nol rupiah.-";
  let text = terbilang(nominal).trim();
  text = text.charAt(0).toUpperCase() + text.slice(1) + " rupiah.-";
  return text.replace(/\s+/g, ' ');
};

export const DashboardPendapatan: React.FC<DashboardPendapatanProps> = ({ data }) => {
  const [shiftTab, setShiftTab] = useState<'siang' | 'malam' | 'kumulatif'>('kumulatif');
  const [stsuChannel, setStsuChannel] = useState<'MERCHANT_PAGE' | 'TVM' | 'GATE' | 'IWM'>('MERCHANT_PAGE');
  
  // Date selection states
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Synchronize date selection with available records on load
  useEffect(() => {
    if (data && data.length > 0) {
      const latest = data[0].date;
      setStartDate(latest);
      setEndDate(latest);
    }
  }, [data]);

  const formatNumber = (num: number) => new Intl.NumberFormat('id-ID').format(num);
  const formatIDR = (num: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);

  // Filter records within the selected date range
  const filteredRecords = data.filter(r => r.date >= startDate && r.date <= endDate);
  const latestRecord = filteredRecords[0];

  // Determine weekend rates based on the start date (or if there's any weekend in the range)
  const isWeekendRange = () => {
    return filteredRecords.some(r => {
      const day = new Date(r.date).getDay();
      return day === 0 || day === 6;
    });
  };

  const isWk = isWeekendRange();
  const ppsRate = isWk ? 7500 : 6000;


  // Helper to aggregate fields for rekapPendapatan across siang and malam for a record
  const getFieldVal = (r: DailyRecord, key: string): number => {
    const siangVal = (r.siang?.rekap_pendapatan || r.siang?.rekap as any)?.[key] || 0;
    const malamVal = (r.malam?.rekap_pendapatan || r.malam?.rekap as any)?.[key] || 0;
    
    if (shiftTab === 'siang') return siangVal;
    if (shiftTab === 'malam') return malamVal;
    
    // kumulatif: check if it's a fallback duplicate
    if (r.siang && r.malam && r.siang.last_run === r.malam.last_run) {
      return siangVal;
    }
    return siangVal + malamVal;
  };

  // Helpers to get shift-specific lists/maps by subtracting day shift from cumulative total if shift is 'malam'
  const getIWMListForRecord = (r: DailyRecord): any[] => {
    if (shiftTab === 'siang') return r.siang?.iwm || [];
    if (shiftTab === 'kumulatif') return r.malam?.iwm || r.siang?.iwm || [];
    
    // malam (shift-only) = malam (cumulative) - siang
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

  const getTicketsListForRecord = (r: DailyRecord): any[] => {
    if (shiftTab === 'siang') return r.siang?.tickets_3a || [];
    if (shiftTab === 'kumulatif') return r.malam?.tickets_3a || r.siang?.tickets_3a || [];
    
    // malam
    const siangTickets = r.siang?.tickets_3a || [];
    const malamTickets = r.malam?.tickets_3a || [];
    if (siangTickets.length === 0) return malamTickets;
    if (malamTickets.length === 0) return [];
    if (r.siang && r.malam && r.siang.last_run === r.malam.last_run) return [];
    
    return malamTickets.map(mItem => {
      const sItem = siangTickets.find(s => s.item === mItem.item);
      if (!sItem) return mItem;
      const qtyDiff = Math.max(0, (mItem.qty || 0) - (sItem.qty || 0));
      const totalDiff = Math.max(0, (mItem.total || 0) - (sItem.total || 0));
      return {
        ...mItem,
        qty: qtyDiff,
        total: totalDiff
      };
    });
  };

  const getStsuMapForRecord = (r: DailyRecord, channel: string): Record<string, { qty: number; nominal: number }> => {
    const getChMap = (shiftData: any) => shiftData?.stsu?.[channel];
    if (shiftTab === 'siang') return getChMap(r.siang) || {};
    if (shiftTab === 'kumulatif') return getChMap(r.malam) || getChMap(r.siang) || {};
    
    // malam
    const siangMap = getChMap(r.siang);
    const malamMap = getChMap(r.malam);
    if (r.siang && r.malam && r.siang.last_run === r.malam.last_run) return {};
    
    const result: Record<string, { qty: number; nominal: number }> = {};
    Object.keys(malamMap).forEach(key => {
      const mVal = malamMap[key] || { qty: 0, nominal: 0 };
      const sVal = siangMap[key] || { qty: 0, nominal: 0 };
      result[key] = {
        qty: Math.max(0, (mVal.qty || 0) - (sVal.qty || 0)),
        nominal: Math.max(0, (mVal.nominal || 0) - (sVal.nominal || 0))
      };
    });
    return result;
  };

  // 1. AGGREGATE REKAP & LISTS
  const rekapPendapatan = filteredRecords.reduce((acc, r) => {
    let rekap: any = {};
    if (shiftTab === 'siang') {
      rekap = r.siang?.rekap_pendapatan || r.siang?.rekap || {};
    } else if (shiftTab === 'malam') {
      rekap = r.malam?.rekap_pendapatan || r.malam?.rekap || {};
    } else {
      // kumulatif
      rekap = {
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
      total_pengunjung: acc.total_pengunjung + (rekap.total_pengunjung || 0),
      motor: acc.motor + (rekap.motor || 0),
      mobil: acc.mobil + (rekap.mobil || 0),
      bus: acc.bus + (rekap.bus || 0),
      sepeda: acc.sepeda + (rekap.sepeda || 0),
      pps: acc.pps + (rekap.pps || 0),
      tsa: acc.tsa + (rekap.tsa || 0),
      anak: acc.anak + (rekap.anak || 0),
      dewasa: acc.dewasa + (rekap.dewasa || 0),
      bus_gol_1: acc.bus_gol_1 + (rekap.bus_gol_1 || 0),
      bus_gol_2: acc.bus_gol_2 + (rekap.bus_gol_2 || 0),
      boogy_car: acc.boogy_car + (rekap.boogy_car || 0),
      update_str: rekap.update_str || acc.update_str,
      tanggal_str: filteredRecords.length === 1 
        ? (rekap.tanggal_str || '-') 
        : `${startDate} s/d ${endDate}`,
      jam_str: rekap.jam_str || acc.jam_str
    };
  }, {
    total_pengunjung: 0,
    motor: 0,
    mobil: 0,
    bus: 0,
    sepeda: 0,
    pps: 0,
    tsa: 0,
    anak: 0,
    dewasa: 0,
    bus_gol_1: 0,
    bus_gol_2: 0,
    boogy_car: 0,
    update_str: '-',
    tanggal_str: '-',
    jam_str: '-'
  });

  const iwmList: any[] = [];
  filteredRecords.forEach(r => {
    iwmList.push(...getIWMListForRecord(r));
  });

  const ticketsList3A: any[] = [];
  filteredRecords.forEach(r => {
    ticketsList3A.push(...getTicketsListForRecord(r));
  });

  // Calculate actual scraped IWM and estimated IWM revenue
  const iwmAnak = iwmList.reduce((sum, i) => {
    if (i.lokasi?.toLowerCase() === 'total' || i.lokasi === 'Pusat Primata' || i.lokasi === 'Children Zoo') return sum;
    return sum + (i.karcis_anak !== undefined ? i.karcis_anak : (i.karcis_masuk || 0));
  }, 0);
  const iwmDewasa = iwmList.reduce((sum, i) => {
    if (i.lokasi?.toLowerCase() === 'total' || i.lokasi === 'Pusat Primata' || i.lokasi === 'Children Zoo') return sum;
    return sum + (i.karcis_dewasa !== undefined ? i.karcis_dewasa : (i.harga_satuan || 0));
  }, 0);
  const iwmPPSAnak = iwmList.filter(i => i.lokasi === 'Pusat Primata').reduce((sum, i) => sum + (i.karcis_anak !== undefined ? i.karcis_anak : (i.karcis_masuk || 0)), 0);
  const iwmPPSDewasa = iwmList.filter(i => i.lokasi === 'Pusat Primata').reduce((sum, i) => sum + (i.karcis_dewasa !== undefined ? i.karcis_dewasa : (i.harga_satuan || 0)), 0);
  const iwmTSAAnak = iwmList.filter(i => i.lokasi === 'Children Zoo').reduce((sum, i) => sum + (i.karcis_anak !== undefined ? i.karcis_anak : (i.karcis_masuk || 0)), 0);
  const iwmTSADewasa = iwmList.filter(i => i.lokasi === 'Children Zoo').reduce((sum, i) => sum + (i.karcis_dewasa !== undefined ? i.karcis_dewasa : (i.harga_satuan || 0)), 0);

  const iwmMotor = iwmList.reduce((sum, i) => i.lokasi?.toLowerCase() === 'total' ? sum : sum + (i.parkir_motor !== undefined ? i.parkir_motor : (i.lain_lain || 0)), 0);
  const iwmMobil = iwmList.reduce((sum, i) => i.lokasi?.toLowerCase() === 'total' ? sum : sum + (i.parkir_gol_3 !== undefined ? i.parkir_gol_3 : (i.admin || 0)), 0);
  const iwmBusGol1 = iwmList.reduce((sum, i) => i.lokasi?.toLowerCase() === 'total' ? sum : sum + (i.parkir_gol_1 !== undefined ? i.parkir_gol_1 : (i.potongan || 0)), 0);
  const iwmBusGol2 = iwmList.reduce((sum, i) => i.lokasi?.toLowerCase() === 'total' ? sum : sum + (i.parkir_gol_2 !== undefined ? i.parkir_gol_2 : (i.netto || 0)), 0);
  const iwmSepeda = iwmList.reduce((sum, i) => i.lokasi?.toLowerCase() === 'total' ? sum : sum + (i.parkir_sepeda !== undefined ? i.parkir_sepeda : 0), 0);

  // Accumulate IWM STSU items
  const iwmStsuMap: Record<string, { qty: number; nominal: number }> = {};
  for (let i = 1; i <= 21; i++) {
    iwmStsuMap[i.toString()] = { qty: 0, nominal: 0 };
  }
  
  filteredRecords.forEach(r => {
    const dailyIwmStsu = getStsuMapForRecord(r, 'IWM');
    Object.keys(dailyIwmStsu).forEach(key => {
      if (iwmStsuMap[key]) {
        iwmStsuMap[key].qty += dailyIwmStsu[key].qty || 0;
        iwmStsuMap[key].nominal += dailyIwmStsu[key].nominal || 0;
      }
    });
  });

  const actualIwmRevenue = Object.values(iwmStsuMap).reduce((sum: number, val: any) => sum + (val.nominal || 0), 0);

  const offlineIWMRevenue = actualIwmRevenue > 0 ? actualIwmRevenue : (
                            (iwmAnak * 3000) + (iwmDewasa * 4000) + 
                            ((iwmPPSAnak + iwmPPSDewasa) * ppsRate) + 
                            ((iwmTSAAnak + iwmTSADewasa) * 2500) +
                            (iwmMotor * 3000) + (iwmMobil * 6000) +
                            (iwmBusGol1 * 15000) + (iwmBusGol2 * 12500) +
                            (iwmSepeda * 1000)
                          );

  // Online 3A paid total
  const online3ARevenue = ticketsList3A.reduce((sum, t) => sum + (t.total || 0), 0);
  const totalEstimatedRevenue = offlineIWMRevenue + online3ARevenue;

  // 2. CATEGORY BREAKDOWNS (COMBINED IWM + 3A PAID NOMINALS)
  const get3AQty = (keyword: string) => {
    return ticketsList3A.filter(t => t.item?.toLowerCase().includes(keyword.toLowerCase()) || t.kategori?.toLowerCase().includes(keyword.toLowerCase()))
                         .reduce((sum, t) => sum + (t.qty || 0), 0);
  };
  const get3ANominal = (keyword: string) => {
    return ticketsList3A.filter(t => t.item?.toLowerCase().includes(keyword.toLowerCase()) || t.kategori?.toLowerCase().includes(keyword.toLowerCase()))
                         .reduce((sum, t) => sum + (t.total || 0), 0);
  };

  const hasIwmStsu = actualIwmRevenue > 0;
  const revDewasa = (hasIwmStsu ? (iwmStsuMap["1"]?.nominal || 0) + (iwmStsuMap["3"]?.nominal || 0) : (iwmDewasa * 4000)) + get3ANominal('Dewasa');
  const revAnak = (hasIwmStsu ? (iwmStsuMap["2"]?.nominal || 0) + (iwmStsuMap["4"]?.nominal || 0) : (iwmAnak * 3000)) + get3ANominal('Anak');
  const qtyDewasa = iwmDewasa + (hasIwmStsu ? (iwmStsuMap["3"]?.qty || 0) : 0) + get3AQty('Dewasa');
  const qtyAnak = iwmAnak + (hasIwmStsu ? (iwmStsuMap["4"]?.qty || 0) : 0) + get3AQty('Anak');

  const revTSA = (hasIwmStsu ? (iwmStsuMap["8"]?.nominal || 0) : ((iwmTSAAnak + iwmTSADewasa) * 2500)) + get3ANominal('Taman Satwa Anak') + get3ANominal('TSA');
  const qtyTSA = iwmTSAAnak + iwmTSADewasa + (hasIwmStsu ? (iwmStsuMap["8"]?.qty || 0) - (iwmTSAAnak + iwmTSADewasa) : 0) + get3AQty('Taman Satwa Anak') + get3AQty('TSA');
  const revBoogy = (rekapPendapatan.boogy_car || 0) * 250000;
  const qtyBoogy = rekapPendapatan.boogy_car || 0;
  
  const ppsIwmNominal = hasIwmStsu ? 
    (iwmStsuMap["9"]?.nominal || 0) + (iwmStsuMap["10"]?.nominal || 0) + 
    (iwmStsuMap["11"]?.nominal || 0) + (iwmStsuMap["12"]?.nominal || 0) + 
    (iwmStsuMap["13"]?.nominal || 0) + (iwmStsuMap["14"]?.nominal || 0) + 
    (iwmStsuMap["15"]?.nominal || 0) + (iwmStsuMap["16"]?.nominal || 0) : 
    ((iwmPPSAnak + iwmPPSDewasa) * ppsRate);
  const revPPS = ppsIwmNominal + get3ANominal('Schmutzer') + get3ANominal('Pusat Primata');
  
  const ppsIwmQty = hasIwmStsu ? 
    (iwmStsuMap["9"]?.qty || 0) + (iwmStsuMap["10"]?.qty || 0) + 
    (iwmStsuMap["11"]?.qty || 0) + (iwmStsuMap["12"]?.qty || 0) + 
    (iwmStsuMap["13"]?.qty || 0) + (iwmStsuMap["14"]?.qty || 0) + 
    (iwmStsuMap["15"]?.qty || 0) + (iwmStsuMap["16"]?.qty || 0) : 
    (iwmPPSAnak + iwmPPSDewasa);
  const qtyPPS = ppsIwmQty + get3AQty('Schmutzer') + get3AQty('Pusat Primata');

  const revSepeda = (hasIwmStsu ? (iwmStsuMap["21"]?.nominal || 0) : (iwmSepeda * 1000)) + get3ANominal('Sepeda');
  const revMotor = (hasIwmStsu ? (iwmStsuMap["20"]?.nominal || 0) : (iwmMotor * 3000)) + get3ANominal('Motor');
  const revMobil = (hasIwmStsu ? (iwmStsuMap["19"]?.nominal || 0) : (iwmMobil * 6000)) + get3ANominal('Mobil');
  const revBus = (hasIwmStsu ? (iwmStsuMap["17"]?.nominal || 0) + (iwmStsuMap["18"]?.nominal || 0) : ((iwmBusGol1 * 15000) + (iwmBusGol2 * 12500))) + get3ANominal('Bus') + get3ANominal('Truk');

  const qtySepeda = iwmSepeda + get3AQty('Sepeda');
  const qtyMotor = iwmMotor + get3AQty('Motor');
  const qtyMobil = iwmMobil + get3AQty('Mobil');
  const qtyBus = iwmBusGol1 + iwmBusGol2 + get3AQty('Bus') + get3AQty('Truk');

  // Categories list matching PDF exactly
  const stsuRows = [
    { no: 1, name: "Dewasa", desc: "Retribusi Masuk TMR Dewasa" },
    { no: 2, name: "Anak", desc: "Retribusi Masuk TMR Anak" },
    { no: 3, name: "Rombongan Dewasa Reduksi 25%", desc: "Rombongan Dewasa Reduksi 25%" },
    { no: 4, name: "Rombongan Anak Reduksi 25%", desc: "Rombongan Anak Reduksi 25%" },
    { no: 5, name: "Kuda Tunggang", desc: "Wahana Kuda Tunggang" },
    { no: 6, name: "Unta Tunggang", desc: "Wahana Unta Tunggang" },
    { no: 7, name: "Gajah Tunggang", desc: "Wahana Gajah Tunggang" },
    { no: 8, name: "Taman Satwa Anak", desc: "Taman Satwa Anak (TSA)" },
    { no: 9, name: "Hari Selasa-Jum'at Pst Primata-Dewasa", desc: "Pusat Primata - Dewasa Weekday" },
    { no: 10, name: "Hari Selasa-Jum'at Pst Primata-Anak", desc: "Pusat Primata - Anak Weekday" },
    { no: 11, name: "Hari Selasa-Jum'at Pst Primata-Romb Dws Reduksi 25%", desc: "Pusat Primata - Romb Dewasa Reduksi Weekday" },
    { no: 12, name: "Hari Selasa-Jum'at Pst Primata-Romb Anak Reduksi 25%", desc: "Pusat Primata - Romb Anak Reduksi Weekday" },
    { no: 13, name: "Hari Sabtu-Minggu/Besar Pst Primata-Dewasa", desc: "Pusat Primata - Dewasa Weekend/Holiday" },
    { no: 14, name: "Hari Sabtu-Minggu/Besar Pst Primata-Anak", desc: "Pusat Primata - Anak Weekend/Holiday" },
    { no: 15, name: "Hari Sabtu-Minggu/Besar Pst Primata-Romb Anak Reduksi 25%", desc: "Pusat Primata - Romb Anak Reduksi Weekend" },
    { no: 16, name: "Hari Sabtu-Minggu/Besar Pst Primata-Romb Dws Reduksi 25%", desc: "Pusat Primata - Romb Dewasa Reduksi Weekend" },
    { no: 17, name: "Golongan I (Bus Besar, Truk Besar, dan Mobil Box Besar)", desc: "Parkir Roda 6+ (Gol I)" },
    { no: 18, name: "Golongan II (Bus Kecil, Truk Kecil, Mobil Box Kecil dan Pick Up Besar)", desc: "Parkir Roda 4+ Besar (Gol II)" },
    { no: 19, name: "Golongan III (Mobil, Sedan Minibus/Sejenis, Pick up Kecil)", desc: "Parkir Roda 4 (Gol III)" },
    { no: 20, name: "Sepeda Motor dan Kendaraan Roda Tiga", desc: "Parkir Motor (Roda 2/3)" },
    { no: 21, name: "Sepeda", desc: "Parkir Sepeda" }
  ];

  // 3. STSU TABLE (21 ROWS) AGGREGATION
  const currentStsuMap: Record<string, { qty: number; nominal: number }> = {};
  stsuRows.forEach(row => {
    currentStsuMap[row.no.toString()] = { qty: 0, nominal: 0 };
  });

  filteredRecords.forEach(r => {
    const dailyStsu = getStsuMapForRecord(r, stsuChannel);
    Object.keys(dailyStsu).forEach(key => {
      if (currentStsuMap[key]) {
        currentStsuMap[key].qty += dailyStsu[key].qty || 0;
        currentStsuMap[key].nominal += dailyStsu[key].nominal || 0;
      }
    });
  });

  const totalStsuNominal = stsuRows.reduce((sum, row) => {
    const val = currentStsuMap[row.no.toString()]?.nominal || 0;
    return sum + val;
  }, 0);

  const totalStsuQty = stsuRows.reduce((sum, row) => {
    const val = currentStsuMap[row.no.toString()]?.qty || 0;
    return sum + val;
  }, 0);

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Header Panel */}
      <div className="glass-panel flex-between" style={{ padding: '16px 24px', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0, color: '#ffffff' }}>
              DASHBOARD DATA PENDAPATAN
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
              Estimasi dan Transaksi Hasil Retribusi (Payment Date: {rekapPendapatan.tanggal_str})
            </p>
          </div>
          {latestRecord?.stop_for_today && (
            <div style={{ background: '#ef4444', color: 'white', padding: '4px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px', boxShadow: '0 2px 4px rgba(239, 68, 68, 0.4)' }}>
              Ragunan Tutup Hari Ini
            </div>
          )}
        </div>

        {/* Shift Toggle Tabs */}
        <div style={{ display: 'flex', gap: '4px', background: 'rgba(255, 255, 255, 0.05)', padding: '4px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <button 
            className={`btn btn-sm ${shiftTab === 'kumulatif' ? 'btn-primary' : ''}`}
            style={{ 
              padding: '6px 16px', 
              fontSize: '0.85rem', 
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              transition: 'all 0.2s ease',
              ...(shiftTab !== 'kumulatif' && { background: 'transparent', color: 'var(--text-secondary)' })
            }}
            onClick={() => setShiftTab('kumulatif')}
          >
            Kumulatif
          </button>
          <button 
            className={`btn btn-sm ${shiftTab === 'siang' ? 'btn-primary' : ''}`}
            style={{ 
              padding: '6px 16px', 
              fontSize: '0.85rem', 
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              transition: 'all 0.2s ease',
              ...(shiftTab !== 'siang' && { background: 'transparent', color: 'var(--text-secondary)' })
            }}
            onClick={() => setShiftTab('siang')}
          >
            Siang
          </button>
          <button 
            className={`btn btn-sm ${shiftTab === 'malam' ? 'btn-primary' : ''}`}
            style={{ 
              padding: '6px 16px', 
              fontSize: '0.85rem', 
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              transition: 'all 0.2s ease',
              ...(shiftTab !== 'malam' && { background: 'transparent', color: 'var(--text-secondary)' })
            }}
            onClick={() => setShiftTab('malam')}
          >
            Malam
          </button>
        </div>
      </div>

      {/* Date Range Selector Panel */}
      <div className="glass-panel" style={{ padding: '16px 24px', display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Tanggal Mulai</span>
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{
                background: 'rgba(0, 0, 0, 0.2)',
                border: '1px solid var(--panel-border)',
                borderRadius: '6px',
                padding: '6px 12px',
                color: '#ffffff',
                fontSize: '0.9rem',
                outline: 'none'
              }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Tanggal Selesai</span>
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{
                background: 'rgba(0, 0, 0, 0.2)',
                border: '1px solid var(--panel-border)',
                borderRadius: '6px',
                padding: '6px 12px',
                color: '#ffffff',
                fontSize: '0.9rem',
                outline: 'none'
              }}
            />
          </div>
        </div>

        {/* Quick selection shortcuts */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button 
            className="btn btn-sm"
            style={{ padding: '6px 12px', fontSize: '0.8rem', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
            onClick={() => {
              const latest = data[0]?.date || new Date().toISOString().split('T')[0];
              setStartDate(latest);
              setEndDate(latest);
            }}
          >
            Hari Terbaru
          </button>
          <button 
            className="btn btn-sm"
            style={{ padding: '6px 12px', fontSize: '0.8rem', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
            onClick={() => {
              if (data.length > 0) {
                const dates = data.map(d => d.date).sort();
                setStartDate(dates[0]);
                setEndDate(dates[dates.length - 1]);
              }
            }}
          >
            Semua Tanggal
          </button>
        </div>
      </div>

      {filteredRecords.length === 0 ? (
        <div className="glass-panel" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <DollarSign size={48} style={{ margin: '0 auto 16px auto', display: 'block', opacity: 0.3 }} />
          <h3 style={{ color: '#ffffff', marginBottom: '8px' }}>Tidak Ada Data</h3>
          <p>Tidak ada rekaman transaksi yang ditemukan pada rentang tanggal yang dipilih.</p>
        </div>
      ) : (
        <>
      <div className="metrics-grid">
        {/* Total revenue */}
        <div className="glass-panel" style={{ display: 'flex', gap: '16px', alignItems: 'center', borderLeft: '4px solid #10b981' }}>
          <div style={{ padding: '12px', background: 'rgba(16, 185, 129, 0.12)', borderRadius: '12px' }}>
            <DollarSign size={28} style={{ color: '#10b981' }} />
          </div>
          <div>
            <h4 style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 500 }}>ESTIMASI TOTAL PENDAPATAN</h4>
            <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#ffffff', marginTop: '2px' }}>{formatIDR(totalEstimatedRevenue)}</div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '2px' }}>Kombinasi Tiket 3A + IWM Perlokasi</p>
          </div>
        </div>

        {/* Online (3A) */}
        <div className="glass-panel" style={{ display: 'flex', gap: '16px', alignItems: 'center', borderLeft: '4px solid #06b6d4' }}>
          <div style={{ padding: '12px', background: 'rgba(6, 182, 212, 0.12)', borderRadius: '12px' }}>
            <CreditCard size={28} style={{ color: '#06b6d4' }} />
          </div>
          <div>
            <h4 style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 500 }}>TRANSAKSI ONLINE (3A CMS)</h4>
            <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#ffffff', marginTop: '2px' }}>{formatIDR(online3ARevenue)}</div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '2px' }}>Dana Masuk Bank Rekening 3A Paid Today</p>
          </div>
        </div>

        {/* Offline (IWM) */}
        <div className="glass-panel" style={{ display: 'flex', gap: '16px', alignItems: 'center', borderLeft: '4px solid #f59e0b' }}>
          <div style={{ padding: '12px', background: 'rgba(245, 158, 11, 0.12)', borderRadius: '12px' }}>
            <Building size={28} style={{ color: '#f59e0b' }} />
          </div>
          <div>
            <h4 style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 500 }}>TUNAI LOKAL (IWM GATEWAY)</h4>
            <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#ffffff', marginTop: '2px' }}>{formatIDR(offlineIWMRevenue)}</div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '2px' }}>Hasil Penjualan Cash Loket Pintu Today</p>
          </div>
        </div>
      </div>

      {/* Grid of Categories */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
        
        {/* Regular Entry Card */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h4 style={{ color: '#a5b4fc', fontSize: '0.9rem', margin: 0, fontWeight: 600 }}>RETRIBUSI MASUK UTAMA</h4>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Dewasa ({formatNumber(qtyDewasa)} org)</span>
            <span style={{ fontWeight: 600, color: '#ffffff' }}>{formatIDR(revDewasa)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Anak ({formatNumber(qtyAnak)} org)</span>
            <span style={{ fontWeight: 600, color: '#ffffff' }}>{formatIDR(revAnak)}</span>
          </div>
          <div style={{ marginTop: 'auto', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#a5b4fc' }}>
            <span>Subtotal</span>
            <span>{formatIDR(revDewasa + revAnak)}</span>
          </div>
        </div>

        {/* Wahana Card */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h4 style={{ color: '#6ee7b7', fontSize: '0.9rem', margin: 0, fontWeight: 600 }}>WAHANA & ATRAKSI</h4>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Taman Satwa Anak ({formatNumber(qtyTSA)} org)</span>
            <span style={{ fontWeight: 600, color: '#ffffff' }}>{formatIDR(revTSA)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Boogy Car ({formatNumber(qtyBoogy)} unit)</span>
            <span style={{ fontWeight: 600, color: '#ffffff' }}>{formatIDR(revBoogy)}</span>
          </div>
          <div style={{ marginTop: 'auto', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#6ee7b7' }}>
            <span>Subtotal</span>
            <span>{formatIDR(revTSA + revBoogy)}</span>
          </div>
        </div>

        {/* Schmutzer Card */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h4 style={{ color: '#ffd97d', fontSize: '0.9rem', margin: 0, fontWeight: 600 }}>PUSAT PRIMATA SCHMUTZER</h4>
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>PPS Tiket ({formatNumber(qtyPPS)} lembar)</span>
            <span style={{ fontWeight: 600, color: '#ffffff' }}>{formatIDR(revPPS)}</span>
          </div>
          <div style={{ marginTop: 'auto', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#ffd97d' }}>
            <span>Subtotal</span>
            <span>{formatIDR(revPPS)}</span>
          </div>
        </div>

        {/* Vehicle Card */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <h4 style={{ color: '#fca5a5', fontSize: '0.9rem', margin: '0 0 4px 0', fontWeight: 600 }}>RETRIBUSI TEMPAT PARKIR</h4>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '4px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Sepeda ({formatNumber(qtySepeda)} unit)</span>
            <span style={{ fontWeight: 500, fontSize: '0.85rem', color: '#ffffff' }}>{formatIDR(revSepeda)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '4px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Motor ({formatNumber(qtyMotor)} unit)</span>
            <span style={{ fontWeight: 500, fontSize: '0.85rem', color: '#ffffff' }}>{formatIDR(revMotor)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '4px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Mobil ({formatNumber(qtyMobil)} unit)</span>
            <span style={{ fontWeight: 500, fontSize: '0.85rem', color: '#ffffff' }}>{formatIDR(revMobil)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Bus/Truk ({formatNumber(qtyBus)} unit)</span>
            <span style={{ fontWeight: 500, fontSize: '0.85rem', color: '#ffffff' }}>{formatIDR(revBus)}</span>
          </div>
          <div style={{ marginTop: 'auto', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#fca5a5' }}>
            <span>Subtotal</span>
            <span>{formatIDR(revSepeda + revMotor + revMobil + revBus)}</span>
          </div>
        </div>

      </div>

      {/* STSU report section */}
      <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* Header with channel switch */}
        <div className="flex-between" style={{ flexWrap: 'wrap', gap: '16px' }}>
          <div className="gap-12">
            <FileText size={22} style={{ color: '#6366f1' }} />
            <h3 style={{ margin: 0 }}>Surat Tanda Setor Uang (STSU) - Sistem 3A</h3>
          </div>

          <div style={{ display: 'flex', gap: '4px', background: 'rgba(255, 255, 255, 0.05)', padding: '4px', borderRadius: '8px' }}>
            <button 
              className={`btn btn-sm ${stsuChannel === 'MERCHANT_PAGE' ? 'btn-primary' : ''}`}
              style={{ padding: '6px 12px', fontSize: '0.8rem' }}
              onClick={() => setStsuChannel('MERCHANT_PAGE')}
            >
              Tiket Online
            </button>
            <button 
              className={`btn btn-sm ${stsuChannel === 'TVM' ? 'btn-primary' : ''}`}
              style={{ padding: '6px 12px', fontSize: '0.8rem' }}
              onClick={() => setStsuChannel('TVM')}
            >
              TVM (Vending)
            </button>
            <button 
              className={`btn btn-sm ${stsuChannel === 'GATE' ? 'btn-primary' : ''}`}
              style={{ padding: '6px 12px', fontSize: '0.8rem' }}
              onClick={() => setStsuChannel('GATE')}
            >
              New Gate
            </button>
            <button 
              className={`btn btn-sm ${stsuChannel === 'IWM' ? 'btn-primary' : ''}`}
              style={{ padding: '6px 12px', fontSize: '0.8rem' }}
              onClick={() => setStsuChannel('IWM')}
            >
              IWM (Old Gate)
            </button>
          </div>
        </div>

        {/* STSU Form Render */}
        <div style={{
          background: 'rgba(15, 23, 42, 0.8)',
          border: '1px solid var(--panel-border)',
          borderRadius: '12px',
          padding: '24px',
          fontFamily: 'monospace',
          color: '#e2e8f0',
          boxShadow: 'inset 0 4px 12px rgba(0,0,0,0.5)',
          overflowX: 'auto'
        }}>
          
          {/* Header text */}
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid rgba(255,255,255,0.1)', paddingBottom: '16px', marginBottom: '16px' }}>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '1rem', color: '#ffffff' }}>BLUD TAMAN MARGASATWA RAGUNAN</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>PROVINSI DKI JAKARTA - INDONESIA</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 'bold', fontSize: '1rem', color: '#ffffff' }}>SURAT TANDA SETOR UANG (STSU)</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                DASAR HASIL RETRIBUSI {stsuChannel === 'MERCHANT_PAGE' ? 'ONLINE (TIKET ONLINE)' : stsuChannel === 'TVM' ? 'ONLINE (TICKET VENDING MACHINE)' : stsuChannel === 'GATE' ? 'ONLINE (NEW GATE)' : 'TUNAI (IWM OLD GATE)'}
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '16px', fontSize: '0.9rem' }}>
            <strong>Tanggal Rekon:</strong> {latestRecord ? new Date(latestRecord.date).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : '-'}
          </div>

          {/* STSU Table */}
          {latestRecord && Object.keys(currentStsuMap).length > 0 ? (
            <div className="table-wrapper" style={{ boxShadow: 'none', background: 'transparent' }}>
              <table style={{ minWidth: '700px', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.2)', color: '#ffffff' }}>
                    <th style={{ textAlign: 'center', width: '50px', padding: '8px 4px' }}>NO</th>
                    <th style={{ textAlign: 'left', padding: '8px 8px' }}>URAIAN RETRIBUSI</th>
                    <th style={{ textAlign: 'right', width: '100px', padding: '8px 8px' }}>QTY</th>
                    <th style={{ textAlign: 'right', width: '180px', padding: '8px 8px' }}>NOMINAL (RP)</th>
                  </tr>
                </thead>
                <tbody>
                  
                  {/* Category 1 header */}
                  <tr style={{ fontWeight: 'bold', color: '#a5b4fc' }}>
                    <td colSpan={4} style={{ padding: '8px 0 4px 0' }}>4.1.02 Pendapatan Retribusi Daerah</td>
                  </tr>
                  <tr style={{ fontWeight: 'bold', color: '#818cf8' }}>
                    <td colSpan={4} style={{ padding: '2px 0 6px 12px', fontSize: '0.85rem' }}>4.1.02.02.009.00001 Retribusi Pelayanan Tempat Rekreasi, Pariwisata, dan Olahraga</td>
                  </tr>

                  {/* TMR & PPS Items */}
                  {stsuRows.slice(0, 16).map(row => {
                    const val = currentStsuMap[row.no.toString()] || { qty: 0, nominal: 0 };
                    return (
                      <tr key={row.no} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', opacity: val.qty > 0 ? 1 : 0.45 }}>
                        <td style={{ textAlign: 'center', padding: '6px 4px' }}>{row.no}</td>
                        <td style={{ padding: '6px 8px', paddingLeft: '24px' }}>{row.name} <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>({row.desc})</span></td>
                        <td style={{ textAlign: 'right', padding: '6px 8px', fontWeight: val.qty > 0 ? 'bold' : 'normal' }}>{formatNumber(val.qty)}</td>
                        <td style={{ textAlign: 'right', padding: '6px 8px', color: val.nominal > 0 ? '#34d399' : '#9ca3af', fontWeight: val.nominal > 0 ? 'bold' : 'normal' }}>{val.nominal > 0 ? formatNumber(val.nominal) : '-'}</td>
                      </tr>
                    );
                  })}

                  {/* Category 2 header */}
                  <tr style={{ fontWeight: 'bold', color: '#fca5a5' }}>
                    <td colSpan={4} style={{ padding: '12px 0 6px 0' }}>4.1.02.02.014.00001 Retribusi Penyediaan Tempat Parkir Di Luar Badan Jalan</td>
                  </tr>

                  {/* Vehicle Items */}
                  {stsuRows.slice(16, 21).map(row => {
                    const val = currentStsuMap[row.no.toString()] || { qty: 0, nominal: 0 };
                    return (
                      <tr key={row.no} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', opacity: val.qty > 0 ? 1 : 0.45 }}>
                        <td style={{ textAlign: 'center', padding: '6px 4px' }}>{row.no}</td>
                        <td style={{ padding: '6px 8px', paddingLeft: '24px' }}>{row.name}</td>
                        <td style={{ textAlign: 'right', padding: '6px 8px', fontWeight: val.qty > 0 ? 'bold' : 'normal' }}>{formatNumber(val.qty)}</td>
                        <td style={{ textAlign: 'right', padding: '6px 8px', color: val.nominal > 0 ? '#34d399' : '#9ca3af', fontWeight: val.nominal > 0 ? 'bold' : 'normal' }}>{val.nominal > 0 ? formatNumber(val.nominal) : '-'}</td>
                      </tr>
                    );
                  })}

                  {/* Divider */}
                  <tr style={{ borderBottom: '2px solid rgba(255,255,255,0.2)' }}>
                    <td colSpan={4} style={{ padding: '4px' }}></td>
                  </tr>

                  {/* Summary row */}
                  <tr style={{ fontWeight: 'bold', fontSize: '1rem', color: '#ffffff' }}>
                    <td></td>
                    <td style={{ padding: '12px 8px', textAlign: 'center' }}>JUMLAH TOTAL RETRIBUSI (STSU)</td>
                    <td style={{ textAlign: 'right', padding: '12px 8px', borderBottom: '1px double #ffffff' }}>{formatNumber(totalStsuQty)}</td>
                    <td style={{ textAlign: 'right', padding: '12px 8px', color: '#34d399', borderBottom: '1px double #ffffff' }}>{formatIDR(totalStsuNominal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
              Tidak ada data STSU yang terekam untuk channel dan shift ini.
            </div>
          )}

          {/* Terbilang */}
          {totalStsuNominal > 0 && (
            <div style={{ marginTop: '20px', padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', fontSize: '0.9rem' }}>
              <strong>Terbilang:</strong> <span style={{ color: '#ffd97d', fontStyle: 'italic' }}>"{generateTerbilang(totalStsuNominal)}"</span>
            </div>
          )}

          {/* Signature widget */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', marginTop: '36px', fontSize: '0.85rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <div>
              <div>Kepala Seksi Pelayanan dan Informasi</div>
              <div style={{ height: '60px' }}></div>
              <div style={{ fontWeight: 'bold', color: '#ffffff' }}>Afriana Pulungan, S.Si., M.AP.</div>
              <div>NIP 197304212007012021</div>
            </div>
            <div>
              <div>Jakarta, {latestRecord ? new Date(latestRecord.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}</div>
              <div style={{ fontWeight: 'bold', color: '#ffffff', marginTop: '2px' }}>Bendahara Penerimaan</div>
              <div style={{ height: '60px' }}></div>
              <div style={{ fontWeight: 'bold', color: '#ffffff' }}>Evi Irmawati</div>
              <div>NIP 198101082009042006</div>
            </div>
          </div>

        </div>

      </div>
      
      </>)}

    </div>
  );
};
