import { Link } from '@tanstack/react-router'
import { ShieldX } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDb, useMe } from '@/api/hooks'
import { canSee, type PageKey } from '@/domain/roles'
import { slaInfo, type SlaKind } from '@/domain/sla'
import { CASE_STATUS, type Tone } from '@/domain/statuses'
import type { CaseStatus, WarrantyCase } from '@/domain/types'
import { fmtDateTime } from '@/domain/format'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'

const TONE: Record<Tone, string> = {
  neutral: 'bg-muted text-muted-foreground',
  info: 'bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200',
  wait: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
  warn: 'bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200',
  done: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
  bad: 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200',
}

export function Pill({ tone = 'neutral', className, children }: { tone?: Tone; className?: string; children: React.ReactNode }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap', TONE[tone], className)}>
      {children}
    </span>
  )
}

export function StatusBadge({ status }: { status: CaseStatus }) {
  const s = CASE_STATUS[status]
  return <Pill tone={s.tone}>{s.label}</Pill>
}

const SLA_TONE: Record<SlaKind, Tone> = {
  overdue: 'bad',
  pickup_late: 'bad',
  soon: 'wait',
  paused: 'neutral',
  ok: 'neutral',
  not_started: 'neutral',
  pickup: 'neutral',
  stopped: 'neutral',
}

export function SlaBadge({ c, withDue }: { c: WarrantyCase; withDue?: boolean }) {
  const s = slaInfo(c)
  if (s.kind === 'stopped') return <span className='text-muted-foreground text-xs'>—</span>
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className='inline-flex flex-col items-start gap-0.5'>
          <Pill tone={SLA_TONE[s.kind]} className={cn(s.kind === 'paused' && 'border border-dashed', s.kind === 'not_started' && 'bg-transparent')}>
            {s.label}
          </Pill>
          {withDue && s.dueAt && <span className='text-muted-foreground text-xs'>Hạn {fmtDateTime(s.dueAt)}</span>}
        </span>
      </TooltipTrigger>
      <TooltipContent className='max-w-64'>{s.detail || s.label}</TooltipContent>
    </Tooltip>
  )
}

export function PageShell({
  title,
  description,
  crumbs,
  actions,
  children,
  fluid,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  crumbs?: { label: string; to?: string }[]
  actions?: React.ReactNode
  children: React.ReactNode
  fluid?: boolean
}) {
  return (
    <>
      <Header fixed>
        <Search className='me-auto' placeholder='Tìm trang, thao tác...' />
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>
      <Main fluid={fluid} className='flex flex-col gap-6'>
        <div className='flex flex-wrap items-end justify-between gap-3'>
          <div className='min-w-0'>
            {crumbs && (
              <nav aria-label='Đường dẫn' className='text-muted-foreground mb-1 text-sm'>
                {crumbs.map((c, i) => (
                  <span key={i}>
                    {i > 0 && <span className='mx-1.5'>/</span>}
                    {c.to ? (
                      <Link to={c.to} className='hover:text-foreground underline-offset-4 hover:underline'>
                        {c.label}
                      </Link>
                    ) : (
                      c.label
                    )}
                  </span>
                ))}
              </nav>
            )}
            <h1 className='text-2xl font-semibold tracking-tight text-balance'>{title}</h1>
            {description && <p className='text-muted-foreground mt-1'>{description}</p>}
          </div>
          {actions && <div className='flex flex-wrap items-center gap-2'>{actions}</div>}
        </div>
        {children}
      </Main>
    </>
  )
}

// Chặn trang theo vai trò (BR-27, AT-14). Backend vẫn phải kiểm tra lại.
export function Guard({ page, children }: { page: PageKey; children: React.ReactNode }) {
  const me = useMe()
  if (canSee(me.role, page)) return <>{children}</>
  return (
    <PageShell title='Không có quyền truy cập'>
      <div className='flex max-w-lg flex-col items-start gap-3 rounded-lg border p-6'>
        <ShieldX className='text-muted-foreground size-6' aria-hidden />
        <p>Vai trò của bạn không được xem trang này. Nếu cần quyền, liên hệ quản lý để được cấp.</p>
        <Link to='/' className='text-sm font-medium underline underline-offset-4'>
          Về hộp việc
        </Link>
      </div>
    </PageShell>
  )
}

export function Empty({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('text-muted-foreground px-6 py-10 text-center text-sm', className)}>{children}</div>
}

export function InfoList({ rows, className }: { rows: [React.ReactNode, React.ReactNode][]; className?: string }) {
  return (
    <dl className={cn('grid grid-cols-[minmax(7rem,auto)_1fr] gap-x-4 gap-y-2 text-sm', className)}>
      {rows.map(([k, v], i) => (
        <div key={i} className='contents'>
          <dt className='text-muted-foreground'>{k}</dt>
          <dd className='min-w-0 break-words'>{v ?? '—'}</dd>
        </div>
      ))}
    </dl>
  )
}

export function useName() {
  const db = useDb()
  return (id?: string) => db.users.find((u) => u.id === id)?.name ?? (id === 'khach' ? 'Khách hàng' : '—')
}

export function CaseLink({ c }: { c: WarrantyCase }) {
  return (
    <Link to='/phieu/$id' params={{ id: c.id }} className='font-medium whitespace-nowrap underline-offset-4 hover:underline'>
      {c.code}
    </Link>
  )
}

export function Section({ title, description, actions, children, className }: { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('bg-card rounded-lg border', className)}>
      <header className='flex flex-wrap items-start justify-between gap-2 border-b px-4 py-3'>
        <div>
          <h2 className='font-semibold'>{title}</h2>
          {description && <p className='text-muted-foreground text-sm'>{description}</p>}
        </div>
        {actions}
      </header>
      <div className='p-4'>{children}</div>
    </section>
  )
}
