import React, { useState } from 'react';
import type { DailyRecord } from '../types';
import { Printer } from 'lucide-react';

interface DashboardProps {
  data: DailyRecord[];
}

const ITEMS_TMR = [
  "Dewasa", "Anak", "Rombongan Dewasa Reduksi 25%", "Rombongan Anak Reduksi 25%",
  "Kuda Tunggang", "Unta Tunggang", "Gajah Tunggang", "Taman Satwa Anak",
  "Hari Selasa-Jum'at Pst Primata-Dewasa", "Hari Selasa-Jum'at Pst Primata-Anak",
  "Hari Selasa-Jum'at Pst Primata-Romb Dws Reduksi 25%", "Hari Selasa-Jum'at Pst Primata-Romb Anak Reduksi 25%",
  "Hari Sabtu-Minggu/Besar Pst Primata-Dewasa", "Hari Sabtu-Minggu/Besar Pst Primata-Anak",
  "Hari Sabtu-Minggu/Besar Pst Primata-Romb Anak Reduksi 25%", "Hari Sabtu-Minggu/Besar Pst Primata-Romb Dws Reduksi 25%"
];

const ITEMS_PARKIR = [
  "Golongan I (Bus Besar, Truk Besar, dan Mobil Box Besar)",
  "Golongan II (Bus Kecil, Truk Kecil, Mobil Box Kecil dan Pick Up Besar)",
  "Golongan III (Mobil, Sedan Minibus/Sejenis, Pick up Kecil)",
  "Sepeda Motor dan Kendaraan Roda Tiga",
  "Sepeda"
];

function terbilang(angka: number): string {
  angka = Math.floor(angka);
  const huruf = ["", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan", "sepuluh", "sebelas"];
  if (angka < 12) return huruf[angka];
  if (angka < 20) return terbilang(angka - 10) + " belas";
  if (angka < 100) return terbilang(Math.floor(angka / 10)) + " puluh " + terbilang(angka % 10);
  if (angka < 200) return "seratus " + terbilang(angka - 100);
  if (angka < 1000) return terbilang(Math.floor(angka / 100)) + " ratus " + terbilang(angka % 100);
  if (angka < 2000) return "seribu " + terbilang(angka - 1000);
  if (angka < 1000000) return terbilang(Math.floor(angka / 1000)) + " ribu " + terbilang(angka % 1000);
  if (angka < 1000000000) return terbilang(Math.floor(angka / 1000000)) + " juta " + terbilang(angka % 1000000);
  if (angka < 1000000000000) return terbilang(Math.floor(angka / 1000000000)) + " miliar " + terbilang(angka % 1000000000);
  return "";
}

function generate_terbilang(nominal: number): string {
  if (nominal === 0) return "Nol rupiah.-";
  let text = terbilang(nominal).trim();
  text = text.charAt(0).toUpperCase() + text.slice(1) + " rupiah.-";
  return text.replace(/\s+/g, ' ');
}

export const Dashboard: React.FC<DashboardProps> = ({ data }) => {
  const [activeChannel, setActiveChannel] = useState<string>('GATE');
  const [selectedDate, setSelectedDate] = useState<string>('');

  React.useEffect(() => {
    if (data && data.length > 0 && !selectedDate) {
      setSelectedDate(data[0].date);
    }
  }, [data, selectedDate]);

  const activeRecord = selectedDate ? data.find(r => r.date === selectedDate) : data[0];
  const latestRecord = activeRecord || null;
  
  const raw3a = (latestRecord?.siang as any)?.raw_3a || {};
  const rawIwm = (latestRecord?.siang as any)?.raw_iwm || {};
  
  const dateStr = latestRecord?.date || new Date().toISOString().split('T')[0];
  const dateObj = new Date(dateStr);
  const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;

  const bulanIndo = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const tglCetak = `${dateObj.getDate()} ${bulanIndo[dateObj.getMonth()]} ${dateObj.getFullYear()}`;
  
  const noUrutStsu = `      /${String(dateObj.getDate()).padStart(2, '0')}/${String(dateObj.getMonth() + 1).padStart(2, '0')}/SU/${dateObj.getFullYear()}`;

  const formatNum = (num: number) => {
    if (!num || num === 0) return '-';
    return new Intl.NumberFormat('id-ID').format(num);
  };

  const handlePrint = () => {
    window.print();
  };

  // Convert IWM Data into STSU format!
  const getIWMAsSTSU = () => {
      const iwm = rawIwm || {};
      const stsu: any = {};
      for (let i = 1; i <= 21; i++) stsu[String(i)] = { nominal: 0, qty: 0 };

      // 1. Dewasa & Anak (Area Lainnya)
      stsu["1"].nominal = iwm?.area_lainnya?.dewasa || 0;
      stsu["2"].nominal = iwm?.area_lainnya?.anak || 0;

      // 8. Taman Satwa Anak (Children Zoo)
      stsu["8"].nominal = iwm?.children_zoo?.total || 0;

      // 9-16. Pusat Primata
      const primataDewasa = iwm?.pusat_primata?.dewasa || 0;
      const primataAnak = iwm?.pusat_primata?.anak || 0;
      
      if (isWeekend) {
          stsu["13"].nominal = primataDewasa; // Sabtu-Minggu Pst Primata-Dewasa
          stsu["14"].nominal = primataAnak;   // Sabtu-Minggu Pst Primata-Anak
      } else {
          stsu["9"].nominal = primataDewasa;  // Selasa-Jum'at Pst Primata-Dewasa
          stsu["10"].nominal = primataAnak;   // Selasa-Jum'at Pst Primata-Anak
      }

      // Kendaraan
      stsu["17"].nominal = iwm?.area_lainnya?.gol_i || 0;
      stsu["18"].nominal = iwm?.area_lainnya?.gol_ii || 0;
      stsu["19"].nominal = iwm?.area_lainnya?.gol_iii || 0;
      stsu["20"].nominal = iwm?.area_lainnya?.motor || 0;
      stsu["21"].nominal = iwm?.area_lainnya?.sepeda || 0;

      // Laporan Diskon / Rombongan
      if (iwm?.laporan_diskon && Array.isArray(iwm.laporan_diskon)) {
          iwm.laporan_diskon.forEach((r: any) => {
             // Masukkan ke Rombongan Dewasa Reduksi 25%
             stsu["3"].nominal += (r.pendapatan_rp || 0);
          });
      }

      return stsu;
  };

  let channelDisplay = activeChannel;
  if (activeChannel === "MERCHANT_PAGE") channelDisplay = "TIKET ONLINE";
  if (activeChannel === "TVM") channelDisplay = "TICKET VENDING MACHINE";
  if (activeChannel === "GATE") channelDisplay = "NEW GATE";
  if (activeChannel === "IWM") channelDisplay = "OLD GATE (IWM)";



  const renderSTSU = () => {

    const stsuData = activeChannel === "IWM" ? getIWMAsSTSU() : (raw3a[activeChannel] || {});
    let totalNominal = 0;
    
    for (let i = 1; i <= 21; i++) {
        totalNominal += (stsuData[String(i)]?.nominal || 0);
    }

    return (
      <div className="report-paper stsu-paper" style={{ fontFamily: 'Arial, sans-serif', padding: '40px 60px', color: '#000', backgroundColor: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', fontWeight: 'bold', fontSize: '13px', color: '#000' }}>
            <div style={{ lineHeight: '1.4' }}>
                <div>BLUD TAMAN MARGASATWA</div>
                <div>RAGUNAN PROV.DKI JAKARTA</div>
            </div>
            <div style={{ textAlign: 'right', lineHeight: '1.4' }}>
                <div>SURAT TANDA SETOR UANG</div>
                <div>DASAR HASIL RETRIBUSI</div>
                <div>{channelDisplay}</div>
            </div>
        </div>
        
        <div style={{ marginBottom: '15px', fontSize: '13px', color: '#000' }}>
            <div style={{ display: 'flex' }}>
                <div style={{ width: '30px' }}>No</div>
                <div style={{ width: '10px' }}>:</div>
                <div>{noUrutStsu}</div>
            </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', color: '#000' }}>
            <thead>
                <tr>
                    <th colSpan={4} style={{ borderTop: '1px dashed #000', padding: '0' }}></th>
                </tr>
                <tr>
                    <th style={{ width: '8%', padding: '4px', textAlign: 'center', fontWeight: 'normal', color: '#000' }}>NO</th>
                    <th style={{ width: '62%', padding: '4px', textAlign: 'center', fontWeight: 'normal', color: '#000' }}>URAIAN</th>
                    <th colSpan={2} style={{ width: '30%', padding: '4px', textAlign: 'center', fontWeight: 'normal', color: '#000' }}>JUMLAH</th>
                </tr>
                <tr>
                    <th colSpan={4} style={{ borderBottom: '1px dashed #000', padding: '0' }}></th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td colSpan={4} style={{ fontWeight: 'bold', padding: '8px 4px 4px 4px', color: '#000' }}>
                        <div>4.1.02 Pendapatan Retribusi Daerah</div>
                        <div>4.1.02.02.009.00001 Retribusi Pelayanan Tempat Rekreasi, Pariwisata, dan Olahraga</div>
                    </td>
                </tr>
                {ITEMS_TMR.map((item, idx) => {
                    const i = idx + 1;
                    const nominal = stsuData[String(i)]?.nominal || 0;
                    return (
                        <tr key={i}>
                            <td style={{ textAlign: 'center', padding: '3px 4px', color: '#000' }}>{i}.</td>
                            <td style={{ padding: '3px 4px', color: '#000' }}>{item}</td>
                            <td style={{ width: '5%', padding: '3px 4px', color: '#000' }}>Rp.</td>
                            <td style={{ textAlign: 'right', padding: '3px 15px 3px 4px', color: '#000' }}>{formatNum(nominal)}</td>
                        </tr>
                    );
                })}
                
                <tr>
                    <td colSpan={4} style={{ fontWeight: 'bold', padding: '12px 4px 4px 4px', color: '#000' }}>
                        <div>4.1.02.02.014.00001 Retribusi Penyediaan Tempat Khusus Parkir Di Luar Badan Jalan</div>
                    </td>
                </tr>
                {ITEMS_PARKIR.map((item, idx) => {
                    const i = idx + 17;
                    const nominal = stsuData[String(i)]?.nominal || 0;
                    return (
                        <tr key={i}>
                            <td style={{ textAlign: 'center', padding: '3px 4px', color: '#000' }}>{i}.</td>
                            <td style={{ padding: '3px 4px', color: '#000' }}>{item}</td>
                            <td style={{ width: '5%', padding: '3px 4px', color: '#000' }}>Rp.</td>
                            <td style={{ textAlign: 'right', padding: '3px 15px 3px 4px', color: '#000' }}>{formatNum(nominal)}</td>
                        </tr>
                    );
                })}

                <tr>
                    <td colSpan={4} style={{ borderTop: '1px dashed #000', padding: '4px' }}></td>
                </tr>
                <tr>
                    <td></td>
                    <td style={{ textAlign: 'center', padding: '4px', fontWeight: 'bold', color: '#000' }}>JUMLAH</td>
                    <td style={{ padding: '4px', color: '#000' }}>Rp.</td>
                    <td style={{ textAlign: 'right', padding: '4px 15px 4px 4px', fontWeight: 'bold', color: '#000' }}>{formatNum(totalNominal)}</td>
                </tr>
                <tr>
                    <td colSpan={4} style={{ borderBottom: '1px dashed #000', padding: '4px' }}></td>
                </tr>
            </tbody>
        </table>

        <div style={{ marginTop: '15px', fontSize: '13px', color: '#000' }}>
            <p>Terbilang : {generate_terbilang(totalNominal)}</p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '80px', marginTop: '35px', fontSize: '13px', textAlign: 'center', color: '#000' }}>
            <div>
                <p style={{ minHeight: '18px' }}></p>
                <p>Kepala Seksi Pelayanan dan Informasi</p>
                <br/><br/><br/><br/>
                <p style={{ textDecoration: 'underline', fontWeight: 'bold' }}>Afriana Pulungan, S.Si., M.AP.</p>
                <p>NIP 197304212007012021</p>
            </div>
            <div>
                <p>Jakarta, {tglCetak}</p>
                <p>Bendahara Penerimaan</p>
                <br/><br/><br/><br/>
                <p style={{ textDecoration: 'underline', fontWeight: 'bold' }}>Evi Irmawati</p>
                <p>NIP 198101082009042006</p>
            </div>
        </div>
      </div>
    );
  };

  return (
    <div className="printable-report-container">
      {/* Control Panel: Hide when printing */}
      <div className="no-print" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '16px', marginBottom: '20px', background: 'var(--panel-bg)', padding: '16px', borderRadius: '12px', border: '1px solid var(--panel-border)' }}>
        
        {/* Row 1: Pilihan Tanggal */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', width: '100%', marginBottom: '8px', paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Tanggal Laporan:</span>
          <select 
            className="input-select"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{ padding: '6px 12px', borderRadius: '6px', minWidth: '200px' }}
          >
            {data.map(r => (
              <option key={r.date} value={r.date}>
                {new Date(r.date).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </option>
            ))}
          </select>
        </div>

        {/* Row 2: Pilihan Channel & Print */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', width: '100%', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginRight: '10px' }}>Pilih Laporan:</span>
          
          <button 
            className={`btn btn-sm`} 
            style={{ background: activeChannel === 'GATE' ? 'var(--primary-gradient)' : 'transparent', color: '#fff', padding: '6px 12px', borderRadius: '6px', border: activeChannel === 'GATE' ? 'none' : '1px solid var(--panel-border)' }} 
            onClick={() => setActiveChannel('GATE')}
          >
            STSU - NEW GATE
          </button>
          <button 
            className={`btn btn-sm`} 
            style={{ background: activeChannel === 'TVM' ? 'var(--primary-gradient)' : 'transparent', color: '#fff', padding: '6px 12px', borderRadius: '6px', border: activeChannel === 'TVM' ? 'none' : '1px solid var(--panel-border)' }} 
            onClick={() => setActiveChannel('TVM')}
          >
            STSU - TVM
          </button>
          <button 
            className={`btn btn-sm`} 
            style={{ background: activeChannel === 'MERCHANT_PAGE' ? 'var(--primary-gradient)' : 'transparent', color: '#fff', padding: '6px 12px', borderRadius: '6px', border: activeChannel === 'MERCHANT_PAGE' ? 'none' : '1px solid var(--panel-border)' }} 
            onClick={() => setActiveChannel('MERCHANT_PAGE')}
          >
            STSU - ONLINE
          </button>
          <button 
            className={`btn btn-sm`} 
            style={{ background: activeChannel === 'MPOS' ? 'var(--primary-gradient)' : 'transparent', color: '#fff', padding: '6px 12px', borderRadius: '6px', border: activeChannel === 'MPOS' ? 'none' : '1px solid var(--panel-border)' }} 
            onClick={() => setActiveChannel('MPOS')}
          >
            STSU - MPOS
          </button>
          <button 
            className={`btn btn-sm`} 
            style={{ background: activeChannel === 'IWM' ? '#06b6d4' : 'transparent', color: '#fff', padding: '6px 12px', borderRadius: '6px', border: activeChannel === 'IWM' ? 'none' : '1px solid var(--panel-border)', marginLeft: '10px' }} 
            onClick={() => setActiveChannel('IWM')}
          >
            STSU - IWM (OLD GATE)
          </button>
          </div>
          <button className="btn" style={{ background: '#10b981', border: 'none', fontWeight: 600 }} onClick={handlePrint}>
            <Printer size={18} style={{ marginRight: '8px' }} /> Cetak Laporan PDF
          </button>
        </div>
      </div>

      {renderSTSU()}
      

    </div>
  );
};
