import { useEffect, useState } from 'react';
import { toInputValue } from './format';
import DashboardPage from './pages/DashboardPage';
import PortalPage from './pages/PortalPage';
import SlaPage from './pages/SlaPage';
import { StoreProvider, useStore } from './store';

const TABS = [
  { id: 'portal', label: 'Cổng khách hàng' },
  { id: 'sla', label: 'Theo dõi SLA' },
  { id: 'dash', label: 'Dashboard' },
] as const;
type TabId = (typeof TABS)[number]['id'];

const readHash = (): TabId => {
  const h = location.hash.slice(1);
  return (TABS.find((t) => t.id === h)?.id ?? 'portal') as TabId;
};

function Shell() {
  const { now, setNow } = useStore();
  const [tab, setTab] = useState<TabId>(readHash);
  useEffect(() => {
    const f = () => setTab(readHash());
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);

  return (
    <>
      <header>
        <b>WOMS</b>
        <nav>
          {TABS.map((t) => <a key={t.id} href={`#${t.id}`} className={tab === t.id ? 'on' : ''}>{t.label}</a>)}
        </nav>
        <div className="clock">
          <label className="inline">Giờ hệ thống mẫu
            <input type="datetime-local" value={toInputValue(now)}
              onChange={(e) => { const v = new Date(e.target.value).getTime(); if (!isNaN(v)) setNow(v); }} />
          </label>
          <button className="btn s" onClick={() => setNow(now + 3_600_000)}>+1 giờ</button>
          <button className="btn s" onClick={() => setNow(now + 86_400_000)}>+1 ngày</button>
        </div>
      </header>
      <main>
        {tab === 'portal' && <PortalPage />}
        {tab === 'sla' && <SlaPage />}
        {tab === 'dash' && <DashboardPage />}
      </main>
    </>
  );
}

export default function App() {
  return <StoreProvider><Shell /></StoreProvider>;
}
