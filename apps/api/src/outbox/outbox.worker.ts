import { Inject, Injectable, Logger, type OnApplicationBootstrap, type OnModuleDestroy } from '@nestjs/common'
import { OPEN_STATUSES, PUBLIC_NOTE, PUBLIC_STEPS, setHolidays, slaInfo, type CaseStatus } from '@woms/domain'
import { randomUUID } from 'node:crypto'
import { CONFIG, type AppConfig } from '../config'
import { PrismaService } from '../prisma.service'
import * as M from '../store/mappers'

type OutboxRow = { id: string; type: string; aggregateId: string; payload: Record<string, unknown>; attempts: number }

// Event Handler theo Transactional Outbox (thiết kế của Đạt): chạy nền, không nằm trong luồng API của người dùng.
// - Đọc sự kiện chưa xử lý, khóa từng dòng (FOR UPDATE SKIP LOCKED) để nhiều tiến trình chạy song song không xử lý trùng.
// - Xử lý: thông báo cho khách (kênh SMS mô phỏng), ghi mốc SLA, cảnh báo nội bộ.
// - Đánh dấu đã xử lý trong cùng transaction. Thông báo có event_id duy nhất nên xử lý lại không tạo bản thứ hai (TC-052).
@Injectable()
export class OutboxWorker implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly log = new Logger('Outbox')
  private timers: NodeJS.Timeout[] = []
  private running = false

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CONFIG) private readonly config: AppConfig
  ) {}

  onApplicationBootstrap() {
    if (this.config.OUTBOX_POLL_MS > 0) this.timers.push(setInterval(() => void this.tick(), this.config.OUTBOX_POLL_MS))
    if (this.config.SLA_SCAN_MS > 0) this.timers.push(setInterval(() => void this.scanSla().catch((e) => this.log.error(e)), this.config.SLA_SCAN_MS))
  }

  onModuleDestroy() {
    this.timers.forEach(clearInterval)
  }

  private async tick() {
    if (this.running) return
    this.running = true
    try {
      await this.drain()
    } catch (e) {
      this.log.error('Lỗi khi xử lý outbox', e as Error)
    } finally {
      this.running = false
    }
  }

  // Xử lý hết sự kiện đang chờ. Trả về số sự kiện đã xử lý (dùng trong kiểm thử).
  async drain(batch = 50): Promise<number> {
    let done = 0
    for (;;) {
      const pending = await this.prisma.outboxEvent.findMany({ where: { processedAt: null, attempts: { lt: 5 } }, orderBy: { createdAt: 'asc' }, take: batch, select: { id: true } })
      if (!pending.length) return done
      for (const { id } of pending) if (await this.processOne(id)) done += 1
      if (pending.length < batch) return done
    }
  }

  private async processOne(id: string): Promise<boolean> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<OutboxRow[]>`
          SELECT id, type, aggregate_id AS "aggregateId", payload, attempts FROM outbox_events
          WHERE id = ${id} AND processed_at IS NULL FOR UPDATE SKIP LOCKED`
        const ev = rows[0]
        if (!ev) return false
        const notes: { channel: string; message: string; key?: string }[] = []
        const audit: { action: string; detail?: string; ref: string }[] = []
        const p = ev.payload as Record<string, string | number | undefined>
        switch (ev.type) {
          case 'CaseCreated':
            notes.push({
              channel: 'SMS',
              message:
                p.channel === 'ONLINE'
                  ? `WOMS: Đã ghi nhận yêu cầu ${p.code}. Vui lòng mang thiết bị tới trung tâm, đọc mã phiếu khi tiếp nhận.`
                  : `WOMS: Trung tâm đã tiếp nhận thiết bị, mã phiếu ${p.code}. Tra cứu tiến độ bằng mã phiếu và số điện thoại.`,
            })
            break
          case 'CaseStatusChanged': {
            const to = p.to as CaseStatus
            const important = ['WAITING_INFORMATION', 'QUOTED', 'RETURN_PENDING', 'READY_FOR_DELIVERY', 'COMPLETED', 'CANCELLED'].includes(to)
            if (p.publicStepFrom !== p.publicStepTo || important)
              notes.push({ channel: 'SMS', message: `WOMS: Phiếu ${p.code} – ${PUBLIC_STEPS[Number(p.publicStepTo)]}. ${PUBLIC_NOTE[to] ?? ''}`.trim() })
            // Hạn 3 ngày làm việc bắt đầu khi phương án sửa được xác nhận (PARAM-08): ghi mốc khởi tạo SLA.
            if (p.planConfirmedAt && ['ELIGIBILITY_REVIEW', 'QUOTED'].includes(String(p.from)) && ['WO_CREATED', 'READY_TO_REPAIR'].includes(to))
              audit.push({ ref: String(p.code), action: 'Khởi tạo SLA sửa chữa (SlaStarted)', detail: `Bắt đầu tính hạn 3 ngày làm việc từ ${p.planConfirmedAt}` })
            break
          }
          case 'ApprovalRequested':
            notes.push({ channel: 'NOI_BO', message: `Đề nghị chờ quản lý duyệt: ${p.title}` })
            break
          default:
            this.log.warn(`Bỏ qua loại sự kiện chưa hỗ trợ: ${ev.type}`)
        }
        if (notes.length)
          await tx.notification.createMany({
            data: notes.map((n, i) => ({ id: randomUUID(), eventId: `${ev.id}:${i}`, caseId: ev.type === 'ApprovalRequested' ? String(p.caseId ?? '') : ev.aggregateId, channel: n.channel, message: n.message })),
            skipDuplicates: true,
          })
        if (audit.length)
          await tx.auditLog.createMany({ data: audit.map((a) => ({ id: `log-${randomUUID().slice(0, 12)}`, at: new Date(), by: 'he-thong', entity: 'PHIEU', ref: a.ref, action: a.action, detail: a.detail ?? null })) })
        await tx.outboxEvent.update({ where: { id: ev.id }, data: { processedAt: new Date(), attempts: ev.attempts + 1 } })
        return true
      })
    } catch (e) {
      await this.prisma.outboxEvent.update({ where: { id }, data: { attempts: { increment: 1 }, lastError: String((e as Error).message).slice(0, 500) } }).catch(() => undefined)
      this.log.error(`Sự kiện ${id} lỗi`, e as Error)
      return false
    }
  }

  // Quét định kỳ: phiếu sắp quá hạn (còn ≤ 4 giờ làm việc) hoặc đã quá hạn → cảnh báo nội bộ một lần cho mỗi hạn (FR-06, TC-039).
  async scanSla(now = Date.now()): Promise<number> {
    const [rows, holidays] = await Promise.all([
      this.prisma.warrantyCase.findMany({ where: { status: { in: OPEN_STATUSES } }, include: { events: true } }),
      this.prisma.holiday.findMany(),
    ])
    setHolidays(holidays.map((h) => h.date))
    const data = rows
      .map(M.caseFromRow)
      .map((c) => ({ c, s: slaInfo(c, now) }))
      .filter(({ s }) => s.kind === 'soon' || s.kind === 'overdue')
      .map(({ c, s }) => ({
        id: randomUUID(),
        eventId: `sla:${c.id}:${s.kind}:${s.dueAt}`,
        caseId: c.id,
        channel: 'NOI_BO',
        message: `${c.code}: ${s.kind === 'overdue' ? 'đã quá hạn xử lý' : 'sắp quá hạn xử lý'} (${s.label}).`,
      }))
    if (!data.length) return 0
    const r = await this.prisma.notification.createMany({ data, skipDuplicates: true })
    return r.count
  }
}
