import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Check, CircleX } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAction, useDb, useMe } from '@/api/hooks'
import * as api from '@/api/service'
import { currentPlan, openChange } from '@/domain/plan-change'
import { fmtDateTime, fmtDayMonth, fmtMinutes, fmtMoney } from '@/domain/format'
import { CAUSE_LABEL, DECISION_LABEL, DEVICE_KIND_LABEL, WARRANTY_CHECK_LABEL } from '@/domain/rules'
import { slaInfo } from '@/domain/sla'
import { CASE_STATUS, STAGES } from '@/domain/statuses'
import type { WarrantyCase, WorkOrder } from '@/domain/types'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DeviceIcon, Empty, Guard, InfoList, PageShell, Pill, Section, SlaMeter, StatusBadge, UserAvatar, useName } from '@/components/woms'
import { WoParts } from '@/features/inventory/wo-parts'
import { ActionDialog } from './actions'
import { PhotoGallery } from './photo-picker'
import { CHANGE_STATUS, PlanChangeList } from './plan-change'
import { QuoteLines } from './quote-table'
import { canSeeCustomer, canViewCase, nextActions, type ActionKey } from './logic'

export function CaseDetail({ id }: { id: string }) {
  return (
    <Guard page='caseDetail'>
      <Detail key={id} id={id} />
    </Guard>
  )
}

// Nút đề nghị hủy: viền và chữ màu cảnh báo để không lẫn với thao tác thường.
const CANCEL_TONE = 'text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/5'

function Detail({ id }: { id: string }) {
  const db = useDb()
  const me = useMe()
  const [action, setAction] = useState<ActionKey | null>(null)
  const [tab, setTab] = useState('overview')
  const c = db.cases.find((x) => x.id === id)
  const wo = db.workOrders.find((w) => w.id === c?.workOrderId)

  if (!c || !canViewCase(me, c, wo))
    return (
      <PageShell title='Không mở được phiếu' crumbs={[{ label: 'Hộp việc', to: '/' }]}>
        <Empty className='bg-card rounded-lg border'>Phiếu không tồn tại hoặc bạn không được giao xử lý phiếu này (BR-27).</Empty>
      </PageShell>
    )

  const cu = db.customers.find((x) => x.id === c.customerId)!
  const dev = db.devices.find((x) => x.id === c.deviceId)!
  const actions = nextActions(me, c, wo)
  const sla = slaInfo(c)
  const change = openChange(c)
  // Kho: thao tác linh kiện nằm ở thẻ "Lệnh sửa chữa" (WoParts), không mở hộp thoại riêng.
  const openParts = () => {
    setTab('wo')
    requestAnimationFrame(() => (document.getElementById('wo-parts') ?? document.getElementById('case-tabs'))?.scrollIntoView({ block: 'start' }))
  }

  return (
    <PageShell
      title={
        <span className='flex flex-wrap items-center gap-x-3 gap-y-1'>
          <DeviceIcon kind={dev.kind} className='size-9 rounded-lg [&_svg]:size-5' />
          <span className='tabular-nums'>{c.code}</span>
          <StatusBadge status={c.status} />
          {change && <Pill tone='wait'>{CHANGE_STATUS[change.status][0]} đổi phương án</Pill>}
        </span>
      }
      description={`${DEVICE_KIND_LABEL[dev.kind]} ${dev.brand} ${dev.model}${canSeeCustomer(me) ? ` · ${cu.name}` : ''}`}
      crumbs={[{ label: me.role === 'KTV' ? 'Việc của tôi' : me.role === 'KHO' ? 'Yêu cầu linh kiện' : me.role === 'QC' ? 'Chờ kiểm tra chất lượng' : 'Danh sách phiếu', to: me.role === 'KTV' ? '/viec-cua-toi' : me.role === 'KHO' ? '/kho/yeu-cau' : me.role === 'QC' ? '/kiem-dinh' : '/phieu' }, { label: c.code }]}
    >
      <Stepper c={c} />

      <div className='grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start'>
        <Tabs id='case-tabs' value={tab} onValueChange={setTab} className='min-w-0 scroll-mt-20'>
          <div className='overflow-x-auto border-b'>
            <TabsList className='h-auto w-max justify-start gap-0.5 rounded-none bg-transparent p-0'>
              <Tab value='overview' label='Tổng quan' />
              <Tab value='diag' label='Chẩn đoán' empty={!c.diagnosis} />
              <Tab value='warranty' label='Bảo hành và báo giá' empty={!c.eligibility && !c.quotes.length} count={c.quotes.length} />
              <Tab value='wo' label='Lệnh sửa chữa' empty={!wo} />
              <Tab value='qc' label='Kiểm tra chất lượng' empty={!c.qc.length} count={c.qc.length} />
              <Tab value='handover' label='Bàn giao' empty={!c.handover && !c.returnConclusion} />
              <Tab value='history' label='Lịch sử' />
            </TabsList>
          </div>
          <TabsContent value='overview' className='mt-4 grid gap-4'>
            <Overview c={c} />
          </TabsContent>
          <TabsContent value='diag' className='mt-4'>
            <DiagnosisTab c={c} />
          </TabsContent>
          <TabsContent value='warranty' className='mt-4'>
            <WarrantyTab c={c} />
          </TabsContent>
          <TabsContent value='wo' className='mt-4'>
            {wo ? <WoTab c={c} wo={wo} /> : <Empty className='bg-card rounded-lg border'>Chưa có lệnh sửa chữa. Lệnh được lập khi phương án sửa được xác nhận.</Empty>}
          </TabsContent>
          <TabsContent value='qc' className='mt-4'>
            <QcTab c={c} />
          </TabsContent>
          <TabsContent value='handover' className='mt-4'>
            <HandoverTab c={c} />
          </TabsContent>
          <TabsContent value='history' className='mt-4'>
            <HistoryTab c={c} />
          </TabsContent>
        </Tabs>

        <aside className='order-first grid gap-4 lg:sticky lg:top-20 lg:order-none'>
          <Section title='Việc cần làm' className={cn(actions.length === 0 && 'bg-muted/30')}>
            {actions.length === 0 ? (
              <p className='text-muted-foreground text-sm'>
                {change
                  ? `Đề xuất đổi phương án #${change.no} đang ở bước "${CHANGE_STATUS[change.status][0].toLowerCase()}". Kỹ thuật viên tạm ngừng cho tới khi có kết quả.`
                  : CASE_STATUS[c.status].owner.length
                  ? `Phiếu đang chờ ${CASE_STATUS[c.status].owner.map((r) => ({ TN: 'tiếp nhận', CSKH: 'CSKH', DP: 'điều phối', KTV: 'kỹ thuật viên', KHO: 'kho', QC: 'QC', QL: 'quản lý' })[r]).join(' hoặc ')} xử lý. Vai trò của bạn không có thao tác ở bước này.`
                  : 'Phiếu đã kết thúc.'}
              </p>
            ) : (
              <div className='grid gap-2'>
                {actions.map((a) =>
                  a.key === 'approval' ? (
                    <Button key={a.key} asChild>
                      <Link to='/phe-duyet'>{a.label}</Link>
                    </Button>
                  ) : a.disabled ? (
                    <div key={a.key} className='grid gap-1'>
                      <Button variant={a.primary ? 'default' : 'outline'} disabled aria-describedby={`${a.key}-why`} className={cn(a.key === 'cancel' && CANCEL_TONE)}>
                        {a.label}
                      </Button>
                      <p id={`${a.key}-why`} className='text-muted-foreground text-xs'>
                        {a.disabled}
                      </p>
                    </div>
                  ) : (
                    <Button key={a.key} variant={a.primary ? 'default' : 'outline'} className={cn(a.key === 'cancel' && CANCEL_TONE)} onClick={() => (a.key === 'warehouse' ? openParts() : setAction(a.key))}>
                      {a.label}
                    </Button>
                  )
                )}
              </div>
            )}
          </Section>
          <Section title='Thời hạn xử lý'>
            <div className='grid gap-2 text-sm'>
              <SlaMeter c={c} />
              <p className='text-muted-foreground'>{sla.detail}</p>
              {sla.dueAt && <p>Hạn: {fmtDateTime(sla.dueAt)}</p>}
              {c.sla.pauses.map((p, i) => (
                <p key={i} className='text-muted-foreground text-xs'>
                  Tạm dừng {p.reason === 'CHO_LINH_KIEN' ? 'chờ linh kiện' : 'chờ xác nhận giá'}: {fmtDateTime(p.start)} → {p.end ? fmtDateTime(p.end) : 'đang dừng'}
                </p>
              ))}
            </div>
          </Section>
        </aside>
      </div>

      {action && <ActionDialog key={action} action={action} c={c} wo={wo} onClose={() => setAction(null)} />}
    </PageShell>
  )
}

// Thẻ kiểu gạch chân. Thẻ có dữ liệu chữ đậm hơn thẻ chưa có (vẫn bấm được); số lần nếu có nhiều bản ghi.
function Tab({ value, label, empty, count }: { value: string; label: string; empty?: boolean; count?: number }) {
  return (
    <TabsTrigger
      value={value}
      className={cn(
        'hover:text-foreground data-[state=active]:text-foreground data-[state=active]:after:bg-primary focus-visible:ring-inset focus-visible:outline-none data-[state=active]:font-medium dark:data-[state=active]:text-foreground relative h-10 flex-none rounded-none border-0 bg-transparent px-2 after:absolute after:inset-x-1 after:-bottom-px after:h-0.5 after:rounded-full data-[state=active]:bg-transparent data-[state=active]:shadow-none dark:data-[state=active]:border-0 dark:data-[state=active]:bg-transparent',
        empty ? 'text-muted-foreground font-normal' : 'text-foreground/80 dark:text-foreground/80'
      )}
    >
      {label}
      {count ? <span className='bg-muted text-muted-foreground rounded-full px-1.5 text-[11px] leading-4 tabular-nums'>{count}</span> : null}
    </TabsTrigger>
  )
}

function Stepper({ c }: { c: WarrantyCase }) {
  const name = useName()
  const idx = STAGES.findIndex((s) => s.statuses.includes(c.status))
  // Lúc phiếu vào mỗi bước: lần đầu chuyển sang một trạng thái của bước đó (bước đầu là lúc tạo phiếu).
  const entered = STAGES.map((s, i) => (i === 0 ? { at: c.createdAt, by: c.receivedBy } : c.events.find((e) => e.to && s.statuses.includes(e.to))))
  if (c.status === 'CANCELLED')
    return (
      <div className='bg-muted/60 rounded-xl border px-4 py-3 text-sm'>
        <span className='font-medium'>Phiếu đã hủy:</span> {c.cancelReason}
      </div>
    )
  const finished = c.status === 'COMPLETED'
  // Bước hiện tại mang màu của trạng thái khi phiếu đang chờ, vướng hay phải làm lại; bình thường dùng màu chính.
  const curTone = { wait: 'border-amber-500 text-amber-700 ring-amber-500/20 dark:text-amber-300', warn: 'border-orange-500 text-orange-700 ring-orange-500/20 dark:text-orange-300', bad: 'border-red-500 text-red-700 ring-red-500/20 dark:text-red-300' }[CASE_STATUS[c.status].tone as string] ?? 'border-primary text-primary ring-primary/20'
  return (
    <div className='bg-card overflow-x-auto rounded-xl border px-4 py-3'>
      <ol className='grid min-w-[44rem] grid-cols-8' aria-label='Tiến trình phiếu'>
        {STAGES.map((s, i) => {
          const done = i < idx || finished
          const cur = i === idx && !finished
          return (
            <li key={s.label} className='relative flex flex-col items-center gap-1.5 text-center text-xs' aria-current={cur ? 'step' : undefined}>
              {i > 0 && <span className={cn('absolute top-3 right-1/2 h-0.5 w-full -translate-y-1/2', i <= idx || finished ? 'bg-primary' : 'bg-border')} aria-hidden />}
              <span
                className={cn(
                  'relative z-10 flex size-6 items-center justify-center rounded-full border-2 text-[11px] font-semibold tabular-nums',
                  done && 'border-primary bg-primary text-primary-foreground',
                  cur && cn('bg-card ring-4', curTone),
                  !done && !cur && 'border-border bg-card text-muted-foreground'
                )}
              >
                {done ? <Check className='size-3.5' strokeWidth={3} aria-hidden /> : i + 1}
              </span>
              <span className={cn('px-1 leading-tight', cur ? 'text-foreground font-semibold' : done ? 'text-foreground' : 'text-muted-foreground')}>{s.label}</span>
              {(done || cur) && entered[i] && (
                <time dateTime={entered[i].at} title={`Vào bước lúc ${fmtDateTime(entered[i].at)}${entered[i].by ? `, ${name(entered[i].by)}` : ''}`} className='text-muted-foreground -mt-1 text-xs tabular-nums'>
                  {fmtDayMonth(entered[i].at)}
                </time>
              )}
              <span className='sr-only'>{done ? '(đã xong)' : cur ? '(bước hiện tại)' : '(chưa tới)'}</span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function Overview({ c }: { c: WarrantyCase }) {
  const db = useDb()
  const me = useMe()
  const name = useName()
  const cu = db.customers.find((x) => x.id === c.customerId)!
  const dev = db.devices.find((x) => x.id === c.deviceId)!
  return (
    <>
      {c.infoRequest && (
        <Alert variant='warning' role='status'>
          <AlertDescription className='block'>
            <span className='font-medium'>Đang chờ khách bổ sung:</span> {c.infoRequest}
          </AlertDescription>
        </Alert>
      )}
      <div className='grid gap-4 md:grid-cols-2'>
        <Section title='Thiết bị'>
          <InfoList
            rows={[
              ['Loại', DEVICE_KIND_LABEL[dev.kind]],
              ['Hãng, model', `${dev.brand} ${dev.model}`],
              ['Serial', <span className='font-mono'>{dev.serial}</span>],
              ['Ngày mua', dev.purchaseDate ? new Date(dev.purchaseDate).toLocaleDateString('vi-VN') : 'Chưa có chứng từ'],
              ['Lịch sử', <Link to='/thiet-bi/$id' params={{ id: dev.id }} className='underline underline-offset-4'>Xem các lần bảo hành trước</Link>],
            ]}
          />
        </Section>
        <Section title='Khách hàng'>
          {canSeeCustomer(me) ? (
            <InfoList
              rows={[
                ['Họ tên', <Link to='/khach-hang/$id' params={{ id: cu.id }} className='underline underline-offset-4'>{cu.name}</Link>],
                ['Điện thoại', cu.phone],
                ['Email', cu.email],
                ['Kênh', c.channel === 'ONLINE' ? 'Trực tuyến' : 'Tại quầy'],
              ]}
            />
          ) : (
            <p className='text-muted-foreground text-sm'>Thông tin liên hệ của khách được ẩn với vai trò của bạn.</p>
          )}
        </Section>
      </div>
      <Section title='Tiếp nhận'>
        <InfoList
          rows={[
            ['Lỗi khách báo', c.symptom],
            ['Tình trạng ngoài', c.condition || '—'],
            ['Phụ kiện', c.noAccessories ? 'Không có phụ kiện' : c.accessories.join(', ') || '—'],
            ['Ảnh hiện trạng', <PhotoGallery photos={c.photos} />],
            ['Tiếp nhận', c.receivedAt ? `${fmtDateTime(c.receivedAt)} · ${name(c.receivedBy)}` : 'Chưa nhận máy'],
            ['Kiểm tra sơ bộ', c.precheck ? `${WARRANTY_CHECK_LABEL[c.precheck.warranty]}. ${c.precheck.note}` : 'Chưa kiểm tra'],
          ]}
        />
      </Section>
    </>
  )
}

function DiagnosisTab({ c }: { c: WarrantyCase }) {
  const name = useName()
  const db = useDb()
  const d = c.diagnosis
  if (!d) return <Empty className='bg-card rounded-lg border'>{c.diagnosisTechId ? `${name(c.diagnosisTechId)} đang chẩn đoán.` : 'Chưa giao kỹ thuật viên chẩn đoán.'}</Empty>
  return (
    <Section title='Biên bản chẩn đoán' description={`${name(d.by)} · ${fmtDateTime(d.at)}`}>
      <InfoList
        rows={[
          ['Nguyên nhân', `${CAUSE_LABEL[d.causeType]}. ${d.cause}`],
          ['Mức độ', { NHE: 'Nhẹ', TRUNG_BINH: 'Trung bình', NANG: 'Nặng' }[d.severity]],
          ['Sửa được', d.repairable ? 'Có' : 'Không sửa được tại trung tâm'],
          ['Phương án', d.plan || '—'],
          [
            'Công việc',
            d.tasks.length ? (
              <ul className='grid gap-1'>
                {d.tasks.map((t, k) => (
                  <li key={k} className='flex justify-between gap-3'>
                    <span>{t.title}</span>
                    <span className='text-muted-foreground shrink-0 tabular-nums'>{fmtMinutes(t.minutes)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              '—'
            ),
          ],
          [
            'Linh kiện',
            d.parts.length ? (
              <ul className='grid gap-1'>
                {d.parts.map((p, k) => (
                  <li key={k} className='flex justify-between gap-3'>
                    <span>{db.parts.find((x) => x.id === p.partId)?.name}</span>
                    <span className='text-muted-foreground shrink-0 tabular-nums'>× {p.qty}</span>
                  </li>
                ))}
              </ul>
            ) : (
              'Không cần'
            ),
          ],
        ]}
      />
    </Section>
  )
}

const QUOTE_STATUS = { CHO_DUYET: ['Chờ quản lý duyệt', 'wait'], DA_DUYET: ['Quản lý đã duyệt', 'info'], TU_CHOI_DUYET: ['Quản lý từ chối', 'bad'], DA_GUI: ['Đã gửi khách', 'wait'], KHACH_DONG_Y: ['Khách đồng ý', 'done'], KHACH_TU_CHOI: ['Khách từ chối', 'bad'] } as const

function WarrantyTab({ c }: { c: WarrantyCase }) {
  const name = useName()
  const e = c.eligibility
  return (
    <div className='grid gap-4'>
      <Section title='Kết luận bảo hành'>
        {e ? (
          <InfoList
            rows={[
              ['Kết luận', DECISION_LABEL[e.decision]],
              ['Quy tắc', e.ruleCode],
              ['Lý do', e.reason],
              ['Chính sách', e.policyCode],
              ['Ngoại lệ', e.exceptionApproved === undefined ? '—' : e.exceptionApproved ? 'Quản lý đã duyệt' : 'Quản lý từ chối'],
              ['Người kết luận', `${name(e.by)} · ${fmtDateTime(e.at)}`],
            ]}
          />
        ) : (
          <p className='text-muted-foreground text-sm'>Chưa kết luận. CSKH kết luận sau khi có biên bản chẩn đoán.</p>
        )}
      </Section>
      {c.quotes
        .slice()
        .reverse()
        .map((q) => (
          <Section key={q.version} title={q.planChangeNo ? `Báo giá bổ sung v${q.version} (đổi phương án #${q.planChangeNo})` : `Báo giá v${q.version}`} actions={<Pill tone={QUOTE_STATUS[q.status][1]}>{QUOTE_STATUS[q.status][0]}</Pill>}>
            <QuoteLines items={q.items} labor={q.labor} total={q.total} />
            {q.confirmMethod && (
              <p className='text-muted-foreground mt-2 text-sm'>
                Xác nhận: {q.confirmMethod}
                {q.confirmNote ? ` · ${q.confirmNote}` : ''} · {fmtDateTime(q.respondedAt)}
              </p>
            )}
          </Section>
        ))}
    </div>
  )
}

function WoTab({ c, wo }: { c: WarrantyCase; wo: WorkOrder }) {
  const me = useMe()
  const name = useName()
  const toggle = useAction(api.toggleTask)
  const addLog = useAction(api.addWoLog, { success: 'Đã ghi nhật ký' })
  const [log, setLog] = useState('')
  const mine = me.role === 'KTV' && wo.technicianId === me.id && c.status === 'IN_REPAIR'
  return (
    <div className='grid gap-4'>
      <Section
        title={<span className='tabular-nums'>{wo.code}</span>}
        actions={
          <Pill tone={wo.tasks.length && wo.tasks.every((t) => t.done) ? 'done' : 'neutral'}>
            <span className='tabular-nums'>
              {wo.tasks.filter((t) => t.done).length}/{wo.tasks.length}
            </span>{' '}
            việc xong
          </Pill>
        }
        description={`Kỹ thuật viên: ${name(wo.technicianId)} · Lập ${fmtDateTime(wo.createdAt)}${wo.startedAt ? ` · Bắt đầu ${fmtDateTime(wo.startedAt)}` : ''}`}>
        <p className='mb-3 text-sm'>
          <span className='text-muted-foreground'>Phương án hiện hành: </span>
          {currentPlan(c) || '—'}
        </p>
        {mine && openChange(c) && (
          <Alert variant='warning' role='status' className='mb-3'>
            <AlertDescription>Đang chờ xác nhận đổi phương án, tạm ngừng đánh dấu công việc (BR-12).</AlertDescription>
          </Alert>
        )}
        <ul className='-mx-2 grid gap-0.5'>
          {wo.tasks.map((t) => (
            <li key={t.id}>
              {/* Cả dòng bấm được để đánh dấu, không cần nhắm đúng ô 16px. */}
              <label className='hover:bg-accent/40 flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-sm has-[:disabled]:cursor-default has-[:disabled]:hover:bg-transparent'>
                <Checkbox checked={t.done} disabled={!mine || !!openChange(c) || toggle.isPending} onCheckedChange={() => toggle.mutate([me, wo.id, t.id])} aria-label={t.title} />
                <span className={cn('flex-1', t.done && 'text-muted-foreground line-through')}>{t.title}</span>
                <span className='text-muted-foreground text-xs tabular-nums'>{fmtMinutes(t.minutes)}</span>
              </label>
            </li>
          ))}
        </ul>
      </Section>
      <div id='wo-parts' className='scroll-mt-20'>
        <Section title='Linh kiện'>
          <WoParts wo={wo} />
        </Section>
      </div>
      <PlanChangeList c={c} />
      <Section title='Nhật ký sửa chữa'>
        {mine && (
          <form
            className='mb-3 flex gap-2'
            onSubmit={(e) => {
              e.preventDefault()
              if (log.trim()) addLog.mutate([me, wo.id, log], { onSuccess: () => setLog('') })
            }}
          >
            <Input aria-label='Ghi nhật ký' value={log} onChange={(e) => setLog(e.target.value)} placeholder='VD: Đã thay keo tản nhiệt, nhiệt độ ổn định 65°C' />
            <Button type='submit' variant='outline' disabled={addLog.isPending}>
              Ghi
            </Button>
          </form>
        )}
        {wo.logs.length === 0 ? (
          <p className='text-muted-foreground text-sm'>Chưa có ghi chép.</p>
        ) : (
          <ul className='grid divide-y text-sm'>
            {wo.logs
              .slice()
              .reverse()
              .map((l, i) => (
                <li key={i} className='py-2 first:pt-0 last:pb-0'>
                  {l.text}
                  <div className='text-muted-foreground text-xs'>
                    {name(l.by)} · {fmtDateTime(l.at)}
                  </div>
                </li>
              ))}
          </ul>
        )}
      </Section>
      {wo.assignHistory.length > 1 && (
        <Section title='Lịch sử phân công'>
          <ul className='grid gap-1 text-sm'>
            {wo.assignHistory.map((h, i) => (
              <li key={i}>
                {h.from ? `${name(h.from)} → ` : ''}
                {name(h.to)}
                {h.reason ? `: ${h.reason}` : ''} <span className='text-muted-foreground text-xs'>· {fmtDateTime(h.at)}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  )
}

function QcTab({ c }: { c: WarrantyCase }) {
  const name = useName()
  if (!c.qc.length) return <Empty className='bg-card rounded-lg border'>Chưa kiểm tra chất lượng.</Empty>
  return (
    <div className='grid gap-4'>
      {c.qc
        .slice()
        .reverse()
        .map((q) => (
          <Section key={q.round} title={`Lần ${q.round}`} description={`${name(q.by)} · ${fmtDateTime(q.at)}`} actions={<Pill tone={q.pass ? 'done' : 'bad'}>{q.pass ? 'Đạt' : 'Không đạt'}</Pill>}>
            {q.defect && <p className='border-destructive/30 bg-destructive/5 text-destructive mb-3 rounded-md border px-3 py-2 text-sm'>Lỗi còn tồn tại: {q.defect}</p>}
            {q.photos?.length ? (
              <div className='mb-3'>
                <PhotoGallery photos={q.photos} />
              </div>
            ) : null}
            <ul className='grid gap-1 text-sm'>
              {q.items.map((i) => (
                <li key={i.label} className='flex gap-2'>
                  {i.pass ? <Check className='mt-0.5 size-4 text-emerald-600' aria-label='Đạt' /> : <CircleX className='text-destructive mt-0.5 size-4' aria-label='Không đạt' />}
                  <span>
                    {i.label}
                    {i.note && <span className='text-muted-foreground'> · {i.note}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        ))}
    </div>
  )
}

function HandoverTab({ c }: { c: WarrantyCase }) {
  const name = useName()
  const h = c.handover
  return (
    <div className='grid gap-4'>
      {c.returnConclusion && (
        <Section title='Kết luận trả không sửa'>
          <InfoList rows={[['Kết luận', c.returnConclusion.text], ['Phí kiểm tra', c.returnConclusion.feeAgreed ? 'Khách đồng ý' : 'Không thu'], ['Người kết luận', `${name(c.returnConclusion.by)} · ${fmtDateTime(c.returnConclusion.at)}`]]} />
        </Section>
      )}
      {h ? (
        <Section title='Biên bản bàn giao'>
          <InfoList
            rows={[
              ['Người nhận', `${h.recipientName} · ${h.recipientPhone} (${h.relation === 'CHINH_CHU' ? 'chính chủ' : 'nhận hộ'})`],
              ['Xác thực', h.idNote],
              ['Đối chiếu', `${h.accessoriesOk ? 'Đủ phụ kiện' : 'Thiếu phụ kiện'}, ${h.conditionOk ? 'khách đã kiểm tra' : '—'}, ${h.signed ? 'đã ký' : 'chưa ký'}`],
              ['Phí kiểm tra', h.inspectionFee ? fmtMoney(h.inspectionFee) : 'Không'],
              ['Đánh giá', h.rating ? `${h.rating}/5${h.feedback ? ` · ${h.feedback}` : ''}` : 'Khách chưa đánh giá'],
              ['Nhân viên', `${name(h.by)} · ${fmtDateTime(h.at)}`],
            ]}
          />
        </Section>
      ) : (
        !c.returnConclusion && <Empty className='bg-card rounded-lg border'>Chưa bàn giao.</Empty>
      )}
    </div>
  )
}

function HistoryTab({ c }: { c: WarrantyCase }) {
  const name = useName()
  const events = c.events.slice().reverse()
  const day = (iso: string) => new Date(iso).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })
  const time = (iso: string) => new Date(iso).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' })
  return (
    <Section title='Lịch sử xử lý' description='Không ai sửa được lịch sử (BR-28).'>
      <ol className='grid'>
        {events.map((e, i) => {
          const newDay = i === 0 || day(events[i - 1].at) !== day(e.at)
          return (
            <li key={i} className='grid'>
              {newDay && <div className={cn('text-muted-foreground mb-2 text-xs font-medium first-letter:uppercase', i > 0 && 'mt-3')}>{day(e.at)}</div>}
              <div className='relative grid grid-cols-[3rem_1.25rem_minmax(0,1fr)] gap-x-2 pb-4'>
                <time dateTime={e.at} className='text-muted-foreground pt-0.5 text-xs tabular-nums'>
                  {time(e.at)}
                </time>
                <span className='relative flex justify-center' aria-hidden>
                  {i < events.length - 1 && day(events[i + 1].at) === day(e.at) && <span className='bg-muted-foreground/30 absolute top-4 -bottom-4 w-px' />}
                  <span className={cn('mt-1 size-2.5 rounded-full ring-4 ring-card', e.to ? 'bg-primary' : 'bg-muted-foreground/50')} />
                </span>
                <div className='grid gap-0.5 text-sm'>
                  <div className='font-medium'>{e.action}</div>
                  {e.to && (
                    <div className='text-muted-foreground'>
                      {e.from ? `${CASE_STATUS[e.from].label} → ` : ''}
                      {CASE_STATUS[e.to].label}
                    </div>
                  )}
                  {e.note && <div>{e.note}</div>}
                  <div className='text-muted-foreground mt-0.5 flex items-center gap-1.5 text-xs'>
                    <UserAvatar id={e.by} className='size-5 text-[9px]' />
                    {name(e.by)}
                  </div>
                </div>
              </div>
            </li>
          )
        })}
      </ol>
    </Section>
  )
}
