import { useId } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'

// Bộ form gọn cho các hộp thoại nghiệp vụ: nhãn rõ, lỗi ngay dưới ô, nút gửi khóa khi đang gửi.

export function Field({
  label,
  hint,
  error,
  required,
  className,
  children,
}: {
  label: React.ReactNode
  hint?: React.ReactNode
  error?: string | false
  required?: boolean
  className?: string
  // invalid: truyền vào aria-invalid để ô lỗi có viền đỏ và trình đọc màn hình báo lỗi.
  children: (id: string, describedBy?: string, invalid?: boolean) => React.ReactNode
}) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  const errId = error ? `${id}-err` : undefined
  return (
    <div className={cn('grid gap-1.5', className)}>
      <Label htmlFor={id} className={cn(error && 'text-destructive')}>
        {label}
        {required && <span className='text-destructive'>*</span>}
      </Label>
      {children(id, [hintId, errId].filter(Boolean).join(' ') || undefined, error ? true : undefined)}
      {hint && !error && (
        <p id={hintId} className='text-muted-foreground text-xs'>
          {hint}
        </p>
      )}
      {error && (
        <p id={errId} className='text-destructive text-xs'>
          {error}
        </p>
      )}
    </div>
  )
}

export function NativeSelect({ className, ...p }: React.ComponentProps<'select'>) {
  return (
    <select
      {...p}
      className={cn(
        'border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
    />
  )
}

// Lựa chọn dạng thẻ (label bọc RadioGroupItem): cả thẻ bấm được, thẻ đang chọn viền màu chính.
export const radioCardClass =
  'hover:bg-accent/40 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-accent/40 flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm transition-colors has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50'

export function SubmitButton({ pending, children, pendingText, ...p }: React.ComponentProps<typeof Button> & { pending?: boolean; pendingText?: string }) {
  return (
    <Button {...p} disabled={pending || p.disabled}>
      {pending && <Loader2 className='animate-spin' />}
      {pending ? (pendingText ?? 'Đang lưu...') : children}
    </Button>
  )
}

type Shell = {
  open: boolean
  onOpenChange: (v: boolean) => void
  title: React.ReactNode
  description?: React.ReactNode
  children: React.ReactNode
  footer: React.ReactNode
  onSubmit: () => void
  wide?: boolean
}

export function FormDialog({ open, onOpenChange, title, description, children, footer, onSubmit, wide }: Shell) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn('bg-card flex max-h-[calc(100svh-2rem)] flex-col gap-0 overflow-hidden p-0', wide && 'sm:max-w-2xl')}>
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            onSubmit()
          }}
          className='flex min-h-0 flex-1 flex-col'
        >
          <DialogHeader className='border-b px-6 pt-6 pb-4 pe-12'>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          <div className='grid min-h-0 flex-1 content-start gap-4 overflow-y-auto px-6 py-5'>{children}</div>
          <DialogFooter className='bg-muted/40 border-t px-6 py-4'>{footer}</DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function FormSheet({ open, onOpenChange, title, description, children, footer, onSubmit }: Shell) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='bg-card flex w-full flex-col gap-0 sm:max-w-2xl'>
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            onSubmit()
          }}
          className='flex min-h-0 flex-1 flex-col'
        >
          <SheetHeader className='border-b pe-12'>
            <SheetTitle>{title}</SheetTitle>
            {description && <SheetDescription>{description}</SheetDescription>}
          </SheetHeader>
          <div className='grid min-h-0 flex-1 content-start gap-5 overflow-y-auto p-4'>{children}</div>
          <SheetFooter className='bg-muted/40 flex-row justify-end border-t'>{footer}</SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}

export function CancelButton({ onClick }: { onClick: () => void }) {
  return (
    <Button type='button' variant='outline' onClick={onClick}>
      Hủy
    </Button>
  )
}
