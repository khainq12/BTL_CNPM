import { useDb, useMe } from '@/api/hooks'
import { fmtDate } from '@/domain/format'
import { CAUSE_LABEL, DEVICE_KIND_LABEL } from '@/domain/rules'
import { Empty, Guard, InfoList, PageShell, Section, useName } from '@/components/woms'
import { CaseTable } from '@/features/cases/list'
import { canSeeCustomer } from '@/features/cases/logic'

// FR-17: lịch sử bảo hành, sửa chữa của một thiết bị (xem nội bộ).
export function DeviceDetail({ id }: { id: string }) {
  return (
    <Guard page='device'>
      <Inner id={id} />
    </Guard>
  )
}

function Inner({ id }: { id: string }) {
  const db = useDb()
  const me = useMe()
  const name = useName()
  const d = db.devices.find((x) => x.id === id)
  if (!d)
    return (
      <PageShell title='Không tìm thấy thiết bị'>
        <Empty className='rounded-lg border'>Thiết bị không tồn tại.</Empty>
      </PageShell>
    )
  const cu = db.customers.find((x) => x.id === d.customerId)!
  const cases = db.cases.filter((c) => c.deviceId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const end = d.purchaseDate ? new Date(Date.parse(d.purchaseDate) + d.warrantyMonths * 30.44 * 86400_000).toISOString() : undefined
  return (
    <PageShell title={`${d.brand} ${d.model}`} description={`Serial ${d.serial}`} crumbs={[{ label: 'Thiết bị' }, { label: d.serial }]}>
      <Section title='Thông tin bảo hành'>
        <InfoList
          rows={[
            ['Loại', DEVICE_KIND_LABEL[d.kind]],
            ['Chủ sở hữu', canSeeCustomer(me) ? cu.name : 'Ẩn theo phân quyền'],
            ['Ngày mua', fmtDate(d.purchaseDate)],
            ['Thời hạn', `${d.warrantyMonths} tháng, hết hạn ${fmtDate(end)}`],
            ['Chính sách', d.policyCode],
          ]}
        />
      </Section>
      <Section title='Các lần tiếp nhận' description='Mỗi lần gửi lại thiết bị là một phiếu riêng, liên kết với thiết bị (BR-29).'>
        {cases.length ? <CaseTable rows={cases} name={name} hideCustomer={!canSeeCustomer(me)} /> : <p className='text-muted-foreground text-sm'>Chưa có.</p>}
      </Section>
      <Section title='Chẩn đoán trước đây'>
        <ul className='grid gap-2 text-sm'>
          {cases.filter((c) => c.diagnosis).map((c) => (
            <li key={c.id}>
              <span className='font-medium'>{c.code}</span>: {CAUSE_LABEL[c.diagnosis!.causeType]}. {c.diagnosis!.cause}
            </li>
          ))}
          {!cases.some((c) => c.diagnosis) && <li className='text-muted-foreground'>Chưa có biên bản chẩn đoán.</li>}
        </ul>
      </Section>
    </PageShell>
  )
}
