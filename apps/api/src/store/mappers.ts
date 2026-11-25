import type { Prisma } from '@prisma/client'
import type { Approval, Complaint, Customer, Device, Part, User, WarrantyCase, WorkOrder } from '@woms/domain'

// Chuyển giữa dòng PostgreSQL và đối tượng miền (@woms/domain/types). Thời gian: DB lưu timestamptz (UTC), miền dùng chuỗi ISO.

type Row<T> = T extends (infer U)[] ? U : T
const iso = (d: Date | null | undefined) => (d ? d.toISOString() : undefined)
const date = (s: string | undefined) => (s ? new Date(s) : null)
const json = (v: unknown) => v as Prisma.InputJsonValue
// Bỏ các khóa undefined để so sánh JSON ổn định giữa lúc nạp và lúc ghi.
export const plain = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T

// ---------- User: trên máy chủ, User.password giữ chuỗi băm bcrypt (không bao giờ trả ra ngoài) ----------
export const userFromRow = (r: Row<Prisma.UserGetPayload<object>>): User => ({
  id: r.id,
  username: r.username,
  password: r.passwordHash,
  name: r.name,
  role: r.role,
  phone: r.phone,
  active: r.active,
})
export const userToRow = (u: User) => ({ id: u.id, username: u.username, passwordHash: u.password, name: u.name, role: u.role, phone: u.phone ?? '', active: u.active })

export const customerFromRow = (r: { id: string; name: string; phone: string; email: string | null }): Customer =>
  plain({ id: r.id, name: r.name, phone: r.phone, email: r.email ?? undefined })
export const customerToRow = (c: Customer) => ({ id: c.id, name: c.name, phone: c.phone, email: c.email ?? null })

export const deviceFromRow = (r: Row<Prisma.DeviceGetPayload<object>>): Device =>
  plain({
    id: r.id,
    customerId: r.customerId,
    kind: r.kind as Device['kind'],
    brand: r.brand,
    model: r.model,
    serial: r.serial,
    purchaseDate: iso(r.purchaseDate),
    warrantyMonths: r.warrantyMonths,
    policyCode: r.policyCode,
  })
export const deviceToRow = (d: Device) => ({
  id: d.id,
  customerId: d.customerId,
  kind: d.kind,
  brand: d.brand,
  model: d.model,
  serial: d.serial,
  purchaseDate: date(d.purchaseDate),
  warrantyMonths: d.warrantyMonths,
  policyCode: d.policyCode,
})

export const partFromRow = (r: Row<Prisma.PartGetPayload<object>>): Part => ({ ...r })
export const partToRow = (p: Part) => ({ ...p })

// ---------- WarrantyCase: cột tìm kiếm + data JSONB; events nằm ở bảng case_events ----------
type CaseRow = Prisma.WarrantyCaseGetPayload<{ include: { events: true } }>
export function caseFromRow(r: CaseRow): WarrantyCase {
  const data = (r.data ?? {}) as Record<string, unknown>
  return plain({
    ...data,
    id: r.id,
    code: r.code,
    version: r.version,
    status: r.status,
    customerId: r.customerId,
    deviceId: r.deviceId,
    channel: r.channel,
    createdAt: r.createdAt.toISOString(),
    events: [...r.events]
      .sort((a, b) => a.seq - b.seq)
      .map((e) => plain({ at: e.at.toISOString(), by: e.by, action: e.action, from: e.fromStatus ?? undefined, to: e.toStatus ?? undefined, note: e.note ?? undefined })),
  }) as WarrantyCase
}
export function caseToRow(c: WarrantyCase) {
  const { id, code, version, status, customerId, deviceId, channel, createdAt, events: _events, ...rest } = c
  return { id, code, version, status, customerId, deviceId, channel, createdAt: new Date(createdAt), data: json(plain(rest)) }
}
export const caseEventRows = (c: WarrantyCase, fromSeq: number) =>
  c.events.slice(fromSeq).map((e, i) => ({
    caseId: c.id,
    seq: fromSeq + i + 1,
    at: new Date(e.at),
    by: e.by,
    action: e.action,
    fromStatus: e.from ?? null,
    toStatus: e.to ?? null,
    note: e.note ?? null,
  }))

export function woFromRow(r: Row<Prisma.WorkOrderGetPayload<object>>): WorkOrder {
  return plain({ ...((r.data ?? {}) as object), id: r.id, code: r.code, caseId: r.caseId, technicianId: r.technicianId ?? undefined, createdAt: r.createdAt.toISOString() }) as WorkOrder
}
export function woToRow(w: WorkOrder) {
  const { id, code, caseId, technicianId, createdAt, ...rest } = w
  return { id, code, caseId, technicianId: technicianId ?? null, createdAt: new Date(createdAt), data: json(plain(rest)) }
}

export function approvalFromRow(r: Row<Prisma.ApprovalGetPayload<object>>): Approval {
  return plain({
    ...((r.data ?? {}) as object),
    id: r.id,
    type: r.type,
    status: r.status,
    caseId: r.caseId ?? undefined,
    woId: r.woId ?? undefined,
    partId: r.partId ?? undefined,
    requestedBy: r.requestedBy,
    requestedAt: r.requestedAt.toISOString(),
  }) as Approval
}
export function approvalToRow(a: Approval) {
  const { id, type, status, caseId, woId, partId, requestedBy, requestedAt, ...rest } = a
  return { id, type, status, caseId: caseId ?? null, woId: woId ?? null, partId: partId ?? null, requestedBy, requestedAt: new Date(requestedAt), data: json(plain(rest)) }
}

export function complaintFromRow(r: Row<Prisma.ComplaintGetPayload<object>>): Complaint {
  return plain({ ...((r.data ?? {}) as object), id: r.id, code: r.code, caseId: r.caseId, status: r.status, createdAt: r.createdAt.toISOString() }) as Complaint
}
export function complaintToRow(q: Complaint) {
  const { id, code, caseId, status, createdAt, ...rest } = q
  return { id, code, caseId, status, createdAt: new Date(createdAt), data: json(plain(rest)) }
}
