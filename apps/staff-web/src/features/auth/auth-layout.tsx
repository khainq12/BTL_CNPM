import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { STAGES } from '@/domain/statuses'
import { BrandMark } from '@/components/brand-mark'

// Trang đăng nhập: bên trái là tấm tem bảo hành vẽ 8 bước một phiếu đi qua (lấy từ cấu hình trạng thái),
// bên phải là biểu mẫu. Màn hình hẹp chỉ giữ phần biểu mẫu.
const SHOWN = 5 // bước minh họa đang làm: "Sửa chữa"

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className='bg-background grid min-h-svh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]'>
      <aside className='bg-sidebar text-sidebar-foreground relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-10 xl:p-14'>
        <Brand />
        <div className='grid gap-10'>
          <h1 className='max-w-md text-3xl leading-tight font-semibold tracking-tight text-balance text-white xl:text-4xl'>Theo dõi mỗi thiết bị từ lúc nhận máy đến lúc trả khách.</h1>
          <ServiceTag />
        </div>
        <p className='text-sidebar-foreground/70 max-w-sm text-sm'>Giao diện nội bộ cho nhân viên tiếp nhận, CSKH, điều phối, kỹ thuật, kho, kiểm tra chất lượng và quản lý.</p>
      </aside>

      <main className='flex items-center justify-center p-4 sm:p-8'>
        <div className='flex w-full max-w-sm flex-col gap-6'>
          <div className='lg:hidden'>
            <Brand compact />
          </div>
          {children}
        </div>
      </main>
    </div>
  )
}

function Brand({ compact }: { compact?: boolean }) {
  return (
    <div className='flex items-center gap-3'>
      <div className={cn('flex size-10 items-center justify-center rounded-lg', compact ? 'bg-sidebar text-sidebar-primary' : 'bg-sidebar-primary text-sidebar-primary-foreground')}>
        <BrandMark className='size-6' />
      </div>
      <div>
        <p className={cn('font-semibold tracking-wide', !compact && 'text-white')}>WOMS</p>
        <p className={cn('text-sm', compact ? 'text-muted-foreground' : 'text-sidebar-foreground/80')}>Hệ thống quản lý hoạt động bảo hành</p>
      </div>
    </div>
  )
}

// Tấm tem treo: đầu vát, có lỗ xỏ dây. Đường ray chạy dọc các bước, phần đã qua hiện dần khi mở trang.
function ServiceTag() {
  const last = STAGES.length - 1
  return (
    <div className='relative w-80 -rotate-2 pt-10' aria-hidden>
      <span className='bg-sidebar-foreground/30 absolute top-0 left-1/2 h-12 w-px -translate-x-1/2' />
      <div className='bg-sidebar-accent relative px-7 pt-10 pb-7 shadow-[0_24px_48px_-20px_rgb(0_0_0/0.6)] [clip-path:polygon(22%_0,78%_0,100%_10%,100%_100%,0_100%,0_10%)]'>
        <span className='bg-sidebar ring-sidebar-foreground/25 absolute top-4 left-1/2 size-3.5 -translate-x-1/2 rounded-full ring-2' />
        <p className='text-sidebar-foreground/70 mb-4 text-xs font-medium'>Hành trình của một phiếu</p>
        <ol className='relative grid gap-3'>
          <span className='bg-sidebar-foreground/15 absolute top-2 bottom-2 left-[7px] w-0.5' />
          <span
            className='bg-sidebar-primary absolute top-2 left-[7px] w-0.5 origin-top motion-safe:animate-[woms-track_1.4s_ease-out_both]'
            style={{ height: `calc((100% - 1rem) * ${SHOWN / last})` }}
          />
          {STAGES.map((s, i) => {
            const done = i < SHOWN
            const cur = i === SHOWN
            return (
              <li key={s.label} className='relative flex items-center gap-3 text-[15px]'>
                <span
                  className={cn(
                    'relative z-10 flex size-4 items-center justify-center rounded-full',
                    done && 'bg-sidebar-primary text-sidebar-primary-foreground motion-safe:animate-[woms-dot_.4s_ease-out_both]',
                    cur && 'bg-sidebar-accent ring-sidebar-primary ring-2 motion-safe:animate-[woms-dot_.4s_ease-out_both]',
                    !done && !cur && 'bg-sidebar-accent ring-sidebar-foreground/30 ring-1'
                  )}
                  style={done || cur ? { animationDelay: `${i * 0.17}s` } : undefined}
                >
                  {done && <Check className='size-2.5' strokeWidth={4} />}
                  {cur && <span className='bg-sidebar-primary size-1.5 rounded-full' />}
                </span>
                <span className={cn(cur ? 'font-semibold text-white' : done ? 'text-sidebar-foreground' : 'text-sidebar-foreground/50')}>{s.label}</span>
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}
