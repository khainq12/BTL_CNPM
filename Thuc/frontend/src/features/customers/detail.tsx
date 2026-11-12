import { Link } from '@tanstack/react-router'
import { useDb } from '@/api/hooks'
import { DEVICE_KIND_LABEL } from '@/domain/rules'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Empty, Guard, InfoList, PageShell, Section, useName } from '@/components/woms'
import { CaseTable } from '@/features/cases/list'

export function CustomerDetail({ id }: { id: string }) {
  return (
    <Guard page='customers'>
      <Inner id={id} />
    </Guard>
  )
}

function Inner({ id }: { id: string }) {
  const db = useDb()
  const name = useName()
  const c = db.customers.find((x) => x.id === id)
  if (!c)
    return (
      <PageShell title='Không tìm thấy khách hàng' crumbs={[{ label: 'Khách hàng', to: '/khach-hang' }]}>
        <Empty className='rounded-lg border'>Hồ sơ khách không tồn tại.</Empty>
      </PageShell>
    )
  const devices = db.devices.filter((d) => d.customerId === id)
  const cases = db.cases.filter((k) => k.customerId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return (
    <PageShell title={c.name} crumbs={[{ label: 'Khách hàng', to: '/khach-hang' }, { label: c.name }]}>
      <Section title='Liên hệ'>
        <InfoList rows={[['Điện thoại', c.phone], ['Email', c.email]]} />
      </Section>
      <Section title='Thiết bị'>
        {devices.length === 0 ? (
          <p className='text-muted-foreground text-sm'>Chưa có thiết bị.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Thiết bị</TableHead>
                <TableHead>Serial</TableHead>
                <TableHead>Loại</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {devices.map((d) => (
                <TableRow key={d.id}>
                  <TableCell>
                    <Link to='/thiet-bi/$id' params={{ id: d.id }} className='font-medium underline-offset-4 hover:underline'>
                      {d.brand} {d.model}
                    </Link>
                  </TableCell>
                  <TableCell className='font-mono'>{d.serial}</TableCell>
                  <TableCell>{DEVICE_KIND_LABEL[d.kind]}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Section>
      <Section title='Các phiếu bảo hành'>
        {cases.length ? <CaseTable rows={cases} name={name} hideCustomer /> : <p className='text-muted-foreground text-sm'>Chưa có phiếu.</p>}
      </Section>
    </PageShell>
  )
}
