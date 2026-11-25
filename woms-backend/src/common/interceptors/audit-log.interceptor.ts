import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, originalUrl, body, params, user } = request;

    // Chỉ ghi nhật ký với các hành động làm thay đổi dữ liệu (BR-28)
    const mutationMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
    if (!mutationMethods.includes(method) || originalUrl.includes('/auth/login')) {
      return next.handle();
    }

    return next.handle().pipe(
      tap(async (responseData) => {
        try {
          const entityType = originalUrl.split('/')[1] || 'unknown';
          const entityId = String(
            params?.id || responseData?.caseId || responseData?.workOrderId || responseData?.id || 'N/A',
          );

          await this.prisma.auditLog.create({
            data: {
              userId: user?.userId || null,
              entityType: entityType.toUpperCase(),
              entityId,
              action: `${method} ${originalUrl}`,
              oldValue: body ? JSON.parse(JSON.stringify(body)) : null,
              newValue: responseData ? JSON.parse(JSON.stringify(responseData)) : null,
            },
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error('Lỗi ghi AuditLog:', errorMessage);
        }
      }),
    );
  }
}