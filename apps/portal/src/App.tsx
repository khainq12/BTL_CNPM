import { useEffect, useState } from 'react'
import { isDemo } from './api'
import Lookup from './pages/Lookup'
import Request from './pages/Request'

const TABS = [
  { id: 'tra-cuu', label: 'Tra cứu tiến độ' },
  { id: 'gui-yeu-cau', label: 'Gửi yêu cầu bảo hành' },
] as const
type TabId = (typeof TABS)[number]['id']

const readHash = (): TabId => (TABS.find((t) => t.id === location.hash.slice(1))?.id ?? 'tra-cuu') as TabId

export default function App() {
  const [tab, setTab] = useState<TabId>(readHash)
  useEffect(() => {
    const f = () => setTab(readHash())
    window.addEventListener('hashchange', f)
    return () => window.removeEventListener('hashchange', f)
  }, [])

  return (
    <>
      <header>
        <b>WOMS</b>
        <span className="sub">Cổng khách hàng bảo hành</span>
        <nav aria-label="Chức năng">
          {TABS.map((t) => (
            <a key={t.id} href={`#${t.id}`} className={tab === t.id ? 'on' : ''} aria-current={tab === t.id ? 'page' : undefined}>
              {t.label}
            </a>
          ))}
        </nav>
        {isDemo && <span className="b wn">Bản thử</span>}
      </header>
      <main>
        {tab === 'tra-cuu' && <Lookup />}
        {tab === 'gui-yeu-cau' && <Request />}
        <p className="mut foot">
          <small>Giờ làm việc 08:00–17:30, Thứ Hai – Thứ Bảy (trừ ngày lễ). Thời hạn sửa chữa 3 ngày làm việc kể từ khi trung tâm xác nhận phương án.</small>
        </p>
      </main>
    </>
  )
}
