import { fmtMoney } from '@/domain/format'
import type { Quote } from '@/domain/types'
import { cn } from '@/lib/utils'

// Bảng báo giá chỉ đọc, dùng chung cho thẻ "Bảo hành và báo giá" và các hộp thoại gửi/duyệt báo giá.
export function QuoteLines({
  items,
  labor,
  total,
  className,
}: {
  items: Quote['items']
  labor: number
  total: number
  className?: string
}) {
  return (
    // Màn hẹp: bảng cuộn ngang thay vì bóp cột Hạng mục.
    <div className={cn('overflow-x-auto', className)}>
      <table className='w-full min-w-[26rem] text-sm'>
        <thead>
          <tr className='border-b text-xs text-muted-foreground'>
            <th className='py-1.5 text-start font-medium'>Hạng mục</th>
            <th className='w-12 py-1.5 text-end font-medium'>SL</th>
            <th className='w-28 py-1.5 text-end font-medium'>Đơn giá</th>
            <th className='w-32 py-1.5 text-end font-medium'>Thành tiền</th>
          </tr>
        </thead>
        <tbody>
          {items.map((i, k) => (
            <tr key={k} className='border-b'>
              <td className='py-1.5'>{i.label}</td>
              <td className='py-1.5 text-end tabular-nums'>{i.qty}</td>
              <td className='py-1.5 text-end tabular-nums'>
                {fmtMoney(i.unitPrice)}
              </td>
              <td className='py-1.5 text-end tabular-nums'>
                {fmtMoney(i.qty * i.unitPrice)}
              </td>
            </tr>
          ))}
          <tr className='border-b'>
            <td className='py-1.5' colSpan={3}>
              Tiền công
            </td>
            <td className='py-1.5 text-end tabular-nums'>{fmtMoney(labor)}</td>
          </tr>
          <tr>
            <td className='py-1.5 font-semibold' colSpan={3}>
              Tổng
            </td>
            <td className='py-1.5 text-end font-semibold tabular-nums'>
              {fmtMoney(total)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
