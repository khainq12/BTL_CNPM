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
  children: (id: string, describedBy?: string) => React.ReactNode
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
      {children(id, [hintId, errId].filter(Boolean).join(' ') || undefined)}
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
        'border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] disabled:opacity-50 aria-invalid:border-destructive',
        className
      )}
    />
  )
}

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
      <DialogContent className={cn(wide && 'sm:max-w-2xl')}>
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            onSubmit()
          }}
          className='grid gap-4'
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          {children}
          <DialogFooter>{footer}</DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function FormSheet({ open, onOpenChange, title, description, children, footer, onSubmit }: Shell) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='flex w-full flex-col gap-0 sm:max-w-2xl'>
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            onSubmit()
          }}
          className='flex min-h-0 flex-1 flex-col'
        >
          <SheetHeader className='border-b'>
            <SheetTitle>{title}</SheetTitle>
            {description && <SheetDescription>{description}</SheetDescription>}
          </SheetHeader>
          <div className='grid flex-1 content-start gap-5 overflow-y-auto p-4'>{children}</div>
          <SheetFooter className='flex-row justify-end border-t'>{footer}</SheetFooter>
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
