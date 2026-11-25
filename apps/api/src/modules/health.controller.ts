import { Controller, Get, Inject } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { SkipThrottle } from '@nestjs/throttler'
import { ApiError } from '@woms/domain'
import { Public } from '../common/auth'
import { Doc } from '../common/zod'
import { PrismaService } from '../prisma.service'

const startedAt = new Date().toISOString()

// Kiểm tra sống (liveness) và sẵn sàng (readiness: kết nối CSDL) cho Docker/CI/giám sát.
@ApiTags('health')
@Public()
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get()
  @Doc('Liveness')
  live() {
    return { status: 'ok', service: 'woms-api', version: process.env.npm_package_version ?? '0.3.0', startedAt, commit: process.env.GIT_SHA ?? 'local' }
  }

  @Get('ready')
  @Doc('Readiness: kiểm tra kết nối PostgreSQL và trạng thái outbox')
  async ready() {
    try {
      await this.prisma.$queryRaw`SELECT 1`
      const pending = await this.prisma.outboxEvent.count({ where: { processedAt: null } })
      return { status: 'ready', database: 'up', outboxPending: pending }
    } catch {
      throw new ApiError(503, 'Chưa kết nối được cơ sở dữ liệu.')
    }
  }
}
