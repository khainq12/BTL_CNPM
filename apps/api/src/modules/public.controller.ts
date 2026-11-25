import { Body, Controller, Get, Headers, HttpCode, Inject, Post } from '@nestjs/common'
import { ApiHeader, ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import { ApiError, commands as C, findPublicCase, publicHistory, toPublicCase, type Db } from '@woms/domain'
import type { z } from 'zod'
import { Public } from '../common/auth'
import { S } from '../common/schemas'
import { Doc, zp } from '../common/zod'
import { CONFIG, type AppConfig } from '../config'
import { PrismaService } from '../prisma.service'
import * as M from '../store/mappers'
import { StateStore } from '../store/state-store'

type B<K extends keyof typeof S> = z.infer<(typeof S)[K]>

const NOT_FOUND = 'Không tìm thấy phiếu phù hợp. Kiểm tra lại mã phiếu và số điện thoại.'

// Customer Portal (TV7). Không cần đăng nhập; mọi tra cứu phải có cả mã phiếu và số điện thoại (BR-11),
// giới hạn số lần gọi theo IP (UC-16), chỉ trả dữ liệu công khai (TC-047, TC-048, TC-054).
@ApiTags('public (customer portal)')
@Public()
@Throttle({ default: { limit: 20, ttl: 60_000 } })
@Controller('public')
export class PublicController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(StateStore) private readonly store: StateStore,
    @Inject(CONFIG) private readonly config: AppConfig
  ) {}

  private async find(code: string, phone: string) {
    const row = await this.prisma.warrantyCase.findUnique({ where: { code: String(code).trim().toUpperCase() }, include: { events: true, customer: true } })
    if (!row) throw new ApiError(404, NOT_FOUND)
    const c = M.caseFromRow(row)
    const db: Pick<Db, 'cases' | 'customers'> = { cases: [c], customers: [M.customerFromRow(row.customer)] }
    if (!findPublicCase(db, code, phone)) throw new ApiError(404, NOT_FOUND)
    return c
  }

  @Post('lookup')
  @HttpCode(200)
  @Doc(
    'Tra cứu phiếu bằng mã phiếu + số điện thoại',
    S.publicLookup,
    'Sai mã hoặc sai số điện thoại đều trả 404 cùng thông báo, không lộ phiếu có tồn tại hay không.'
  )
  async lookup(@Body(zp(S.publicLookup)) b: B<'publicLookup'>) {
    const c = await this.find(b.code, b.phone)
    const [devices, siblings, notes] = await Promise.all([
      this.prisma.device.findMany({ where: { customerId: c.customerId } }),
      this.prisma.warrantyCase.findMany({ where: { customerId: c.customerId }, include: { events: true } }),
      this.prisma.notification.findMany({ where: { caseId: c.id, channel: { not: 'NOI_BO' } }, orderBy: { createdAt: 'desc' }, take: 10 }),
    ])
    const db = { devices: devices.map(M.deviceFromRow), cases: siblings.map(M.caseFromRow) }
    return {
      case: toPublicCase(db, c),
      history: publicHistory(db, c.customerId),
      notifications: notes.map((n) => ({ at: n.createdAt.toISOString(), text: n.message })),
    }
  }

  @Post('requests')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Doc('Khách gửi yêu cầu bảo hành trực tuyến (DRAFT → PENDING_ACCEPT), mang máy tới quầy sau', S.publicRequest)
  async request(@Body(zp(S.publicRequest)) b: B<'publicRequest'>, @Headers('idempotency-key') key = '') {
    const c = await this.store.execute({ idempotencyKey: key.trim(), intake: { phone: b.customer.phone.trim(), serial: b.device.serial.trim() } }, (db) =>
      C.createOnlineRequest(db, b as C.OnlineRequestInput, key)
    )
    return {
      code: c.code,
      status: 'PENDING_ACCEPT',
      message: 'Đã ghi nhận yêu cầu. Vui lòng mang thiết bị tới trung tâm và đọc mã phiếu cho nhân viên tiếp nhận.',
    }
  }

  @Post('quote-response')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Doc(
    'Khách đồng ý/từ chối báo giá đang chờ, xác nhận bằng OTP (TV7-06, C08)',
    S.publicQuote,
    'Bản hiện tại chưa gửi OTP thật: mã OTP cấu hình bằng PORTAL_DEMO_OTP.'
  )
  async quoteResponse(@Body(zp(S.publicQuote)) b: B<'publicQuote'>) {
    const c = await this.find(b.code, b.phone)
    if (b.otp !== this.config.PORTAL_DEMO_OTP) throw new ApiError(422, 'Mã OTP chưa đúng.')
    await this.store.execute({ caseId: c.id }, (db) => C.customerRespondQuote(db, c.id, b.accepted))
    return { ok: true }
  }

  @Get('policy')
  @Doc('Thông tin công khai: lịch làm việc, thời hạn xử lý')
  policy() {
    return { workingHours: '08:00–17:30, Thứ Hai – Thứ Bảy (trừ ngày lễ)', repairSlaDays: 3, pickupHoldDays: 30, hotline: '1900 0000' }
  }
}
