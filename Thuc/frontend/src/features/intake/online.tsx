import { useDb } from '@/api/hooks'
import { fmtDateTime } from '@/domain/format'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CaseLink, Empty, Guard, PageShell } from '@/components/woms'

// S-21 Yêu cầu khách gửi từ Customer Portal (DRAFT → PENDING_ACCEPT), chờ mang máy tới.
export function OnlineRequests() {
  return (
    <Guard page='online'>
      <Inner />
    </Guard>
  )
}

function Inner() {
  const db = useDb()
  const rows = db.cases.filter((c) => c.status === 'PENDING_ACCEPT').sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  return (
    <PageShell title='Yêu cầu trực tuyến' description='Khách gửi qua Customer Portal. Khi khách mang máy tới, mở phiếu và chọn "Nhận máy, lập biên nhận".'>
      <div className='overflow-x-auto rounded-lg border'>
        {rows.length === 0 ? (
          <Empty>Không có yêu cầu nào đang chờ khách mang máy tới.</Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Phiếu</TableHead>
                <TableHead>Khách hàng</TableHead>
                <TableHead>Thiết bị</TableHead>
                <TableHead>Lỗi khách báo</TableHead>
                <TableHead>Gửi lúc</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => {
                const cu = db.customers.find((x) => x.id === c.customerId)!
                const d = db.devices.find((x) => x.id === c.deviceId)!
                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      <CaseLink c={c} />
                    </TableCell>
                    <TableCell>
                      {cu.name}
                      <div className='text-muted-foreground text-xs'>{cu.phone}</div>
                    </TableCell>
                    <TableCell>
                      {d.brand} {d.model}
                    </TableCell>
                    <TableCell className='max-w-80 whitespace-normal'>{c.symptom}</TableCell>
                    <TableCell className='whitespace-nowrap'>{fmtDateTime(c.createdAt)}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </PageShell>
  )
}
