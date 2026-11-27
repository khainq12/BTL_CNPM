import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { STAGES } from '@/domain/statuses'
import { BrandMark } from '@/components/brand-mark'
import { ThemeSwitch } from '@/components/theme-switch'

// Trang đăng nhập: bên trái là tấm tem bảo hành vẽ 8 bước một phiếu đi qua (lấy từ cấu hình trạng thái),
// bên phải là biểu mẫu. Màn hình hẹp chỉ giữ phần biểu mẫu.
const SHOWN = 5 // bước minh họa đang làm: "Sửa chữa"

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className='bg-background grid min-h-svh lg:grid-cols-[minmax(0,1.02fr)_minmax(0,1fr)]'>
      <aside className='bg-sidebar text-sidebar-foreground lg:border-sidebar-border/60 relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:border-r lg:p-10 xl:p-14'>
        {/* Lớp chiều sâu tinh tế: lưới chấm kỹ thuật mờ dần và ánh sáng xanh ngọc nhẹ sau tấm tem */}
        <div className='pointer-events-none absolute inset-0' aria-hidden>
          <div className='absolute inset-0 bg-[radial-gradient(rgb(255_255_255/0.06)_1px,transparent_1px)] [background-size:20px_20px] [mask-image:radial-gradient(ellipse_70%_70%_at_35%_55%,black,transparent)]' />
          <div className='absolute inset-0 bg-[radial-gradient(circle_at_28%_58%,rgb(43_179_165/0.14),transparent_58%)]' />
        </div>

        <div className='relative z-10'>
          <Brand />
        </div>

        <div className='relative z-10 grid gap-8'>
          <h1 className='max-w-md text-3xl leading-[1.18] font-semibold tracking-[-0.02em] text-balance text-white xl:text-4xl'>
            Theo dõi mỗi thiết bị từ lúc nhận máy đến lúc trả khách.
          </h1>
          <ServiceTag />
        </div>

        <p className='border-sidebar-border/80 text-sidebar-foreground/75 relative z-10 max-w-sm border-t pt-5 text-sm leading-relaxed'>
          Giao diện nội bộ cho nhân viên tiếp nhận, CSKH, điều phối, kỹ thuật, kho, kiểm tra chất lượng và quản lý.
        </p>
      </aside>

      <main className='relative flex items-center justify-center p-4 sm:p-8'>
        <div className='absolute end-4 top-4 z-10 sm:end-6 sm:top-6'>
          <ThemeSwitch />
        </div>
        <div className='flex w-full max-w-[25rem] flex-col gap-6'>
          <div className='pe-12 lg:hidden'>
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
      <div
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-lg shadow-sm ring-1 ring-white/10',
          compact ? 'bg-sidebar text-sidebar-primary' : 'bg-sidebar-primary text-sidebar-primary-foreground'
        )}
      >
        <BrandMark className='size-6' />
      </div>
      <div>
        <p className={cn('font-semibold tracking-wide', !compact && 'text-white')}>WOMS</p>
        <p className={cn('text-sm', compact ? 'text-muted-foreground' : 'text-sidebar-foreground/80')}>Hệ thống quản lý hoạt động bảo hành</p>
      </div>
    </div>
  )
}

// Tấm tem treo: đầu vát, có lỗ xỏ dây. Bọc drop-shadow bên ngoài để clip-path không cắt mất bóng đổ.
function ServiceTag() {
  const last = STAGES.length - 1
  return (
    <div className='relative w-[21rem] -rotate-2 pt-9' aria-hidden>
      <span className='bg-sidebar-foreground/35 absolute top-0 left-1/2 h-[3.25rem] w-px -translate-x-1/2' />
      <div className='drop-shadow-[0_26px_36px_rgb(0_0_0/0.5)]'>
        <div className='bg-sidebar-accent relative bg-gradient-to-b from-white/[0.04] to-transparent px-7 pt-10 pb-6 [clip-path:polygon(22%_0,78%_0,100%_9%,100%_100%,0_100%,0_9%)]'>
          <span className='bg-sidebar ring-sidebar-foreground/30 absolute top-3.5 left-1/2 size-3.5 -translate-x-1/2 rounded-full shadow-[inset_0_1px_2px_rgb(0_0_0/0.6)] ring-2' />

          <div className='border-sidebar-foreground/15 mb-4 border-b border-dashed pb-3.5'>
            <div className='flex items-baseline justify-between gap-2'>
              <p className='text-sidebar-foreground/80 text-xs font-medium'>Hành trình của một phiếu</p>
              <span className='text-sidebar-primary text-xs font-semibold tabular-nums'>
                {SHOWN + 1}/{STAGES.length}
              </span>
            </div>
            <div className='text-sidebar-foreground/70 mt-1 flex items-center justify-between gap-2 text-[11px]'>
              <span className='font-mono tabular-nums'>CAS-20261106-0041</span>
              <span>3 ngày làm việc</span>
            </div>
          </div>

          <ol className='relative grid gap-2.5'>
            <span className='bg-sidebar-foreground/15 absolute top-2 bottom-2 left-[7px] w-0.5' />
            <span
              className='bg-sidebar-primary absolute top-2 left-[7px] w-0.5 origin-top motion-safe:animate-[woms-track_1.4s_ease-out_both]'
              style={{ height: `calc((100% - 1rem) * ${SHOWN / last})` }}
            />
            {STAGES.map((s, i) => {
              const done = i < SHOWN
              const cur = i === SHOWN
              return (
                <li key={s.label} className='relative flex items-center justify-between gap-2 text-[14px]'>
                  <div className='flex items-center gap-3'>
                    <span
                      className={cn(
                        'relative z-10 flex size-4 shrink-0 items-center justify-center rounded-full',
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
                  </div>
                  {cur && <span className='text-sidebar-primary text-[11px] font-medium'>Đang xử lý</span>}
                </li>
              )
            })}
          </ol>
        </div>
      </div>
    </div>
  )
}
