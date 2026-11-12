import { useDb, useMe } from '@/api/hooks'
import { Empty, Guard, PageShell, useName } from '@/components/woms'
import { CaseTable } from '@/features/cases/list'
import { canSeeCustomer } from '@/features/cases/logic'

// S-70 Hàng chờ kiểm tra chất lượng.
export function QcQueue() {
  return (
    <Guard page='qcQueue'>
      <Qc />
    </Guard>
  )
}

function Qc() {
  const db = useDb()
  const name = useName()
  const rows = db.cases.filter((c) => c.status === 'TESTING')
  return (
    <PageShell title='Chờ kiểm tra chất lượng' description='Mở phiếu và chọn "Kiểm tra chất lượng". Người kiểm tra phải khác người sửa.'>
      <div className='overflow-x-auto rounded-lg border'>{rows.length ? <CaseTable rows={rows} name={name} hideCustomer /> : <Empty>Không có thiết bị chờ kiểm tra.</Empty>}</div>
    </PageShell>
  )
}

// S-80 Danh sách chờ bàn giao (và chuẩn bị trả không sửa cho CSKH).
export function HandoverQueue() {
  return (
    <Guard page='handoverQueue'>
      <Handover />
    </Guard>
  )
}

function Handover() {
  const db = useDb()
  const me = useMe()
  const name = useName()
  const ready = db.cases.filter((c) => c.status === 'READY_FOR_DELIVERY')
  const ret = db.cases.filter((c) => c.status === 'RETURN_PENDING')
  return (
    <PageShell title='Chờ bàn giao' description='Thiết bị đã đạt QC hoặc có kết luận trả không sửa. Quá 30 ngày chưa nhận thì báo CSKH và quản lý (PARAM-05).'>
      <div className='overflow-x-auto rounded-lg border'>{ready.length ? <CaseTable rows={ready} name={name} hideCustomer={!canSeeCustomer(me)} /> : <Empty>Chưa có thiết bị nào chờ bàn giao.</Empty>}</div>
      {me.role === 'CSKH' && (
        <>
          <h2 className='font-semibold'>Chuẩn bị trả không sửa ({ret.length})</h2>
          <div className='overflow-x-auto rounded-lg border'>{ret.length ? <CaseTable rows={ret} name={name} /> : <Empty>Không có.</Empty>}</div>
        </>
      )}
    </PageShell>
  )
}
