import { useDb } from '@/api/hooks'
import { CaseLink, Empty, Guard, PageShell, Section, SlaBadge, StatusBadge, useName } from '@/components/woms'
import { WoParts } from './wo-parts'

// S-61 Yêu cầu linh kiện từ các lệnh sửa chữa (UC-09).
export function PartRequests() {
  return (
    <Guard page='partRequests'>
      <Inner />
    </Guard>
  )
}

function Inner() {
  const db = useDb()
  const name = useName()
  const rows = db.workOrders
    .map((w) => ({ w, c: db.cases.find((c) => c.id === w.caseId)! }))
    .filter(({ w, c }) => !['COMPLETED', 'CANCELLED'].includes(c.status) && w.parts.some((p) => p.reserved + p.issued < p.qty || p.reserved > 0 || p.returnPending > 0))
    .sort((a, b) => a.w.createdAt.localeCompare(b.w.createdAt))
  return (
    <PageShell title='Yêu cầu linh kiện' description='Giữ linh kiện khả dụng cho lệnh mới, báo thiếu nếu hết hàng, cấp phát khi kỹ thuật viên nhận, xác nhận nhận lại phần chưa dùng.'>
      {rows.length === 0 ? (
        <Empty className='rounded-lg border'>Không có yêu cầu linh kiện nào cần xử lý.</Empty>
      ) : (
        rows.map(({ w, c }) => (
          <Section
            key={w.id}
            title={
              <span className='flex flex-wrap items-center gap-2'>
                {w.code} <span className='text-muted-foreground font-normal'>·</span> <CaseLink c={c} />
              </span>
            }
            description={`Kỹ thuật viên: ${name(w.technicianId)}`}
            actions={
              <span className='flex items-center gap-2'>
                <StatusBadge status={c.status} />
                <SlaBadge c={c} />
              </span>
            }
          >
            <WoParts wo={w} compact />
          </Section>
        ))
      )}
    </PageShell>
  )
}
