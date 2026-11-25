import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Post, Put, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger'
import { ApiError, commands as C, dashboard, PARAMS, type User } from '@woms/domain'
import bcrypt from 'bcryptjs'
import type { z } from 'zod'
import { Me, publicUser, Roles } from '../common/auth'
import { S } from '../common/schemas'
import { Doc, zp } from '../common/zod'
import { CONFIG, type AppConfig } from '../config'
import { PrismaService } from '../prisma.service'
import { StateStore } from '../store/state-store'

type B<K extends keyof typeof S> = z.infer<(typeof S)[K]>

@ApiTags('admin')
@ApiBearerAuth()
@Roles('QL')
@Controller()
export class AdminController {
  constructor(
    @Inject(StateStore) private readonly store: StateStore,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CONFIG) private readonly config: AppConfig
  ) {}

  @Post('users')
  @Doc('Tạo tài khoản nhân viên (mật khẩu ban đầu = mật khẩu mặc định, yêu cầu đổi sau khi đăng nhập)', S.user)
  async createUser(@Me() me: User, @Body(zp(S.user)) b: B<'user'>) {
    const hash = await bcrypt.hash(this.config.DEFAULT_PASSWORD, this.config.BCRYPT_ROUNDS)
    const u = await this.store.execute({}, (db) => {
      const saved = C.saveUser(db, me, b)
      if (!saved.password) saved.password = hash
      return saved
    })
    return publicUser(u)
  }

  @Put('users/:id')
  @Doc('Cập nhật tài khoản (vai trò, khóa/mở)', S.user)
  async updateUser(@Me() me: User, @Param('id') id: string, @Body(zp(S.user)) b: B<'user'>) {
    return publicUser(await this.store.execute({}, (db) => C.saveUser(db, me, { ...b, id })))
  }

  @Post('users/:id/reset-password')
  @HttpCode(204)
  @Doc('Đặt lại mật khẩu về mặc định')
  async resetPassword(@Me() me: User, @Param('id') id: string) {
    const hash = await bcrypt.hash(this.config.DEFAULT_PASSWORD, this.config.BCRYPT_ROUNDS)
    await this.store.execute({}, (db) => {
      C.resetPassword(db, me, id).password = hash
    })
  }

  @Post('holidays')
  @HttpCode(204)
  @Doc('Thêm ngày nghỉ (không tính vào hạn xử lý)', S.holiday)
  async addHoliday(@Me() me: User, @Body(zp(S.holiday)) b: B<'holiday'>) {
    await this.store.execute({}, (db) => C.addHoliday(db, me, b.date, b.name))
  }

  @Delete('holidays/:date')
  @HttpCode(204)
  @Doc('Xóa ngày nghỉ')
  async removeHoliday(@Me() me: User, @Param('date') date: string) {
    await this.store.execute({}, (db) => C.removeHoliday(db, me, date))
  }

  @Get('audit')
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'ref', required: false, description: 'Lọc theo mã phiếu/lệnh/tài khoản' })
  @Doc('Nhật ký thao tác (FR-07, BR-28)')
  async audit(@Query('limit') limit = '200', @Query('ref') ref?: string) {
    const take = Math.min(Math.max(Number(limit) || 200, 1), 2000)
    const rows = await this.prisma.auditLog.findMany({ where: ref ? { ref } : undefined, orderBy: { at: 'desc' }, take })
    return rows.map((r) => ({ ...r, at: r.at.toISOString(), detail: r.detail ?? undefined }))
  }

  @Get('reports/dashboard')
  @Doc('Chỉ số điều hành: SLA, tỷ lệ đúng hạn, tỷ lệ sửa lại, tải kỹ thuật viên, tồn thấp (TV7, TC-057)')
  async dashboard() {
    return dashboard(await this.store.snapshot({ auditLimit: 0, stockMoveLimit: 0 }), Date.now(), PARAMS.minStock)
  }

  @Get('notifications/internal')
  @Doc('Cảnh báo nội bộ do tiến trình nền sinh ra (sắp quá hạn/quá hạn SLA, FR-06, TC-039)')
  async internal() {
    const rows = await this.prisma.notification.findMany({ where: { channel: 'NOI_BO' }, orderBy: { createdAt: 'desc' }, take: 100 })
    if (!rows) throw new ApiError(404, 'Không có dữ liệu.')
    return rows
  }
}
