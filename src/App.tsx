import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from './lib/firebase';

import type { DailyRecord } from './types';
import { DashboardPengunjung } from './components/DashboardPengunjung';
import { HourlyHistory } from './components/HourlyHistory';
import { ScraperStatus } from './components/ScraperStatus';
import { 
  Settings, 
  Zap,
  Users,
  Clock
} from 'lucide-react';

function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'riwayat_jam' | 'status'>('dashboard');
  const [records, setRecords] = useState<DailyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const q = query(collection(db, 'daily_records'), orderBy('date', 'desc'), limit(30));
        const snapshot = await getDocs(q);
        
        const fetchedDocs: DailyRecord[] = [];
        snapshot.forEach(doc => {
          fetchedDocs.push(doc.data() as DailyRecord);
        });

        if (fetchedDocs && fetchedDocs.length > 0) {
          setRecords(fetchedDocs);
        }
      } catch (error) {
        console.warn('Firebase fetch failed:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <div className="app-container">
      <header>
        <div className="logo-section">
          <div className="logo-icon">
            <Zap size={22} style={{ color: '#ffffff' }} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0, padding: 0, lineHeight: 1.2 }}>
              TMR SCRAPER
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>
              DATA PENGUNJUNG
            </p>
          </div>
        </div>

        <div className="navigation-tabs">
          <button 
            className={`nav-tab ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <Users size={16} />
            Dashboard Pengunjung
          </button>
          <button 
            className={`nav-tab ${activeTab === 'riwayat_jam' ? 'active' : ''}`}
            onClick={() => setActiveTab('riwayat_jam')}
          >
            <Clock size={16} />
            Riwayat Jam (15 Menit)
          </button>
          <button 
            className={`nav-tab ${activeTab === 'status' ? 'active' : ''}`}
            onClick={() => setActiveTab('status')}
          >
            <Settings size={16} />
            Scraper Otomatis
          </button>
        </div>
      </header>

      <main style={{ minHeight: 'calc(100vh - 200px)', padding: '8px 0' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              border: '3px solid rgba(99, 102, 241, 0.2)',
              borderTopColor: '#6366f1',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }} />
            <style>{`
              @keyframes spin {
                to { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        ) : (
          <>
            {activeTab === 'dashboard' && <DashboardPengunjung data={records} />}
            {activeTab === 'riwayat_jam' && <HourlyHistory data={records} />}
            {activeTab === 'status' && (
              <ScraperStatus data={records} />
            )}
          </>
        )}
      </main>

      <footer style={{ 
        marginTop: 'auto', 
        paddingTop: '24px', 
        borderTop: '1px solid var(--panel-border)', 
        display: 'flex', 
        justifyContent: 'space-between',
        alignItems: 'center',
        color: 'var(--text-muted)',
        fontSize: '0.85rem'
      }}>
        <span>Taman Margasatwa Ragunan © 2026. All rights reserved.</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            display: 'inline-block',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: '#10b981',
            boxShadow: '0 0 8px #10b981'
          }} />
          <span>Live Data (Firebase: tmr-scraper-db)</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
