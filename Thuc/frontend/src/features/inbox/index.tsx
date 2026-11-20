import { Link } from '@tanstack/react-router'
import { useDb, useMe } from '@/api/hooks'
import { fmtDateTime } from '@/domain/format'
import { PARAMS } from '@/domain/params'
import { ROLE_LABEL } from '@/domain/roles'
import { shortageNeedsAction } from '@/domain/parts'
import { openPause, SLA_RANK, slaInfo, waitingForParts } from '@/domain/sla'
import type { WarrantyCase } from '@/domain/types'
import { canSeeCustomer } from '@/features/cases/logic'
import { openChange } from '@/domain/plan-change'
import { Button } from '@/components/ui/button'
import { CaseLink, Empty, PageShell, Pill, SlaBadge, StatusBadge } from '@/components/woms'

type Queue = { title: string; hint?: string; rows: WarrantyCase[]; empty: string; link?: { to: string; label: string } }

const DAY = 86400_000
const since = (iso?: string) => (iso ? Math.floor((Date.now() - Date.parse(iso)) / DAY) : 0)
const lastEventAt = (c: WarrantyCase) => c.events.at(-1)?.at ?? c.createdAt

export function Inbox() {
  const db = useDb()
  const me = useMe()
  const wo = (c: WarrantyCase) => db.workOrders.find((w) => w.id === c.workOrderId)
  const by = (...s: WarrantyCase['status'][]) => db.cases.filter((c) => s.includes(c.status))
  const urgent = db.cases.filter((c) => ['overdue', 'soon', 'pickup_late'].includes(slaInfo(c).kind))
  const q: Queue[] = []

  switch (me.role) {
    case 'TN':
      q.push(
        { title: 'Yêu cầu trực tuyến chờ nhận máy', rows: by('PENDING_ACCEPT'), empty: 'Không có yêu cầu trực tuyến nào đang chờ.', link: { to: '/tiep-nhan/online', label: 'Mở danh sách' } },
        { title: 'Thiết bị chờ bàn giao', rows: by('READY_FOR_DELIVERY'), empty: 'Chưa có thiết bị nào sẵn sàng trả khách.' },
        { title: 'Phiếu tôi tiếp nhận hôm nay', rows: db.cases.filter((c) => c.receivedBy === me.id && since(c.receivedAt) === 0), empty: 'Hôm nay bạn chưa tạo phiếu nào.', link: { to: '/tiep-nhan/moi', label: 'Tạo phiếu' } }
      )
      break
    case 'CSKH':
      q.push(
        { title: 'Cần kiểm tra bảo hành sơ bộ', rows: by('RECEIVED'), empty: 'Không có phiếu mới cần kiểm tra.' },
        { title: 'Cần kết luận bảo hành', hint: 'Đã có biên bản chẩn đoán hoặc quyết định của quản lý.', rows: by('ELIGIBILITY_REVIEW'), empty: 'Không có phiếu chờ kết luận.' },
        { title: 'Đổi phương án khi đang sửa', hint: 'Kỹ thuật viên đề xuất, cần xét lại bảo hành và báo giá (BR-12).', rows: db.cases.filter((c) => ['CHO_CSKH', 'CHO_GUI', 'CHO_KHACH'].includes(openChange(c)?.status ?? '')), empty: 'Không có đề xuất đổi phương án.' },
        { title: 'Chờ khách xác nhận báo giá', hint: `Quá ${PARAMS.quoteWaitDays} ngày làm việc chưa phản hồi thì gọi lại khách (PARAM-04).`, rows: by('QUOTED'), empty: 'Không có báo giá đang chờ.' },
        { title: 'Chờ khách bổ sung thông tin', rows: by('WAITING_INFORMATION'), empty: 'Không có phiếu chờ bổ sung.' },
        { title: 'Chuẩn bị trả không sửa', rows: by('RETURN_PENDING'), empty: 'Không có phiếu cần kết luận trả máy.' },
        { title: `Thiết bị chưa được nhận quá ${PARAMS.pickupHoldDays} ngày`, rows: by('READY_FOR_DELIVERY').filter((c) => since(c.readyAt) > PARAMS.pickupHoldDays), empty: 'Không có thiết bị tồn quá hạn lưu giữ.' }
      )
      break
    case 'DP':
      q.push(
        { title: 'Chờ giao kỹ thuật viên chẩn đoán', rows: by('PRECHECK'), empty: 'Không có phiếu chờ giao chẩn đoán.', link: { to: '/dieu-phoi', label: 'Bảng điều phối' } },
        { title: 'Sẵn sàng sửa, chờ phân công', rows: by('READY_TO_REPAIR'), empty: 'Không có lệnh sửa chữa chờ phân công.', link: { to: '/dieu-phoi', label: 'Bảng điều phối' } },
        { title: 'Đang chờ xác nhận đổi phương án', hint: 'Kỹ thuật viên tạm ngừng cho tới khi CSKH và khách xác nhận (BR-12).', rows: db.cases.filter((c) => !!openChange(c)), empty: 'Không có lệnh đang chờ đổi phương án.' },
        { title: 'Sắp quá hạn và quá hạn', hint: 'Cảnh báo khi còn 4 giờ làm việc (PARAM-09).', rows: urgent, empty: 'Không có phiếu nào sắp quá hạn.' },
        { title: `Chờ linh kiện quá ${PARAMS.partWaitWarnDays} ngày`, rows: db.cases.filter((c) => waitingForParts(c) && since(openPause(c, 'CHO_LINH_KIEN')?.start) >= PARAMS.partWaitWarnDays), empty: 'Không có lệnh chờ linh kiện quá lâu.' }
      )
      break
    case 'KTV':
      q.push(
        { title: 'Cần chẩn đoán', rows: by('DIAGNOSING').filter((c) => c.diagnosisTechId === me.id), empty: 'Không có thiết bị chờ bạn chẩn đoán.' },
        { title: 'Sửa lại theo kết quả QC', rows: by('REWORK').filter((c) => wo(c)?.technicianId === me.id), empty: 'Không có việc sửa lại.' },
        { title: 'Đang sửa', rows: by('IN_REPAIR').filter((c) => wo(c)?.technicianId === me.id), empty: 'Không có việc đang sửa.' },
        { title: 'Được giao, chưa bắt đầu', rows: by('ASSIGNED').filter((c) => wo(c)?.technicianId === me.id), empty: 'Không có việc mới được giao.' }
      )
      break
    case 'KHO':
      q.push(
        {
          title: 'Lệnh sửa chữa cần chuẩn bị linh kiện',
          hint: 'Giữ hàng có sẵn, hoặc báo thiếu phần chưa có đề nghị mua. Gồm cả linh kiện bổ sung khi đổi phương án (BR-12).',
          rows: db.cases.filter((c) => c.status === 'WO_CREATED' || (['WAITING_PARTS', 'IN_REPAIR'].includes(c.status) && !!wo(c) && shortageNeedsAction(db, wo(c)!))),
          empty: 'Không có lệnh cần chuẩn bị linh kiện.',
          link: { to: '/kho/yeu-cau', label: 'Yêu cầu linh kiện' },
        },
        {
          title: 'Đang chờ linh kiện về',
          rows: db.cases.filter((c) => waitingForParts(c) && !(wo(c) && shortageNeedsAction(db, wo(c)!))),
          empty: 'Không có lệnh chờ linh kiện.',
          link: { to: '/kho/nhap', label: 'Nhập kho' },
        },
        { title: 'Cần cấp phát hoặc nhận lại', rows: db.cases.filter((c) => wo(c)?.parts.some((p) => p.reserved > 0 || p.returnPending > 0)), empty: 'Không có linh kiện chờ cấp phát hoặc trả.' }
      )
      break
    case 'QC':
      q.push({ title: 'Chờ kiểm tra chất lượng', rows: by('TESTING'), empty: 'Không có thiết bị chờ kiểm tra.' })
      break
    case 'QL':
      q.push(
        { title: 'Quản lý xem xét sau sửa lại', hint: 'Không đạt QC sau 2 lần sửa lại (BR-22).', rows: by('MANAGER_REVIEW'), empty: 'Không có phiếu cần quyết định.', link: { to: '/phe-duyet', label: 'Phê duyệt' } },
        { title: 'Chờ quản lý duyệt', rows: by('WAITING_APPROVAL'), empty: 'Không có đề nghị trên phiếu.', link: { to: '/phe-duyet', label: 'Phê duyệt' } },
        { title: 'Sắp quá hạn và quá hạn', rows: urgent, empty: 'Không có phiếu nào sắp quá hạn.' }
      )
      break
  }

  const pendingApprovals = db.approvals.filter((a) => a.status === 'CHO_DUYET' && !a.caseId).length
  const lowStock = db.parts.filter((p) => p.onHand - p.reserved < PARAMS.minStock).length

  return (
    <PageShell title='Hộp việc' description={`${me.name} · ${ROLE_LABEL[me.role]}. Việc được sắp theo mức gấp của thời hạn.`}>
      {me.role === 'QL' && pendingApprovals > 0 && (
        <Notice>
          Có {pendingApprovals} đề nghị về kho chờ duyệt (mua linh kiện, điều chỉnh tồn).{' '}
          <Link to='/phe-duyet' className='font-medium underline underline-offset-4'>
            Mở phê duyệt
          </Link>
        </Notice>
      )}
      {me.role === 'KHO' && lowStock > 0 && (
        <Notice>
          {lowStock} mã linh kiện dưới mức tồn tối thiểu {PARAMS.minStock} (PARAM-06).{' '}
          <Link to='/kho' className='font-medium underline underline-offset-4'>
            Xem tồn kho
          </Link>
        </Notice>
      )}
      <div className='grid gap-6'>
        {q.map((x) => (
          <QueueBlock key={x.title} q={x} showCustomer={canSeeCustomer(me)} />
        ))}
      </div>
    </PageShell>
  )
}

function Notice({ children }: { children: React.ReactNode }) {
  return <div className='rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm dark:border-amber-800 dark:bg-amber-950'>{children}</div>
}

function QueueBlock({ q, showCustomer }: { q: Queue; showCustomer: boolean }) {
  const db = useDb()
  const rows = [...q.rows].sort((a, b) => SLA_RANK[slaInfo(a).kind] - SLA_RANK[slaInfo(b).kind] || lastEventAt(a).localeCompare(lastEventAt(b)))
  return (
    <section aria-label={q.title}>
      <div className='mb-2 flex flex-wrap items-baseline justify-between gap-2'>
        <h2 className='font-semibold'>
          {q.title} <span className='text-muted-foreground font-normal tabular-nums'>({rows.length})</span>
        </h2>
        {q.link && (
          <Button asChild variant='link' size='sm' className='h-auto p-0'>
            <Link to={q.link.to}>{q.link.label}</Link>
          </Button>
        )}
      </div>
      {q.hint && <p className='text-muted-foreground -mt-1 mb-2 text-sm'>{q.hint}</p>}
      <div className='bg-card divide-y rounded-lg border'>
        {rows.length === 0 ? (
          <Empty className='py-6'>{q.empty}</Empty>
        ) : (
          rows.map((c) => {
            const cu = db.customers.find((x) => x.id === c.customerId)!
            const d = db.devices.find((x) => x.id === c.deviceId)!
            return (
              <div key={c.id} className='flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm'>
                <div className='w-44'>
                  <CaseLink c={c} />
                </div>
                <div className='min-w-48 flex-1'>
                  {d.brand} {d.model}
                  {showCustomer && <span className='text-muted-foreground'> · {cu.name}</span>}
                </div>
                <StatusBadge status={c.status} />
                <SlaBadge c={c} />
                {c.status === 'QUOTED' && since(c.quotes.at(-1)?.sentAt) >= PARAMS.quoteWaitDays && <Pill tone='wait'>Gọi lại khách</Pill>}
                <span className='text-muted-foreground w-36 text-right text-xs'>Cập nhật {fmtDateTime(lastEventAt(c))}</span>
              </div>
            )
          })
        )}
      </div>
    </section>
  )
}
