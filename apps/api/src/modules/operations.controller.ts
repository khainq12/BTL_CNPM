import { Body, Controller, HttpCode, Inject, Param, Patch, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { commands as C, type User } from '@woms/domain'
import type { z } from 'zod'
import { Me, Roles } from '../common/auth'
import { S } from '../common/schemas'
import { Doc, zp } from '../common/zod'
import { StateStore } from '../store/state-store'

type B<K extends keyof typeof S> = z.infer<(typeof S)[K]>

@ApiTags('work-orders')
@ApiBearerAuth()
@Controller('work-orders')
export class WorkOrdersController {
  constructor(@Inject(StateStore) private readonly store: StateStore) {}

  @Post(':id/reserve')
  @HttpCode(204)
  @Roles('KHO')
  @Doc('Giữ linh kiện khả dụng cho lệnh sửa chữa (BR-14: không giữ vượt tồn khả dụng)')
  async reserve(@Me() me: User, @Param('id') id: string) {
    await this.store.execute({ woId: id }, (db) => C.reserveParts(db, me, id))
  }

  @Post(':id/shortage')
  @HttpCode(204)
  @Roles('KHO')
  @Doc('Báo thiếu linh kiện, tự tạo đề nghị mua phần không có sẵn (EX-05)', S.shortage)
  async shortage(@Me() me: User, @Param('id') id: string, @Body(zp(S.shortage)) b: B<'shortage'>) {
    await this.store.execute({ woId: id }, (db) => C.markShortage(db, me, id, b.note))
  }

  @Post(':id/issue')
  @HttpCode(204)
  @Roles('KHO')
  @Doc('Cấp phát linh kiện đã giữ cho kỹ thuật viên, ghi biến động kho (BR-15)')
  async issue(@Me() me: User, @Param('id') id: string) {
    await this.store.execute({ woId: id }, (db) => C.issueParts(db, me, id))
  }

  @Post(':id/parts/:partId/return')
  @HttpCode(204)
  @Roles('KHO')
  @Doc('Nhận lại linh kiện chưa dùng (BR-16, EX-16)')
  async partReturn(@Me() me: User, @Param('id') id: string, @Param('partId') partId: string) {
    await this.store.execute({ woId: id }, (db) => C.confirmPartReturn(db, me, id, partId))
  }

  @Patch(':id/tasks/:taskId/toggle')
  @HttpCode(204)
  @Roles('KTV')
  @Doc('Đánh dấu hoàn thành/mở lại một công việc của lệnh sửa chữa')
  async toggle(@Me() me: User, @Param('id') id: string, @Param('taskId') taskId: string) {
    await this.store.execute({ woId: id }, (db) => C.toggleTask(db, me, id, taskId))
  }

  @Post(':id/logs')
  @HttpCode(204)
  @Roles('KTV')
  @Doc('Ghi nhật ký sửa chữa', S.woLog)
  async log(@Me() me: User, @Param('id') id: string, @Body(zp(S.woLog)) b: B<'woLog'>) {
    await this.store.execute({ woId: id }, (db) => C.addWoLog(db, me, id, b.text))
  }
}

@ApiTags('inventory')
@ApiBearerAuth()
@Controller('inventory')
export class InventoryController {
  constructor(@Inject(StateStore) private readonly store: StateStore) {}

  @Post('stock-in')
  @HttpCode(204)
  @Roles('KHO')
  @Doc('Nhập kho; ghi nhận hàng về cho đề nghị mua đã duyệt (BR-17)', S.stockIn)
  async stockIn(@Me() me: User, @Body(zp(S.stockIn)) b: B<'stockIn'>) {
    await this.store.execute({}, (db) => C.stockIn(db, me, b.partId, b.qty, b.note, b.forPurchase))
  }

  @Post('purchase-requests')
  @HttpCode(204)
  @Roles('KHO')
  @Doc('Đề nghị mua linh kiện (quản lý duyệt)', S.purchase)
  async purchase(@Me() me: User, @Body(zp(S.purchase)) b: B<'purchase'>) {
    await this.store.execute({}, (db) => C.requestPurchase(db, me, b.partId, b.qty, b.reason))
  }

  @Post('adjustments')
  @HttpCode(204)
  @Roles('KHO')
  @Doc('Đề nghị điều chỉnh tồn sau kiểm kê, bắt buộc ghi nguyên nhân (BR-18)', S.adjust)
  async adjust(@Me() me: User, @Body(zp(S.adjust)) b: B<'adjust'>) {
    await this.store.execute({}, (db) => C.requestAdjust(db, me, b.partId, b.counted, b.reason))
  }
}

@ApiTags('approvals')
@ApiBearerAuth()
@Controller('approvals')
export class ApprovalsController {
  constructor(@Inject(StateStore) private readonly store: StateStore) {}

  @Post(':id/decision')
  @HttpCode(204)
  @Roles('QL')
  @Doc('Quản lý duyệt/từ chối đề nghị: ngoại lệ, báo giá vượt ngưỡng, mua linh kiện, điều chỉnh kho, hủy phiếu, xem xét QC', S.decision)
  async decide(@Me() me: User, @Param('id') id: string, @Body(zp(S.decision)) b: B<'decision'>) {
    await this.store.execute({ approvalId: id }, (db) => C.decideApproval(db, me, id, b))
  }
}

@ApiTags('complaints')
@ApiBearerAuth()
@Controller('complaints')
export class ComplaintsController {
  constructor(@Inject(StateStore) private readonly store: StateStore) {}

  @Post()
  @HttpCode(204)
  @Roles('CSKH')
  @Doc('Tiếp nhận khiếu nại gắn với phiếu (EX-11, EX-12)', S.complaint)
  async create(@Me() me: User, @Body(zp(S.complaint)) b: B<'complaint'>) {
    await this.store.execute({ caseId: b.caseId }, (db) => C.createComplaint(db, me, b.caseId, b.content))
  }

  @Patch(':id')
  @HttpCode(204)
  @Roles('CSKH', 'QL')
  @Doc('Cập nhật xử lý khiếu nại', S.complaintUpdate)
  async update(@Me() me: User, @Param('id') id: string, @Body(zp(S.complaintUpdate)) b: B<'complaintUpdate'>) {
    await this.store.execute({ complaintId: id }, (db) => C.updateComplaint(db, me, id, b.status, b.resolution))
  }
}
