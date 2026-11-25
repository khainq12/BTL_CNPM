import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import { CONFIG, type AppConfig } from './config'

// Kết nối PostgreSQL qua Prisma (connection pool do Prisma quản lý, cấu hình bằng ?connection_limit= trong DATABASE_URL).
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('Prisma')

  constructor(@Inject(CONFIG) config: AppConfig) {
    super({ datasourceUrl: config.DATABASE_URL, log: [{ emit: 'event', level: 'warn' }] })
  }

  async onModuleInit() {
    await this.$connect()
    this.log.log('Đã kết nối PostgreSQL')
  }

  async onModuleDestroy() {
    await this.$disconnect()
  }
}
