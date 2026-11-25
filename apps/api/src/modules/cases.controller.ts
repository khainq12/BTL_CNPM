import { Body, Controller, Get, Headers, HttpCode, Inject, Param, Post, Put, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiHeader, ApiQuery, ApiTags } from '@nestjs/swagger'
import { ApiError, canViewCase, commands as C, workspaceView, type User, type WarrantyCase } from '@woms/domain'
import type { z } from 'zod'
import { Me, Roles } from '../common/auth'
import { S } from '../common/schemas'
import { Doc, zp } from '../common/zod'
import { StateStore } from '../store/state-store'

type B<K extends keyof typeof S> = z.infer<(typeof S)[K]>

// Kết quả trả về sau mỗi lệnh trên phiếu: đủ để giao diện cập nhật và gửi version tiếp theo (EX-14).
const brief = (c: WarrantyCase) => ({ id: c.id, code: c.code, version: c.version, status: c.status })

@ApiTags('workspace')
@ApiBearerAuth()
@Controller()
export class WorkspaceController {
  constructor(@Inject(StateStore) private readonly store: StateStore) {}

  @Get('workspace')
  @Doc(
    'Dữ liệu làm việc của tài khoản (đã lọc theo vai trò)',
    undefined,
    'KTV/kho/QC chỉ nhận phiếu được giao và không nhận SĐT/email khách; nhật ký thao tác chỉ quản lý nhận (AT-14, NFR-01).'
  )
  async workspace(@Me() me: User) {
    return workspaceView(await this.store.snapshot(), me)
  }
}

@ApiTags('cases')
@ApiBearerAuth()
@Controller('cases')
export class CasesController {
  constructor(@Inject(StateStore) private readonly store: StateStore) {}

  private run(me: User, id: string, fn: Parameters<StateStore['execute']>[1]) {
    return this.store.execute({ caseId: id }, fn).then((c) => brief(c as WarrantyCase))
  }

  @Get()
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'q', required: false, description: 'Tìm theo mã phiếu, serial, tên/SĐT khách' })
  @Doc('Danh sách phiếu tài khoản được xem')
  async list(@Me() me: User, @Query('status') status?: string, @Query('q') q?: string) {
    const db = workspaceView(await this.store.snapshot({ auditLimit: 0, stockMoveLimit: 0 }), me)
    const needle = (q ?? '').trim().toLowerCase()
    return db.cases
      .filter((c) => !status || c.status === status)
      .filter((c) => {
        if (!needle) return true
        const cu = db.customers.find((x) => x.id === c.customerId)
        const d = db.devices.find((x) => x.id === c.deviceId)
        return [c.code, d?.serial, cu?.name, cu?.phone].some((v) => v?.toLowerCase().includes(needle))
      })
      .map((c) => ({ ...brief(c), createdAt: c.createdAt, customerId: c.customerId, deviceId: c.deviceId, symptom: c.symptom }))
  }

  @Get(':id')
  @Doc('Chi tiết phiếu (403 nếu vai trò không được xem phiếu này, AT-14)')
  async get(@Me() me: User, @Param('id') id: string) {
    const db = await this.store.snapshot({ auditLimit: 0, stockMoveLimit: 0 })
    const c = db.cases.find((x) => x.id === id || x.code === id)
    if (!c) throw new ApiError(404, 'Không tìm thấy phiếu.')
    const wo = db.workOrders.find((w) => w.caseId === c.id)
    if (!canViewCase(me, c, wo)) throw new ApiError(403, 'Bạn không được giao xử lý phiếu này.')
    const view = workspaceView({ ...db, cases: [c], workOrders: wo ? [wo] : [] }, me)
    return {
      case: view.cases[0],
      workOrder: view.workOrders[0],
      customer: view.customers.find((x) => x.id === c.customerId),
      device: view.devices.find((x) => x.id === c.deviceId),
    }
  }

  @Post()
  @Roles('TN')
  @ApiHeader({ name: 'Idempotency-Key', required: true, description: 'Gửi lại cùng khóa không tạo phiếu thứ hai (EX-13)' })
  @Doc('Tạo phiếu tiếp nhận tại quầy (FR-01, BR-02)', S.intake)
  async create(@Me() me: User, @Body(zp(S.intake)) b: B<'intake'>, @Headers('idempotency-key') key = '') {
    const serial = b.device.serial.trim()
    const c = await this.store.execute(
      { idempotencyKey: key.trim(), intake: { phone: b.customer.phone.trim(), serial, customerId: b.customerId, deviceId: b.deviceId } },
      (db) => C.createCase(db, me, b as C.IntakeInput, key)
    )
    return brief(c)
  }

  @Post(':id/accept-online')
  @HttpCode(200)
  @Roles('TN')
  @Doc('Nhận máy của yêu cầu trực tuyến, lập biên nhận (PENDING_ACCEPT → RECEIVED)', S.acceptOnline)
  acceptOnline(@Me() me: User, @Param('id') id: string, @Body(zp(S.acceptOnline)) b: B<'acceptOnline'>) {
    return this.run(me, id, (db) => C.acceptOnline(db, me, id, b.version, b))
  }

  @Post(':id/cancel-request')
  @HttpCode(200)
  @Roles('TN', 'CSKH')
  @Doc('Đề nghị hủy phiếu (quản lý duyệt)', S.reason)
  cancel(@Me() me: User, @Param('id') id: string, @Body(zp(S.reason)) b: B<'reason'>) {
    return this.run(me, id, (db) => C.requestCancel(db, me, id, b.version, b.reason))
  }

  @Put(':id/precheck')
  @Roles('CSKH')
  @Doc('Ghi kết quả kiểm tra sơ bộ (RECEIVED → PRECHECK)', S.precheck)
  precheck(@Me() me: User, @Param('id') id: string, @Body(zp(S.precheck)) b: B<'precheck'>) {
    return this.run(me, id, (db) => C.savePrecheck(db, me, id, b.version, { warranty: b.warranty, note: b.note }))
  }

  @Post(':id/info-request')
  @HttpCode(200)
  @Roles('CSKH')
  @Doc('Yêu cầu khách bổ sung thông tin (PRECHECK → WAITING_INFORMATION)', S.reason)
  infoRequest(@Me() me: User, @Param('id') id: string, @Body(zp(S.reason)) b: B<'reason'>) {
    return this.run(me, id, (db) => C.requestInfo(db, me, id, b.version, b.reason))
  }

  @Post(':id/info-supplied')
  @HttpCode(200)
  @Roles('CSKH')
  @Doc('Khách đã bổ sung thông tin (WAITING_INFORMATION → PRECHECK)', S.note)
  infoSupplied(@Me() me: User, @Param('id') id: string, @Body(zp(S.note)) b: B<'note'>) {
    return this.run(me, id, (db) => C.infoSupplied(db, me, id, b.version, b.note))
  }

  @Put(':id/diagnosis-assignment')
  @Roles('DP')
  @Doc('Phân công/đổi kỹ thuật viên chẩn đoán (đổi phải ghi lý do, BR-11)', S.assign)
  assignDiagnosis(@Me() me: User, @Param('id') id: string, @Body(zp(S.assign)) b: B<'assign'>) {
    return this.run(me, id, (db) => C.assignDiagnosis(db, me, id, b.version, b.techId, b.reason))
  }

  @Put(':id/diagnosis')
  @Roles('KTV')
  @Doc('Nộp biên bản chẩn đoán (DIAGNOSING → ELIGIBILITY_REVIEW, C03)', S.diagnosis)
  diagnosis(@Me() me: User, @Param('id') id: string, @Body(zp(S.diagnosis)) b: B<'diagnosis'>) {
    const { version, ...d } = b
    return this.run(me, id, (db) => C.submitDiagnosis(db, me, id, version, d))
  }

  @Put(':id/eligibility')
  @Roles('CSKH')
  @Doc('Kết luận điều kiện bảo hành D1–D10; báo giá > 2.000.000 đ chờ quản lý duyệt (BR-05, BR-07)', S.eligibility)
  eligibility(@Me() me: User, @Param('id') id: string, @Body(zp(S.eligibility)) b: B<'eligibility'>) {
    const { version, ...d } = b
    return this.run(me, id, (db) => C.decideEligibility(db, me, id, version, d))
  }

  @Post(':id/quote/send')
  @HttpCode(200)
  @Roles('CSKH')
  @Doc('Gửi báo giá đã được quản lý duyệt cho khách', S.versionOnly)
  sendQuote(@Me() me: User, @Param('id') id: string, @Body(zp(S.versionOnly)) b: B<'versionOnly'>) {
    return this.run(me, id, (db) => C.sendApprovedQuote(db, me, id, b.version))
  }

  @Post(':id/quote/response')
  @HttpCode(200)
  @Roles('CSKH')
  @Doc('Ghi nhận khách đồng ý/từ chối báo giá (C08)', S.quoteResponse)
  quoteResponse(@Me() me: User, @Param('id') id: string, @Body(zp(S.quoteResponse)) b: B<'quoteResponse'>) {
    const { version, ...d } = b
    return this.run(me, id, (db) => C.recordQuoteResponse(db, me, id, version, d))
  }

  @Post(':id/return-conclusion')
  @HttpCode(200)
  @Roles('CSKH')
  @Doc('Kết luận trả thiết bị không sửa (BR-23)', S.returnConclusion)
  returnConclusion(@Me() me: User, @Param('id') id: string, @Body(zp(S.returnConclusion)) b: B<'returnConclusion'>) {
    return this.run(me, id, (db) => C.confirmReturn(db, me, id, b.version, { text: b.text, feeAgreed: b.feeAgreed }))
  }

  @Put(':id/repair-assignment')
  @Roles('DP')
  @Doc('Phân công/đổi kỹ thuật viên sửa chữa, giữ lịch sử phân công (FR-04)', S.assign)
  assignRepair(@Me() me: User, @Param('id') id: string, @Body(zp(S.assign)) b: B<'assign'>) {
    return this.run(me, id, (db) => C.assignRepair(db, me, id, b.version, b.techId, b.reason))
  }

  @Post(':id/repair/start')
  @HttpCode(200)
  @Roles('KTV')
  @Doc('Bắt đầu sửa (cần nhận đủ linh kiện, BR-13)', S.versionOnly)
  startRepair(@Me() me: User, @Param('id') id: string, @Body(zp(S.versionOnly)) b: B<'versionOnly'>) {
    return this.run(me, id, (db) => C.startRepair(db, me, id, b.version))
  }

  @Post(':id/repair/finish')
  @HttpCode(200)
  @Roles('KTV')
  @Doc('Hoàn tất sửa, chuyển kiểm tra chất lượng (BR-19)', S.finishRepair)
  finishRepair(@Me() me: User, @Param('id') id: string, @Body(zp(S.finishRepair)) b: B<'finishRepair'>) {
    return this.run(me, id, (db) => C.finishRepair(db, me, id, b.version, b.used, b.note))
  }

  @Post(':id/plan-changes')
  @HttpCode(200)
  @Roles('KTV')
  @Doc('Đề xuất đổi phương án khi đang sửa (BR-12)', S.planChange)
  proposePlanChange(@Me() me: User, @Param('id') id: string, @Body(zp(S.planChange)) b: B<'planChange'>) {
    const { version, ...d } = b
    return this.run(me, id, (db) => C.proposePlanChange(db, me, id, version, d))
  }

  @Post(':id/plan-changes/current/review')
  @HttpCode(200)
  @Roles('CSKH')
  @Doc('CSKH xét đề xuất đổi phương án', S.planReview)
  reviewPlanChange(@Me() me: User, @Param('id') id: string, @Body(zp(S.planReview)) b: B<'planReview'>) {
    const { version, ...d } = b
    return this.run(me, id, (db) => C.reviewPlanChange(db, me, id, version, d))
  }

  @Post(':id/plan-changes/current/send-quote')
  @HttpCode(200)
  @Roles('CSKH')
  @Doc('Gửi báo giá bổ sung đã duyệt cho khách (tạm dừng hạn, PARAM-16)', S.versionOnly)
  sendPlanChangeQuote(@Me() me: User, @Param('id') id: string, @Body(zp(S.versionOnly)) b: B<'versionOnly'>) {
    return this.run(me, id, (db) => C.sendPlanChangeQuote(db, me, id, b.version))
  }

  @Post(':id/plan-changes/current/response')
  @HttpCode(200)
  @Roles('CSKH')
  @Doc('Ghi nhận khách đồng ý/từ chối báo giá bổ sung', S.planResponse)
  respondPlanChange(@Me() me: User, @Param('id') id: string, @Body(zp(S.planResponse)) b: B<'planResponse'>) {
    const { version, ...d } = b
    return this.run(me, id, (db) => C.respondPlanChange(db, me, id, version, d))
  }

  @Post(':id/qc')
  @HttpCode(200)
  @Roles('QC')
  @Doc('Ghi kết quả kiểm tra chất lượng theo danh mục bắt buộc (BR-20); sửa lại tối đa 2 lần (PARAM-10)', S.qc)
  qc(@Me() me: User, @Param('id') id: string, @Body(zp(S.qc)) b: B<'qc'>) {
    return this.run(me, id, (db) => C.submitQc(db, me, id, b.version, b.items, b.defect, b.photos))
  }

  @Post(':id/handover')
  @HttpCode(200)
  @Roles('TN')
  @Doc('Bàn giao thiết bị có xác nhận của người nhận (BR-23, BR-24)', S.handover)
  handover(@Me() me: User, @Param('id') id: string, @Body(zp(S.handover)) b: B<'handover'>) {
    const { version, ...d } = b
    return this.run(me, id, (db) => C.handover(db, me, id, version, d))
  }
}
