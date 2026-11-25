import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { CasesModule } from './cases/cases.module';
import { QuotesModule } from './quotes/quotes.module';
import { WorkOrdersModule } from './work-orders/work-orders.module';
import { SlaModule } from './sla/sla.module';
import { OutboxModule } from './outbox/outbox.module';
import { PartsModule } from './parts/parts.module';
import { HandoversModule } from './handovers/handovers.module';
import { AuditLogInterceptor } from './common/interceptors/audit-log.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST') || 'localhost',
          port: Number(config.get<string>('REDIS_PORT')) || 6379,
        },
      }),
    }),
    PrismaModule,
    AuthModule,
    CasesModule,
    QuotesModule,
    WorkOrdersModule,
    PartsModule,
    HandoversModule,
    SlaModule,
    OutboxModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditLogInterceptor,
    },
  ],
})
export class AppModule {}