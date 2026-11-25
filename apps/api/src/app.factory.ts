import 'reflect-metadata'
import { type INestApplication, Logger } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { DocumentBuilder, type OpenAPIObject, SwaggerModule } from '@nestjs/swagger'
import helmet from 'helmet'
import { randomUUID } from 'node:crypto'
import { AppModule } from './app.module'
import { loadConfig } from './config'

export const API_PREFIX = 'api/v1'

export function buildOpenApi(app: INestApplication): OpenAPIObject {
  const doc = new DocumentBuilder()
    .setTitle('WOMS API')
    .setDescription(
      'API của hệ thống quản lý hoạt động bảo hành (WOMS). Quy tắc nghiệp vụ theo tài liệu hợp nhất 12/11/2026: 21 trạng thái (bảng 6.2), bảng quyết định D1–D10, ' +
        'SLA 3 ngày làm việc, ngưỡng duyệt báo giá 2.000.000 đ. Lỗi trả về dạng { statusCode, code, message, requestId }; 409 = phiên bản phiếu đã thay đổi (EX-14), 422 = vi phạm quy tắc nghiệp vụ.'
    )
    .setVersion(process.env.npm_package_version ?? '0.3.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
    .addServer('/')
    .build()
  return SwaggerModule.createDocument(app, doc)
}

// Dựng ứng dụng với cấu hình dùng chung cho chạy thật và kiểm thử tích hợp.
export async function createApp(opts: { logger?: false } = {}): Promise<NestExpressApplication> {
  const config = loadConfig()
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: opts.logger ?? ['error', 'warn', 'log'], bodyParser: true })
  app.useBodyParser('json', { limit: '25mb' })
  app.set('trust proxy', 1)
  app.use((req: { headers: Record<string, string | string[] | undefined> }, res: { setHeader: (k: string, v: string) => void }, next: () => void) => {
    const id = (req.headers['x-request-id'] as string) || randomUUID()
    req.headers['x-request-id'] = id
    res.setHeader('X-Request-Id', id)
    next()
  })
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
  app.enableCors({ origin: config.CORS_ORIGINS.split(',').map((s) => s.trim()), credentials: false, exposedHeaders: ['X-Request-Id'] })
  app.setGlobalPrefix(API_PREFIX)
  app.enableShutdownHooks()
  SwaggerModule.setup('api/docs', app, buildOpenApi(app), { jsonDocumentUrl: 'api/docs/openapi.json', customSiteTitle: 'WOMS API' })
  return app
}

export async function bootstrap() {
  const config = loadConfig()
  const app = await createApp()
  await app.listen(config.PORT, '0.0.0.0')
  new Logger('Bootstrap').log(`WOMS API: http://localhost:${config.PORT}/${API_PREFIX} · Swagger: http://localhost:${config.PORT}/api/docs`)
  return app
}
