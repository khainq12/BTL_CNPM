import * as C from '@/domain/commands'
import type { Db } from '@/domain/db'
import { DEMO_PASSWORD } from '@/domain/seed'
import type { User } from '@/domain/types'
import { loadDb, saveDb } from '@/mock/db'

// Bản chạy thử không cần backend: chạy đúng các lệnh nghiệp vụ dùng chung (@woms/domain) trên dữ liệu trong localStorage.
// Mỗi lệnh làm trên bản sao, chỉ lưu khi không lỗi (giống một transaction).

const wait = (ms = 350) => new Promise((r) => setTimeout(r, ms + Math.random() * 250))

async function run<T>(fn: (db: Db) => T, ms?: number): Promise<T> {
  await wait(ms)
  const db = structuredClone(loadDb())
  const r = fn(db)
  saveDb(db)
  return r
}

type Args<F> = F extends (db: Db, ...rest: infer R) => unknown ? R : never
const cmd =
  <F extends (db: Db, ...rest: never[]) => unknown>(f: F, ms?: number) =>
  (...a: Args<F>) =>
    run((db) => (f as (db: Db, ...rest: Args<F>) => ReturnType<F>)(db, ...a), ms)

export const login = (username: string, password: string) =>
  run((db) => {
    const u = C.findLoginUser(db, username)
    return C.recordLogin(db, u, !!u && u.password === password)
  }, 500)

export function logAudit(user: User, action: string) {
  const db = structuredClone(loadDb())
  C.logAudit(db, user, action)
  saveDb(db)
}

export const changePassword = (user: User, current: string, next: string) =>
  run((db) => {
    const u = C.changePassword(db, user, db.users.find((x) => x.id === user.id)?.password === current, next)
    u.password = next
  })

export const saveUser = (user: User, u: Parameters<typeof C.saveUser>[2]) =>
  run((db) => {
    const saved = C.saveUser(db, user, u)
    if (!saved.password) saved.password = DEMO_PASSWORD
    return saved
  })

export const resetPassword = (user: User, userId: string) =>
  run((db) => {
    C.resetPassword(db, user, userId).password = DEMO_PASSWORD
  })

export const createCase = cmd(C.createCase, 700)
export const acceptOnline = cmd(C.acceptOnline)
export const requestCancel = cmd(C.requestCancel)
export const savePrecheck = cmd(C.savePrecheck)
export const requestInfo = cmd(C.requestInfo)
export const infoSupplied = cmd(C.infoSupplied)
export const assignDiagnosis = cmd(C.assignDiagnosis)
export const assignRepair = cmd(C.assignRepair)
export const submitDiagnosis = cmd(C.submitDiagnosis)
export const decideEligibility = cmd(C.decideEligibility)
export const sendApprovedQuote = cmd(C.sendApprovedQuote)
export const recordQuoteResponse = cmd(C.recordQuoteResponse)
export const confirmReturn = cmd(C.confirmReturn)
export const reserveParts = cmd(C.reserveParts)
export const markShortage = cmd(C.markShortage)
export const issueParts = cmd(C.issueParts)
export const confirmPartReturn = cmd(C.confirmPartReturn)
export const stockIn = cmd(C.stockIn)
export const requestPurchase = cmd(C.requestPurchase)
export const requestAdjust = cmd(C.requestAdjust)
export const startRepair = cmd(C.startRepair)
export const toggleTask = cmd(C.toggleTask, 150)
export const addWoLog = cmd(C.addWoLog, 200)
export const finishRepair = cmd(C.finishRepair)
export const proposePlanChange = cmd(C.proposePlanChange)
export const reviewPlanChange = cmd(C.reviewPlanChange)
export const sendPlanChangeQuote = cmd(C.sendPlanChangeQuote)
export const respondPlanChange = cmd(C.respondPlanChange)
export const submitQc = cmd(C.submitQc)
export const handover = cmd(C.handover)
export const decideApproval = cmd(C.decideApproval)
export const createComplaint = cmd(C.createComplaint)
export const updateComplaint = cmd(C.updateComplaint)
export const addHoliday = cmd(C.addHoliday)
export const removeHoliday = cmd(C.removeHoliday)

// Dữ liệu đọc: bản chạy thử đọc thẳng từ localStorage.
export async function fetchWorkspace(): Promise<Db> {
  return structuredClone(loadDb())
}
