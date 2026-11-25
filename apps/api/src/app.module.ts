import { Module } from '@nestjs/common'
import { APP_FILTER, APP_GUARD } from '@nestjs/core'
import { JwtModule } from '@nestjs/jwt'
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler'
import { AuthGuard } from './common/auth'
import { AllExceptionsFilter } from './common/errors'
import { CONFIG, loadConfig, type AppConfig } from './config'
import { AdminController } from './modules/admin.controller'
import { AuthController } from './modules/auth.controller'
import { CasesController, WorkspaceController } from './modules/cases.controller'
import { HealthController } from './modules/health.controller'
import { ApprovalsController, ComplaintsController, InventoryController, WorkOrdersController } from './modules/operations.controller'
import { PublicController } from './modules/public.controller'
import { OutboxWorker } from './outbox/outbox.worker'
import { PrismaService } from './prisma.service'
import { StateStore } from './store/state-store'

const config = loadConfig()

@Module({
  imports: [
    JwtModule.register({
      secret: config.JWT_SECRET,
      signOptions: { expiresIn: `${config.JWT_TTL_HOURS}h`, issuer: 'woms-api', audience: 'woms-staff' },
      verifyOptions: { issuer: 'woms-api', audience: 'woms-staff' },
    }),
    ThrottlerModule.forRoot({ throttlers: [{ name: 'default', ttl: 60_000, limit: 600 }], skipIf: () => process.env.THROTTLE_DISABLED === '1' }),
  ],
  controllers: [
    HealthController,
    AuthController,
    WorkspaceController,
    CasesController,
    WorkOrdersController,
    InventoryController,
    ApprovalsController,
    ComplaintsController,
    AdminController,
    PublicController,
  ],
  providers: [
    { provide: CONFIG, useFactory: (): AppConfig => loadConfig() },
    PrismaService,
    StateStore,
    OutboxWorker,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
