import { useDb } from '@/api/hooks'
import { dashboard } from '@/domain/dashboard'
import { PARAMS } from '@/domain/params'
import { Guard, PageShell } from '@/components/woms'

// Bảng điều hành của quản lý (Dashboard cơ bản TV7-10..12). Chỉ số tính bằng cùng hàm @woms/domain/dashboard
// mà API GET /reports/dashboard dùng, nên giao diện và báo cáo khớp nhau (TC-057).
export function Dashboard() {
  return (
    <Guard page='dashboard'>
      <Inner />
    </Guard>
  )
}

const pct = (v: number | null) => (v === null ? '—' : `${Math.round(v * 100)}%`)

function Kpi({ label, value, tone, hint }: { label: string; value: React.ReactNode; tone?: 'bad' | 'warn'; hint?: string }) {
  return (
    <div className='bg-card rounded-lg border p-4' data-testid={`kpi-${label}`}>
      <div className='text-muted-foreground text-xs'>{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${tone === 'bad' ? 'text-red-600 dark:text-red-400' : tone === 'warn' ? 'text-amber-600 dark:text-amber-400' : ''}`}>{value}</div>
      {hint && <div className='text-muted-foreground mt-1 text-xs'>{hint}</div>}
    </div>
  )
}

function Inner() {
  const db = useDb()
  const k = dashboard(db, Date.now(), PARAMS.minStock)
  const maxStage = Math.max(1, ...k.byStage.map((s) => s.count))
  return (
    <PageShell title='Bảng điều hành' description='Tình hình xử lý phiếu, thời hạn và tải công việc. Thời hạn tính theo giờ làm việc 08:00–17:30, Thứ 2 – Thứ 7, trừ ngày lễ.'>
      <div className='grid grid-cols-2 gap-3 md:grid-cols-4'>
        <Kpi label='Phiếu đang xử lý' value={k.openCases} />
        <Kpi label='Quá hạn' value={k.sla.overdue + k.sla.pickup_late} tone={k.sla.overdue ? 'bad' : undefined} hint='gồm phiếu chờ nhận quá 30 ngày' />
        <Kpi label='Sắp quá hạn' value={k.sla.soon} tone={k.sla.soon ? 'warn' : undefined} hint='còn ≤ 4 giờ làm việc' />
        <Kpi label='Chờ quản lý duyệt' value={k.pendingApprovals} />
        <Kpi label='Tỷ lệ đúng hạn' value={pct(k.onTimeRate)} hint='phiếu đã QC đạt, so với hạn 3 ngày' />
        <Kpi label='Tỷ lệ sửa lại' value={pct(k.reworkRate)} hint='phiếu có ít nhất 1 lần QC không đạt' />
        <Kpi label='Thời gian sửa TB' value={k.avgRepairHours === null ? '—' : `${k.avgRepairHours} giờ`} hint='từ xác nhận phương án tới sẵn sàng bàn giao' />
        <Kpi label='Đã hoàn tất' value={k.completedCases} hint={`${k.cancelledCases} phiếu đã hủy`} />
      </div>
      <div className='mt-4 grid gap-4 lg:grid-cols-2'>
        <section className='bg-card rounded-lg border p-4'>
          <h2 className='mb-3 text-sm font-semibold'>Phiếu đang mở theo giai đoạn</h2>
          {k.byStage.map((s) => (
            <div key={s.label} className='mb-2 grid grid-cols-[9rem_1fr_2rem] items-center gap-3 text-sm'>
              <span className='text-muted-foreground'>{s.label}</span>
              <span className='bg-muted h-2 overflow-hidden rounded'>
                <span className='bg-primary block h-full' style={{ width: `${(s.count / maxStage) * 100}%` }} />
              </span>
              <span className='text-right tabular-nums'>{s.count}</span>
            </div>
          ))}
        </section>
        <section className='bg-card rounded-lg border p-4'>
          <h2 className='mb-3 text-sm font-semibold'>Tải kỹ thuật viên</h2>
          <table className='w-full text-sm'>
            <thead>
              <tr className='text-muted-foreground text-left text-xs'>
                <th className='pb-2 font-medium'>Kỹ thuật viên</th>
                <th className='pb-2 text-right font-medium'>Đang làm</th>
                <th className='pb-2 text-right font-medium'>Đã xong</th>
              </tr>
            </thead>
            <tbody>
              {k.byTechnician.map((t) => (
                <tr key={t.id} className='border-t'>
                  <td className='py-1.5'>{t.name}</td>
                  <td className={`py-1.5 text-right tabular-nums ${t.open > PARAMS.technicianOverload ? 'font-semibold text-red-600' : ''}`}>{t.open}</td>
                  <td className='py-1.5 text-right tabular-nums'>{t.done}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h2 className='mt-5 mb-2 text-sm font-semibold'>Linh kiện dưới mức tồn tối thiểu ({PARAMS.minStock})</h2>
          {k.lowStockParts.length === 0 ? (
            <p className='text-muted-foreground text-sm'>Không có.</p>
          ) : (
            <ul className='text-sm'>
              {k.lowStockParts.map((p) => (
                <li key={p.sku} className='flex justify-between border-t py-1.5'>
                  <span>
                    {p.name} <span className='text-muted-foreground'>({p.sku})</span>
                  </span>
                  <span className='tabular-nums'>{p.available}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </PageShell>
  )
}
