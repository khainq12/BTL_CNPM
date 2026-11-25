import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, Logger } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { isApiError } from '@woms/domain'
import type { Request, Response } from 'express'
import { randomUUID } from 'node:crypto'
import { ZodError } from 'zod'

// Mọi lỗi trả về cùng một dạng JSON: { statusCode, code, message, requestId }. Lỗi 5xx không lộ chi tiết nội bộ.
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly log = new Logger('HTTP')

  catch(e: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const res = ctx.getResponse<Response>()
    const req = ctx.getRequest<Request>()
    const requestId = (req.headers['x-request-id'] as string) || randomUUID()
    const send = (statusCode: number, code: string, message: string | string[]) => res.status(statusCode).json({ statusCode, code, message, requestId })

    if (isApiError(e)) return send(e.status, e.code ?? codeOf(e.status), e.message)
    if (e instanceof ZodError)
      return send(
        400,
        'VALIDATION',
        e.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`)
      )
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return send(409, 'CONFLICT', 'Dữ liệu bị trùng (đã tồn tại).')
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2028') return send(503, 'BUSY', 'Hệ thống đang bận, thử lại sau ít giây.')
    if (e instanceof HttpException) {
      const r = e.getResponse()
      const message = typeof r === 'string' ? r : ((r as { message?: string | string[] }).message ?? e.message)
      return send(e.getStatus(), codeOf(e.getStatus()), e.getStatus() === 429 ? 'Thao tác quá nhiều lần. Vui lòng thử lại sau ít phút.' : message)
    }
    this.log.error(`${req.method} ${req.url} [${requestId}]`, e instanceof Error ? e.stack : String(e))
    return send(500, 'INTERNAL', 'Có lỗi không mong muốn ở máy chủ. Thử lại sau ít phút; nếu vẫn lỗi, báo quản trị hệ thống.')
  }
}

function codeOf(status: number) {
  return (
    { 400: 'BAD_REQUEST', 401: 'UNAUTHENTICATED', 403: 'FORBIDDEN', 404: 'NOT_FOUND', 409: 'VERSION_CONFLICT', 422: 'BUSINESS_RULE', 429: 'TOO_MANY_REQUESTS', 503: 'UNAVAILABLE' }[status] ??
    'ERROR'
  )
}
