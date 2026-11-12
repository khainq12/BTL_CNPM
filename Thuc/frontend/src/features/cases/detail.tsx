import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Check, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAction, useDb, useMe } from '@/api/hooks'
import * as api from '@/api/service'
import { fmtDateTime, fmtMinutes, fmtMoney } from '@/domain/format'
import { CAUSE_LABEL, DECISION_LABEL, DEVICE_KIND_LABEL, WARRANTY_CHECK_LABEL } from '@/domain/rules'
import { slaInfo } from '@/domain/sla'
import { CASE_STATUS, STAGES } from '@/domain/statuses'
import type { WarrantyCase, WorkOrder } from '@/domain/types'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Empty, Guard, InfoList, PageShell, Pill, Section, SlaBadge, StatusBadge, useName } from '@/components/woms'
import { WoParts } from '@/features/inventory/wo-parts'
import { ActionDialog } from './actions'
import { canSeeCustomer, canViewCase, nextActions, type ActionKey } from './logic'

export function CaseDetail({ id }: { id: string }) {
  return (
    <Guard page='caseDetail'>
      <Detail id={id} />
    </Guard>
  )
}

function Detail({ id }: { id: string }) {
  const db = useDb()
  const me = useMe()
  const [action, setAction] = useState<ActionKey | null>(null)
  const c = db.cases.find((x) => x.id === id)
  const wo = db.workOrders.find((w) => w.id === c?.workOrderId)

  if (!c || !canViewCase(me, c, wo))
    return (
      <PageShell title='Không mở được phiếu' crumbs={[{ label: 'Hộp việc', to: '/' }]}>
        <Empty className='rounded-lg border'>Phiếu không tồn tại hoặc bạn không được giao xử lý phiếu này (BR-27).</Empty>
      </PageShell>
    )

  const cu = db.customers.find((x) => x.id === c.customerId)!
  const dev = db.devices.find((x) => x.id === c.deviceId)!
  const actions = nextActions(me, c, wo)
  const sla = slaInfo(c)

  return (
    <PageShell
      title={
        <span className='flex flex-wrap items-center gap-x-3 gap-y-1'>
          {c.code}
          <StatusBadge status={c.status} />
        </span>
      }
      description={`${DEVICE_KIND_LABEL[dev.kind]} ${dev.brand} ${dev.model}${canSeeCustomer(me) ? ` · ${cu.name}` : ''}`}
      crumbs={[{ label: me.role === 'KTV' ? 'Việc của tôi' : 'Danh sách phiếu', to: me.role === 'KTV' ? '/viec-cua-toi' : me.role === 'KHO' ? '/kho/yeu-cau' : me.role === 'QC' ? '/kiem-dinh' : '/phieu' }, { label: c.code }]}
    >
      <Stepper c={c} />

      <div className='grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start'>
        <Tabs defaultValue='overview' className='min-w-0'>
          <div className='overflow-x-auto'>
            <TabsList>
              <TabsTrigger value='overview'>Tổng quan</TabsTrigger>
              <TabsTrigger value='diag'>Chẩn đoán</TabsTrigger>
              <TabsTrigger value='warranty'>Bảo hành và báo giá</TabsTrigger>
              <TabsTrigger value='wo'>Lệnh sửa chữa</TabsTrigger>
              <TabsTrigger value='qc'>Kiểm tra chất lượng</TabsTrigger>
              <TabsTrigger value='handover'>Bàn giao</TabsTrigger>
              <TabsTrigger value='history'>Lịch sử</TabsTrigger>
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
            {wo ? <WoTab c={c} wo={wo} /> : <Empty className='rounded-lg border'>Chưa có lệnh sửa chữa. Lệnh được lập khi phương án sửa được xác nhận.</Empty>}
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
          <Section title='Việc cần làm'>
            {actions.length === 0 ? (
              <p className='text-muted-foreground text-sm'>
                {CASE_STATUS[c.status].owner.length
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
                    <Tooltip key={a.key}>
                      <TooltipTrigger asChild>
                        <span tabIndex={0} className='grid'>
                          <Button variant={a.primary ? 'default' : 'outline'} disabled>
                            {a.label}
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>{a.disabled}</TooltipContent>
                    </Tooltip>
                  ) : (
                    <Button key={a.key} variant={a.primary ? 'default' : 'outline'} onClick={() => setAction(a.key)}>
                      {a.label}
                    </Button>
                  )
                )}
                {actions.filter((a) => a.disabled).map((a) => (
                  <p key={a.key + 'r'} className='text-muted-foreground text-xs'>
                    {a.label}: {a.disabled}
                  </p>
                ))}
              </div>
            )}
          </Section>
          <Section title='Thời hạn xử lý'>
            <div className='grid gap-2 text-sm'>
              <SlaBadge c={c} />
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

function Stepper({ c }: { c: WarrantyCase }) {
  const idx = STAGES.findIndex((s) => s.statuses.includes(c.status))
  if (c.status === 'CANCELLED') return <p className='text-muted-foreground text-sm'>Phiếu đã hủy: {c.cancelReason}</p>
  return (
    <ol className='flex flex-wrap gap-x-1 gap-y-2 text-sm' aria-label='Tiến trình phiếu'>
      {STAGES.map((s, i) => {
        const done = i < idx || c.status === 'COMPLETED'
        const cur = i === idx && c.status !== 'COMPLETED'
        return (
          <li key={s.label} className='flex items-center gap-1'>
            <span className={cn('flex items-center gap-1.5 rounded-full px-2.5 py-1', cur && 'bg-primary text-primary-foreground font-medium', done && 'text-foreground', !done && !cur && 'text-muted-foreground')} aria-current={cur ? 'step' : undefined}>
              {done ? <Check className='size-3.5' aria-hidden /> : <Circle className='size-3' aria-hidden />}
              {s.label}
            </span>
            {i < STAGES.length - 1 && <span className='bg-border h-px w-3' aria-hidden />}
          </li>
        )
      })}
    </ol>
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
        <div className='rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950'>
          <span className='font-medium'>Đang chờ khách bổ sung:</span> {c.infoRequest}
        </div>
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
            ['Ảnh', c.photos.length ? `${c.photos.length} ảnh: ${c.photos.join(', ')}` : 'Chưa có'],
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
  if (!d) return <Empty className='rounded-lg border'>{c.diagnosisTechId ? `${name(c.diagnosisTechId)} đang chẩn đoán.` : 'Chưa giao kỹ thuật viên chẩn đoán.'}</Empty>
  return (
    <Section title='Biên bản chẩn đoán' description={`${name(d.by)} · ${fmtDateTime(d.at)}`}>
      <InfoList
        rows={[
          ['Nguyên nhân', `${CAUSE_LABEL[d.causeType]}. ${d.cause}`],
          ['Mức độ', { NHE: 'Nhẹ', TRUNG_BINH: 'Trung bình', NANG: 'Nặng' }[d.severity]],
          ['Sửa được', d.repairable ? 'Có' : 'Không sửa được tại trung tâm'],
          ['Phương án', d.plan || '—'],
          ['Công việc', d.tasks.map((t) => `${t.title} (${fmtMinutes(t.minutes)})`).join('; ') || '—'],
          ['Linh kiện', d.parts.map((p) => `${db.parts.find((x) => x.id === p.partId)?.name} × ${p.qty}`).join('; ') || 'Không cần'],
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
          <Section key={q.version} title={`Báo giá v${q.version}`} actions={<Pill tone={QUOTE_STATUS[q.status][1]}>{QUOTE_STATUS[q.status][0]}</Pill>}>
            <table className='w-full text-sm'>
              <tbody>
                {q.items.map((i, k) => (
                  <tr key={k} className='border-b'>
                    <td className='py-1.5'>{i.label}</td>
                    <td className='py-1.5 text-right tabular-nums'>
                      {i.qty} × {fmtMoney(i.unitPrice)}
                    </td>
                  </tr>
                ))}
                <tr className='border-b'>
                  <td className='py-1.5'>Tiền công</td>
                  <td className='py-1.5 text-right tabular-nums'>{fmtMoney(q.labor)}</td>
                </tr>
                <tr>
                  <td className='py-1.5 font-semibold'>Tổng</td>
                  <td className='py-1.5 text-right font-semibold tabular-nums'>{fmtMoney(q.total)}</td>
                </tr>
              </tbody>
            </table>
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
      <Section title={`${wo.code}`} description={`Kỹ thuật viên: ${name(wo.technicianId)} · Lập ${fmtDateTime(wo.createdAt)}${wo.startedAt ? ` · Bắt đầu ${fmtDateTime(wo.startedAt)}` : ''}`}>
        <ul className='grid gap-2'>
          {wo.tasks.map((t) => (
            <li key={t.id} className='flex items-center gap-3 text-sm'>
              <Checkbox checked={t.done} disabled={!mine || toggle.isPending} onCheckedChange={() => toggle.mutate([me, wo.id, t.id])} aria-label={t.title} />
              <span className={cn('flex-1', t.done && 'text-muted-foreground line-through')}>{t.title}</span>
              <span className='text-muted-foreground text-xs'>{fmtMinutes(t.minutes)}</span>
            </li>
          ))}
        </ul>
      </Section>
      <Section title='Linh kiện'>
        <WoParts wo={wo} />
      </Section>
      <Section title='Nhật ký sửa chữa'>
        {mine && (
          <form
            className='mb-3 flex gap-2'
            onSubmit={(e) => {
              e.preventDefault()
              if (log.trim()) addLog.mutate([me, wo.id, log], { onSuccess: () => setLog('') })
            }}
          >
            <Input aria-label='Ghi nhật ký' value={log} onChange={(e) => setLog(e.target.value)} placeholder='Đã thay keo tản nhiệt, nhiệt độ ổn định 65°C' />
            <Button type='submit' variant='outline' disabled={addLog.isPending}>
              Ghi
            </Button>
          </form>
        )}
        {wo.logs.length === 0 ? (
          <p className='text-muted-foreground text-sm'>Chưa có ghi chép.</p>
        ) : (
          <ul className='grid gap-2 text-sm'>
            {wo.logs
              .slice()
              .reverse()
              .map((l, i) => (
                <li key={i}>
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
  if (!c.qc.length) return <Empty className='rounded-lg border'>Chưa kiểm tra chất lượng.</Empty>
  return (
    <div className='grid gap-4'>
      {c.qc
        .slice()
        .reverse()
        .map((q) => (
          <Section key={q.round} title={`Lần ${q.round}`} description={`${name(q.by)} · ${fmtDateTime(q.at)}`} actions={<Pill tone={q.pass ? 'done' : 'bad'}>{q.pass ? 'Đạt' : 'Không đạt'}</Pill>}>
            {q.defect && <p className='mb-2 text-sm'>Lỗi còn tồn tại: {q.defect}</p>}
            <ul className='grid gap-1 text-sm'>
              {q.items.map((i) => (
                <li key={i.label} className='flex gap-2'>
                  {i.pass ? <Check className='mt-0.5 size-4 text-emerald-600' aria-label='Đạt' /> : <Circle className='text-destructive mt-0.5 size-4' aria-label='Không đạt' />}
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
        !c.returnConclusion && <Empty className='rounded-lg border'>Chưa bàn giao.</Empty>
      )}
    </div>
  )
}

function HistoryTab({ c }: { c: WarrantyCase }) {
  const name = useName()
  return (
    <Section title='Lịch sử xử lý' description='Không ai sửa được lịch sử (BR-28).'>
      <ol className='grid gap-3'>
        {c.events
          .slice()
          .reverse()
          .map((e, i) => (
            <li key={i} className='border-l-2 ps-3 text-sm'>
              <div className='font-medium'>{e.action}</div>
              {e.to && (
                <div className='text-muted-foreground'>
                  {e.from ? `${CASE_STATUS[e.from].label} → ` : ''}
                  {CASE_STATUS[e.to].label}
                </div>
              )}
              {e.note && <div>{e.note}</div>}
              <div className='text-muted-foreground text-xs'>
                {name(e.by)} · {fmtDateTime(e.at)}
              </div>
            </li>
          ))}
      </ol>
    </Section>
  )
}
