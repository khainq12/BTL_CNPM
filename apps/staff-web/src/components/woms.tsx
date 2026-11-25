import { Link } from '@tanstack/react-router'
import { AlarmClock, CirclePause, Clock, ClockAlert, Laptop, PcCase, Printer, ShieldX } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDb, useMe } from '@/api/hooks'
import { canSee, type PageKey } from '@/domain/roles'
import { slaInfo, slaLeftMinutes, type SlaKind } from '@/domain/sla'
import { PARAMS, WORK_DAY_MINUTES } from '@/domain/params'
import { DEVICE_KIND_LABEL } from '@/domain/rules'
import { CASE_STATUS, type Tone } from '@/domain/statuses'
import type { CaseStatus, DeviceKind, WarrantyCase } from '@/domain/types'
import { fmtDateTime, initials } from '@/domain/format'
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
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap', TONE[tone], className)}>
      {children}
    </span>
  )
}

export function StatusBadge({ status }: { status: CaseStatus }) {
  const s = CASE_STATUS[status]
  return (
    <Pill tone={s.tone}>
      <span className='size-1.5 shrink-0 rounded-full bg-current opacity-70' aria-hidden />
      {s.label}
    </Pill>
  )
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

// Biểu tượng loại thiết bị, đi kèm tên thiết bị (không thay cho chữ).
const DEVICE_ICON = { laptop: Laptop, pc: PcCase, printer: Printer } satisfies Record<DeviceKind, unknown>

export function DeviceIcon({ kind, className }: { kind: DeviceKind; className?: string }) {
  const Icon = DEVICE_ICON[kind]
  return (
    <span className={cn('bg-accent text-accent-foreground inline-flex size-7 shrink-0 items-center justify-center rounded-md', className)} title={DEVICE_KIND_LABEL[kind]}>
      <Icon className='size-4' aria-hidden />
      <span className='sr-only'>{DEVICE_KIND_LABEL[kind]}</span>
    </span>
  )
}

// Ảnh đại diện bằng chữ cái đầu. Màu theo thứ tự tài khoản (cố định), chỉ để dễ nhận ra; tên luôn hiện bên cạnh.
const AVATAR_TONES = [
  'bg-teal-100 text-teal-900 dark:bg-teal-950 dark:text-teal-200',
  'bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200',
  'bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-200',
  'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
  'bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200',
  'bg-lime-100 text-lime-900 dark:bg-lime-950 dark:text-lime-200',
]

export function UserAvatar({ id, className }: { id?: string; className?: string }) {
  const db = useDb()
  const i = db.users.findIndex((u) => u.id === id)
  if (i < 0) return null
  return (
    <span className={cn('inline-flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold', AVATAR_TONES[i % AVATAR_TONES.length], className)} aria-hidden>
      {initials(db.users[i].name)}
    </span>
  )
}

export function UserChip({ id }: { id?: string }) {
  const name = useName()
  if (!id) return <span className='text-muted-foreground'>—</span>
  return (
    <span className='inline-flex items-center gap-2 whitespace-nowrap'>
      <UserAvatar id={id} />
      {name(id)}
    </span>
  )
}

// Thước thời hạn: phần còn lại của quỹ 3 ngày làm việc. Màu theo mức gấp, luôn kèm biểu tượng và chữ.
const SLA_BUDGET = PARAMS.repairSlaDays * WORK_DAY_MINUTES
const METER = {
  ok: { icon: Clock, fill: 'bg-meter-ok', track: 'bg-meter-ok-track', text: 'text-foreground' },
  soon: { icon: AlarmClock, fill: 'bg-amber-500', track: 'bg-amber-100 dark:bg-amber-950', text: 'text-amber-800 dark:text-amber-300' },
  overdue: { icon: ClockAlert, fill: 'bg-red-600 dark:bg-red-500', track: 'bg-red-100 dark:bg-red-950', text: 'text-red-700 dark:text-red-300' },
  paused: { icon: CirclePause, fill: 'bg-slate-400 dark:bg-slate-500', track: 'bg-muted', text: 'text-muted-foreground' },
} as const

const hours = (m: number) => (m / 60).toLocaleString('vi-VN', { maximumFractionDigits: 1 })

export function SlaMeter({ c }: { c: WarrantyCase }) {
  const s = slaInfo(c)
  if (s.kind !== 'ok' && s.kind !== 'soon' && s.kind !== 'overdue' && s.kind !== 'paused') return <SlaBadge c={c} />
  const m = METER[s.kind]
  const left = s.kind === 'overdue' ? 0 : Math.max(0, slaLeftMinutes(c) ?? 0)
  const pct = s.kind === 'overdue' ? 100 : Math.max(2, Math.min(100, (left / SLA_BUDGET) * 100))
  return (
    <div className='grid gap-1.5'>
      <div className={cn('flex items-center gap-1.5 text-sm font-medium', m.text)}>
        <m.icon className='size-4' aria-hidden />
        {s.label}
        {s.kind !== 'overdue' && <span className='text-muted-foreground ms-auto text-xs font-normal tabular-nums'>{hours(left)} / {hours(SLA_BUDGET)} giờ</span>}
      </div>
      <div
        role='meter'
        aria-label='Thời gian xử lý còn lại'
        aria-valuemin={0}
        aria-valuemax={SLA_BUDGET}
        aria-valuenow={Math.round(left)}
        aria-valuetext={s.label}
        className={cn('h-2 overflow-hidden rounded-full', m.track)}
      >
        <div
          className={cn('h-full rounded-full', m.fill, s.kind === 'paused' && 'bg-[repeating-linear-gradient(135deg,transparent_0_4px,rgb(255_255_255/0.45)_4px_7px)]')}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
