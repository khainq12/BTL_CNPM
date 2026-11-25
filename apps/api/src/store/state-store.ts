import { Inject, Injectable, Logger } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { ApiError, emptyDb, PUBLIC_STEP_OF, setHolidays, type Approval, type Db, type WarrantyCase } from '@woms/domain'
import { randomUUID } from 'node:crypto'
import { PrismaService } from '../prisma.service'
import * as M from './mappers'

type Tx = Prisma.TransactionClient

// Phạm vi dữ liệu một lệnh cần nạp. Lệnh nghiệp vụ (@woms/domain/commands) chỉ đọc các phần này, nên không phải nạp cả CSDL.
export type Scope = {
  caseId?: string
  woId?: string
  approvalId?: string
  complaintId?: string
  idempotencyKey?: string
  intake?: { phone?: string; serial?: string; customerId?: string; deviceId?: string }
}

// Khóa tư vấn của PostgreSQL: mọi lệnh ghi chạy tuần tự (một trung tâm bảo hành, lưu lượng thấp). Cùng với kiểm tra
// version (EX-14) điều này loại bỏ tranh chấp khi hai người cùng giữ linh kiện cuối cùng hay cùng chuyển trạng thái (NFR-02).
const WRITE_LOCK = 7_340_001

export type OutboxDraft = { type: string; aggregateId: string; payload: Record<string, unknown> }

@Injectable()
export class StateStore {
  private readonly log = new Logger('StateStore')

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  // Unit of Work: nạp → chạy lệnh trên bản trong bộ nhớ → ghi phần thay đổi + sự kiện outbox, tất cả trong một transaction.
  async execute<T>(scope: Scope, fn: (db: Db) => T): Promise<T> {
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${WRITE_LOCK})`
        const db = await this.load(tx, scope)
        const before = structuredClone(db)
        setHolidays(db.holidays.map((h) => h.date))
        const result = fn(db)
        await this.persist(tx, before, db)
        return result
      },
      { maxWait: 10_000, timeout: 20_000 }
    )
  }

  // Ảnh chụp đầy đủ để đọc (GET /workspace, báo cáo). REPEATABLE READ để các bảng nhất quán với nhau.
  async snapshot(opts: { auditLimit?: number; stockMoveLimit?: number } = {}): Promise<Db> {
    return this.prisma.$transaction(
      async (tx) => {
        const [users, customers, devices, parts, cases, workOrders, approvals, complaints, stockMoves, audit, holidays, counters] = await Promise.all([
          tx.user.findMany({ orderBy: { createdAt: 'asc' } }),
          tx.customer.findMany(),
          tx.device.findMany(),
          tx.part.findMany({ orderBy: { sku: 'asc' } }),
          tx.warrantyCase.findMany({ include: { events: true }, orderBy: { createdAt: 'desc' } }),
          tx.workOrder.findMany(),
          tx.approval.findMany({ orderBy: { requestedAt: 'desc' } }),
          tx.complaint.findMany({ orderBy: { createdAt: 'desc' } }),
          tx.stockMove.findMany({ orderBy: { at: 'desc' }, take: opts.stockMoveLimit ?? 500 }),
          tx.auditLog.findMany({ orderBy: { at: 'desc' }, take: opts.auditLimit ?? 1000 }),
          tx.holiday.findMany({ orderBy: { date: 'asc' } }),
          tx.counter.findMany(),
        ])
        const db = emptyDb()
        db.users = users.map(M.userFromRow)
        db.customers = customers.map(M.customerFromRow)
        db.devices = devices.map(M.deviceFromRow)
        db.parts = parts.map(M.partFromRow)
        db.cases = cases.map(M.caseFromRow)
        db.workOrders = workOrders.map(M.woFromRow)
        db.approvals = approvals.map(M.approvalFromRow)
        db.complaints = complaints.map(M.complaintFromRow)
        db.stockMoves = stockMoves.map((s) =>
          M.plain({ ...s, at: s.at.toISOString(), woCode: s.woCode ?? undefined, note: s.note ?? undefined })
        ) as Db['stockMoves']
        db.audit = audit.map((a) => M.plain({ ...a, at: a.at.toISOString(), detail: a.detail ?? undefined })) as Db['audit']
        db.holidays = holidays
        db.counters = countersFrom(counters)
        return db
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead }
    )
  }

  async snapshotUser(username: string) {
    const r = await this.prisma.user.findFirst({ where: { username: { equals: String(username ?? '').trim(), mode: 'insensitive' } } })
    return r ? M.userFromRow(r) : undefined
  }

  private async load(tx: Tx, s: Scope): Promise<Db> {
    const db = emptyDb()
    const [users, parts, holidays, counters] = await Promise.all([
      tx.user.findMany(),
      tx.part.findMany(),
      tx.holiday.findMany({ orderBy: { date: 'asc' } }),
      tx.counter.findMany(),
    ])
    db.users = users.map(M.userFromRow)
    db.parts = parts.map(M.partFromRow)
    db.holidays = holidays
    db.counters = countersFrom(counters)

    const caseIds = new Set<string>()
    if (s.caseId) caseIds.add(s.caseId)
    if (s.woId) {
      const w = await tx.workOrder.findUnique({ where: { id: s.woId }, select: { caseId: true } })
      if (w) caseIds.add(w.caseId)
    }
    let approvalById: Approval | undefined
    if (s.approvalId) {
      const a = await tx.approval.findUnique({ where: { id: s.approvalId } })
      if (a) {
        approvalById = M.approvalFromRow(a)
        if (a.caseId) caseIds.add(a.caseId)
        if (a.woId) {
          const w = await tx.workOrder.findUnique({ where: { id: a.woId }, select: { caseId: true } })
          if (w) caseIds.add(w.caseId)
        }
      }
    }
    if (s.complaintId) {
      const q = await tx.complaint.findUnique({ where: { id: s.complaintId } })
      if (q) db.complaints.push(M.complaintFromRow(q))
    }
    if (s.idempotencyKey) {
      const k = await tx.idempotencyKey.findUnique({ where: { key: s.idempotencyKey } })
      if (k) {
        db.idempotency[k.key] = k.caseId
        caseIds.add(k.caseId)
      }
    }

    // Đề nghị còn hiệu lực (kho tính số đang chờ mua từ đây) và đề nghị gắn với phiếu/lệnh đang xử lý.
    const ids = [...caseIds]
    const woRows = ids.length ? await tx.workOrder.findMany({ where: { caseId: { in: ids } } }) : []
    const woIds = woRows.map((w) => w.id)
    const approvals = await tx.approval.findMany({
      where: {
        OR: [
          { status: 'CHO_DUYET' },
          { type: 'MUA_LINH_KIEN', status: 'DA_DUYET' },
          ...(ids.length ? [{ caseId: { in: ids } }] : []),
          ...(woIds.length ? [{ woId: { in: woIds } }] : []),
        ],
      },
    })
    db.approvals = approvals.map(M.approvalFromRow)
    if (approvalById && !db.approvals.some((a) => a.id === approvalById.id)) db.approvals.push(approvalById)

    const caseRows = ids.length ? await tx.warrantyCase.findMany({ where: { id: { in: ids } }, include: { events: true } }) : []
    db.cases = caseRows.map(M.caseFromRow)
    db.workOrders = woRows.map(M.woFromRow)

    const customerIds = new Set(db.cases.map((c) => c.customerId))
    const deviceIds = new Set(db.cases.map((c) => c.deviceId))
    const or: Prisma.CustomerWhereInput[] = [{ id: { in: [...customerIds] } }]
    const dor: Prisma.DeviceWhereInput[] = [{ id: { in: [...deviceIds] } }]
    if (s.intake) {
      if (s.intake.customerId) or.push({ id: s.intake.customerId })
      if (s.intake.phone) or.push({ phone: s.intake.phone })
      if (s.intake.deviceId) dor.push({ id: s.intake.deviceId })
      if (s.intake.serial) dor.push({ serial: { equals: s.intake.serial, mode: 'insensitive' } })
    }
    const devices = await tx.device.findMany({ where: { OR: dor } })
    for (const d of devices) customerIds.add(d.customerId)
    const customers = await tx.customer.findMany({ where: { OR: [...or, { id: { in: [...customerIds] } }] } })
    db.customers = customers.map(M.customerFromRow)
    db.devices = devices.map(M.deviceFromRow)
    return db
  }

  // Ghi phần khác nhau giữa trước/sau. Bảng chỉ-thêm (lịch sử, biến động kho, nhật ký) ghi các dòng mới.
  async persist(tx: Tx, before: Db, after: Db) {
    const outbox: OutboxDraft[] = []
    const changed = <T extends { id: string }>(a: T[], b: T[]) => {
      const old = new Map(a.map((x) => [x.id, JSON.stringify(x)]))
      return {
        created: b.filter((x) => !old.has(x.id)),
        updated: b.filter((x) => old.has(x.id) && old.get(x.id) !== JSON.stringify(x)),
      }
    }

    const users = changed(before.users, after.users)
    for (const u of users.created) await tx.user.create({ data: M.userToRow(u) })
    for (const u of users.updated) await tx.user.update({ where: { id: u.id }, data: M.userToRow(u) })

    const customers = changed(before.customers, after.customers)
    for (const c of customers.created) await tx.customer.create({ data: M.customerToRow(c) })
    for (const c of customers.updated) await tx.customer.update({ where: { id: c.id }, data: M.customerToRow(c) })

    const devices = changed(before.devices, after.devices)
    for (const d of devices.created) await tx.device.create({ data: M.deviceToRow(d) })
    for (const d of devices.updated) await tx.device.update({ where: { id: d.id }, data: M.deviceToRow(d) })

    const parts = changed(before.parts, after.parts)
    for (const p of parts.created) await tx.part.create({ data: M.partToRow(p) })
    for (const p of parts.updated) await tx.part.update({ where: { id: p.id }, data: M.partToRow(p) })

    const oldCases = new Map(before.cases.map((c) => [c.id, c]))
    const cases = changed(before.cases, after.cases)
    for (const c of cases.created) {
      await tx.warrantyCase.create({ data: M.caseToRow(c) })
      outbox.push({ type: 'CaseCreated', aggregateId: c.id, payload: { code: c.code, status: c.status, channel: c.channel } })
    }
    for (const c of cases.updated) {
      const prev = oldCases.get(c.id)!
      // Khóa lạc quan ở tầng CSDL: chỉ ghi khi version trong DB đúng bằng version lúc nạp.
      const r = await tx.warrantyCase.updateMany({ where: { id: c.id, version: prev.version }, data: M.caseToRow(c) })
      if (r.count !== 1) throw new ApiError(409, `Phiếu ${c.code} vừa được người khác cập nhật. Tải lại để xem thay đổi mới nhất.`)
      if (prev.status !== c.status) outbox.push(statusChanged(prev, c))
    }
    const events = after.cases.flatMap((c) => M.caseEventRows(c, oldCases.get(c.id)?.events.length ?? 0))
    if (events.length) await tx.caseEvent.createMany({ data: events })

    const wos = changed(before.workOrders, after.workOrders)
    for (const w of wos.created) await tx.workOrder.create({ data: M.woToRow(w) })
    for (const w of wos.updated) await tx.workOrder.update({ where: { id: w.id }, data: M.woToRow(w) })

    const aps = changed(before.approvals, after.approvals)
    for (const a of aps.created) {
      await tx.approval.create({ data: M.approvalToRow(a) })
      outbox.push({ type: 'ApprovalRequested', aggregateId: a.id, payload: { type: a.type, title: a.title, caseId: a.caseId } })
    }
    for (const a of aps.updated) await tx.approval.update({ where: { id: a.id }, data: M.approvalToRow(a) })

    const qs = changed(before.complaints, after.complaints)
    for (const q of qs.created) await tx.complaint.create({ data: M.complaintToRow(q) })
    for (const q of qs.updated) await tx.complaint.update({ where: { id: q.id }, data: M.complaintToRow(q) })

    const oldMoves = new Set(before.stockMoves.map((m) => m.id))
    const moves = after.stockMoves.filter((m) => !oldMoves.has(m.id))
    if (moves.length) await tx.stockMove.createMany({ data: moves.map((m) => ({ ...m, at: new Date(m.at), woCode: m.woCode ?? null, note: m.note ?? null })) })

    const oldAudit = new Set(before.audit.map((a) => a.id))
    const audit = after.audit.filter((a) => !oldAudit.has(a.id))
    if (audit.length) await tx.auditLog.createMany({ data: audit.map((a) => ({ ...a, at: new Date(a.at), detail: a.detail ?? null })) })

    const newKeys = Object.entries(after.idempotency).filter(([k]) => !Object.hasOwn(before.idempotency, k))
    if (newKeys.length) await tx.idempotencyKey.createMany({ data: newKeys.map(([key, caseId]) => ({ key, caseId })) })

    for (const name of ['case', 'wo', 'complaint'] as const) {
      if (before.counters[name] !== after.counters[name])
        await tx.counter.upsert({ where: { name }, create: { name, value: after.counters[name] }, update: { value: after.counters[name] } })
    }

    const oldHol = new Map(before.holidays.map((h) => [h.date, h.name]))
    const newHol = new Map(after.holidays.map((h) => [h.date, h.name]))
    for (const [d] of oldHol) if (!newHol.has(d)) await tx.holiday.delete({ where: { date: d } })
    for (const [d, name] of newHol) if (oldHol.get(d) !== name) await tx.holiday.upsert({ where: { date: d }, create: { date: d, name }, update: { name } })

    if (outbox.length)
      await tx.outboxEvent.createMany({
        data: outbox.map((o) => ({ id: randomUUID(), type: o.type, aggregateId: o.aggregateId, payload: o.payload as Prisma.InputJsonValue })),
      })
    if (outbox.length) this.log.debug(`outbox +${outbox.length}`)
  }
}

function statusChanged(prev: WarrantyCase, c: WarrantyCase): OutboxDraft {
  return {
    type: 'CaseStatusChanged',
    aggregateId: c.id,
    payload: {
      code: c.code,
      from: prev.status,
      to: c.status,
      publicStepFrom: PUBLIC_STEP_OF[prev.status],
      publicStepTo: PUBLIC_STEP_OF[c.status],
      planConfirmedAt: c.sla.planConfirmedAt,
    },
  }
}

function countersFrom(rows: { name: string; value: number }[]): Db['counters'] {
  const m = Object.fromEntries(rows.map((r) => [r.name, r.value]))
  return { case: m.case ?? 0, wo: m.wo ?? 0, complaint: m.complaint ?? 0 }
}
