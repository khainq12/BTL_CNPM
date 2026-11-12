import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { useAction, useDb, useMe } from '@/api/hooks'
import * as api from '@/api/service'
import { PARAMS } from '@/domain/params'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { SubmitButton } from '@/components/form-kit'
import { Empty, Guard, InfoList, PageShell, Section } from '@/components/woms'

const DOW = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7']
const dow = (iso: string) => DOW[new Date(`${iso}T00:00:00Z`).getUTCDay()]
const fmt = (iso: string) => iso.split('-').reverse().join('/')

// Lịch làm việc dùng để tính hạn xử lý (mục 6.3: "cần lưu ... lịch làm việc"). Chỉ quản lý sửa.
export function WorkCalendar() {
  return (
    <Guard page='calendar'>
      <Inner />
    </Guard>
  )
}

function Inner() {
  const db = useDb()
  const me = useMe()
  const [date, setDate] = useState('')
  const [name, setName] = useState('')
  const add = useAction(api.addHoliday, { success: 'Đã thêm ngày nghỉ' })
  const remove = useAction(api.removeHoliday, { success: 'Đã xóa ngày nghỉ' })
  const year = new Date().getFullYear()
  const [showPast, setShowPast] = useState(false)
  const today = new Date().toISOString().slice(0, 10)
  const rows = db.holidays.filter((h) => showPast || h.date >= today)

  return (
    <PageShell title='Lịch làm việc' description='Hạn xử lý chỉ tính trong giờ làm việc. Ngày nghỉ lễ khai báo ở đây không được tính vào hạn.'>
      <div className='grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start'>
        <Section
          title='Ngày nghỉ lễ'
          description='Thay đổi áp dụng ngay cho mọi phiếu đang tính hạn, kể cả phiếu đã mở trước đó.'
          actions={
            <Button variant='link' size='sm' className='h-auto p-0' onClick={() => setShowPast(!showPast)}>
              {showPast ? 'Ẩn ngày đã qua' : 'Hiện cả ngày đã qua'}
            </Button>
          }
        >
          <form
            className='mb-4 flex flex-wrap items-end gap-2'
            onSubmit={(e) => {
              e.preventDefault()
              add.mutate([me, date, name], { onSuccess: () => (setDate(''), setName('')) })
            }}
          >
            <label className='grid gap-1.5 text-sm font-medium'>
              Ngày
              <Input type='date' value={date} min={`${year - 1}-01-01`} onChange={(e) => setDate(e.target.value)} className='w-44' required />
            </label>
            <label className='grid min-w-48 flex-1 gap-1.5 text-sm font-medium'>
              Tên ngày nghỉ
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder='Tết Nguyên đán' required />
            </label>
            <SubmitButton type='submit' pending={add.isPending}>
              Thêm
            </SubmitButton>
          </form>
          {rows.length === 0 ? (
            <Empty className='rounded-lg border'>{showPast ? 'Chưa khai báo ngày nghỉ nào.' : 'Chưa có ngày nghỉ sắp tới. Thêm khi có thông báo nghỉ lễ.'}</Empty>
          ) : (
            <div className='overflow-x-auto rounded-lg border'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ngày</TableHead>
                    <TableHead>Thứ</TableHead>
                    <TableHead>Tên</TableHead>
                    <TableHead className='w-12'>
                      <span className='sr-only'>Xóa</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((h) => (
                    <TableRow key={h.date} className={h.date < today ? 'text-muted-foreground' : undefined}>
                      <TableCell className='tabular-nums'>{fmt(h.date)}</TableCell>
                      <TableCell>{dow(h.date)}</TableCell>
                      <TableCell>{h.name}</TableCell>
                      <TableCell>
                        <Button
                          variant='ghost'
                          size='icon'
                          aria-label={`Xóa ngày nghỉ ${fmt(h.date)}`}
                          disabled={remove.isPending}
                          onClick={() => {
                            if (confirm(`Xóa ngày nghỉ ${fmt(h.date)} (${h.name})? Hạn của các phiếu đang mở sẽ được tính lại.`)) remove.mutate([me, h.date])
                          }}
                        >
                          <Trash2 />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Section>

        <div className='grid gap-4'>
          <Section title='Giờ làm việc'>
            <InfoList
              rows={[
                ['Ngày làm việc', 'Thứ 2 – Thứ 7'],
                ['Giờ', '08:00 – 17:30 (giờ Việt Nam)'],
                ['Một ngày tính', '9,5 giờ làm việc'],
              ]}
            />
            <p className='text-muted-foreground mt-3 text-xs'>Giờ làm việc lấy theo NFR-04. Đổi giờ làm việc cần sửa cấu hình hệ thống.</p>
          </Section>
          <Section title='Tham số thời hạn'>
            <InfoList
              rows={[
                ['Hạn sửa chữa', `${PARAMS.repairSlaDays} ngày làm việc (PARAM-08)`],
                ['Cảnh báo sắp quá hạn', `Còn ${PARAMS.warnBeforeMinutes / 60} giờ làm việc (PARAM-09)`],
                ['Tạm dừng chờ báo giá', `Tối đa ${PARAMS.pauseQuoteMaxDays} ngày làm việc (PARAM-16)`],
                ['Tạm dừng chờ linh kiện', `Tối đa ${PARAMS.pausePartsMaxDays} ngày làm việc (PARAM-17)`],
                ['Lưu giữ chờ khách nhận', `${PARAMS.pickupHoldDays} ngày (PARAM-05)`],
              ]}
            />
          </Section>
        </div>
      </div>
    </PageShell>
  )
}
