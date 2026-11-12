import { ShieldCheck } from 'lucide-react'

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className='bg-muted/40 grid min-h-svh place-items-center p-4'>
      <div className='flex w-full max-w-sm flex-col gap-6'>
        <div className='flex items-center gap-3'>
          <div className='bg-primary text-primary-foreground flex size-10 items-center justify-center rounded-lg'>
            <ShieldCheck className='size-5' aria-hidden />
          </div>
          <div>
            <p className='font-semibold'>WOMS</p>
            <p className='text-muted-foreground text-sm'>Hệ thống quản lý hoạt động bảo hành</p>
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}
