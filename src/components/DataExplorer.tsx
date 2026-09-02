import React, { useState } from 'react';
import type { DailyRecord } from '../types';
import { Search, Calendar, Ticket, Map } from 'lucide-react';

interface DataExplorerProps {
  data: DailyRecord[];
}

export const DataExplorer: React.FC<DataExplorerProps> = ({ data }) => {
  const [selectedDate, setSelectedDate] = useState<string>(data[0]?.date || '');
  const [activeSubTab, setActiveSubTab] = useState<'3a' | 'iwm'>('3a');
  const [searchTerm, setSearchTerm] = useState('');

  const formatNumber = (num: number) => new Intl.NumberFormat('id-ID').format(num);
  const formatIDR = (num: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);

  const selectedRecord = data.find(r => r.date === selectedDate);

  if (!data.length) {
    return (
      <div className="glass-panel text-center fade-in">
        <p style={{ color: 'var(--text-secondary)' }}>Tidak ada data yang tersedia.</p>
      </div>
    );
  }

  // Get data tables
  const ticketsSiang = selectedRecord?.siang?.tickets_3a || [];
  const ticketsMalam = selectedRecord?.malam?.tickets_3a || [];
  const iwmSiang = selectedRecord?.siang?.iwm || [];
  const iwmMalam = selectedRecord?.malam?.iwm || [];

  // De-duplicate if siang and malam data are identical (new format)
  const isTicketsIdentical = JSON.stringify(ticketsSiang) === JSON.stringify(ticketsMalam);
  const isIwmIdentical = JSON.stringify(iwmSiang) === JSON.stringify(iwmMalam);

  const allTickets = [
    ...ticketsSiang.map(t => ({ ...t, shift: isTicketsIdentical ? 'Harian' : 'siang' })),
    ...(isTicketsIdentical ? [] : ticketsMalam.map(t => ({ ...t, shift: 'malam' })))
  ];

  const allIWM = [
    ...iwmSiang.map(i => ({ ...i, shift: isIwmIdentical ? 'Harian' : 'siang' })),
    ...(isIwmIdentical ? [] : iwmMalam.map(i => ({ ...i, shift: 'malam' })))
  ];

  // Filters
  const filteredTickets = allTickets.filter(t => 
    t.item?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.kategori?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredIWM = allIWM.filter(i => 
    i.lokasi?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Controls Bar */}
      <div className="glass-panel flex-between" style={{ flexWrap: 'wrap', gap: '16px' }}>
        <div className="gap-12">
          <Calendar size={20} style={{ color: '#6366f1' }} />
          <span style={{ fontWeight: 500 }}>Pilih Tanggal:</span>
          <select 
            className="input-select"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          >
            {data.map(d => (
              <option key={d.date} value={d.date}>
                {new Date(d.date).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </option>
            ))}
          </select>
        </div>

        {/* Search Input */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', color: 'var(--text-secondary)' }} />
          <input 
            type="text"
            placeholder="Cari data..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              background: 'rgba(17, 24, 39, 0.8)',
              border: '1px solid var(--panel-border)',
              borderRadius: '8px',
              padding: '8px 12px 8px 36px',
              color: '#ffffff',
              outline: 'none',
              fontSize: '0.9rem',
              width: '240px'
            }}
          />
        </div>
      </div>

      {/* Main Grid */}
      <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* Toggle Sub Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--panel-border)', paddingBottom: '12px', gap: '8px' }}>
          <button 
            className={`btn ${activeSubTab === '3a' ? 'btn-primary' : ''}`}
            onClick={() => { setActiveSubTab('3a'); setSearchTerm(''); }}
          >
            <Ticket size={18} />
            Data Tiket 3A CMS
          </button>
          <button 
            className={`btn ${activeSubTab === 'iwm' ? 'btn-primary' : ''}`}
            onClick={() => { setActiveSubTab('iwm'); setSearchTerm(''); }}
          >
            <Map size={18} />
            Data Pendapatan IWM
          </button>
        </div>

        {/* Table 3A */}
        {activeSubTab === '3a' && (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Shift</th>
                  <th>Nama Item / Tiket</th>
                  <th>Kategori</th>
                  <th style={{ textAlign: 'right' }}>Qty</th>
                  <th style={{ textAlign: 'right' }}>Total Pembayaran</th>
                </tr>
              </thead>
              <tbody>
                {filteredTickets.length > 0 ? (
                  filteredTickets.map((t, idx) => (
                    <tr key={idx}>
                      <td>
                        <span className={`badge badge-${t.shift}`}>{t.shift}</span>
                      </td>
                      <td style={{ fontWeight: 500 }}>{t.item}</td>
                      <td>{t.kategori}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatNumber(t.qty)}</td>
                      <td style={{ textAlign: 'right', color: '#10b981', fontWeight: 600 }}>{formatIDR(t.total)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                      Tidak ada data tiket yang cocok.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Table IWM */}
        {activeSubTab === 'iwm' && (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Shift</th>
                  <th>Lokasi / Pintu</th>
                  <th style={{ textAlign: 'right' }}>Karcis Anak</th>
                  <th style={{ textAlign: 'right' }}>Karcis Dewasa</th>
                  <th style={{ textAlign: 'right' }}>Gol I</th>
                  <th style={{ textAlign: 'right' }}>Gol II</th>
                  <th style={{ textAlign: 'right' }}>Gol III</th>
                  <th style={{ textAlign: 'right' }}>Motor</th>
                  <th style={{ textAlign: 'right' }}>Sepeda</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {filteredIWM.length > 0 ? (
                  filteredIWM.map((i, idx) => {
                    const anak = i.karcis_anak !== undefined ? i.karcis_anak : (i.karcis_masuk || 0);
                    const dewasa = i.karcis_dewasa !== undefined ? i.karcis_dewasa : (i.harga_satuan || 0);
                    const gol1 = i.parkir_gol_1 !== undefined ? i.parkir_gol_1 : (i.potongan || 0);
                    const gol2 = i.parkir_gol_2 !== undefined ? i.parkir_gol_2 : (i.netto || 0);
                    const gol3 = i.parkir_gol_3 !== undefined ? i.parkir_gol_3 : (i.admin || 0);
                    const motor = i.parkir_motor !== undefined ? i.parkir_motor : (i.lain_lain || 0);
                    const sepeda = i.parkir_sepeda !== undefined ? i.parkir_sepeda : 0;
                    const total = i.total || 0;

                    return (
                      <tr key={idx}>
                        <td>
                          <span className={`badge badge-${i.shift}`}>{i.shift}</span>
                        </td>
                        <td style={{ fontWeight: 500 }}>{i.lokasi}</td>
                        <td style={{ textAlign: 'right' }}>{formatNumber(anak)}</td>
                        <td style={{ textAlign: 'right' }}>{formatNumber(dewasa)}</td>
                        <td style={{ textAlign: 'right' }}>{formatNumber(gol1)}</td>
                        <td style={{ textAlign: 'right' }}>{formatNumber(gol2)}</td>
                        <td style={{ textAlign: 'right' }}>{formatNumber(gol3)}</td>
                        <td style={{ textAlign: 'right' }}>{formatNumber(motor)}</td>
                        <td style={{ textAlign: 'right' }}>{formatNumber(sepeda)}</td>
                        <td style={{ textAlign: 'right', color: '#10b981', fontWeight: 600 }}>{formatNumber(total)}</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={10} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                      Tidak ada data IWM yang cocok.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};
