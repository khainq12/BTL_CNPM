import { cn } from '@/lib/utils'

// Dấu nhận diện WOMS: tem bảo hành treo trên thiết bị, có dấu kiểm đã xử lý.
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth={2} strokeLinecap='round' strokeLinejoin='round' className={cn('size-4', className)} aria-hidden>
      <path d='M9 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H9l-6-6v-4z' />
      <circle cx='7' cy='12' r='1' fill='currentColor' stroke='none' />
      <path d='m11.5 12.2 2.2 2.2 4-4.6' />
    </svg>
  )
}
