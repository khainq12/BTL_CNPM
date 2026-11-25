import { applyDecorators, type PipeTransform } from '@nestjs/common'
import { ApiBody, ApiOperation } from '@nestjs/swagger'
import { z } from 'zod'

// Kiểm tra dữ liệu gửi lên bằng zod ở biên API: sai kiểu trả 400, khóa lạ bị bỏ (chống ghi đè trường như "by", "at").
// Quy tắc nghiệp vụ (bắt buộc nhập, ngưỡng, trạng thái) vẫn do @woms/domain kiểm và trả 422.
export class ZodPipe<T extends z.ZodType> implements PipeTransform {
  constructor(private readonly schema: T) {}
  transform(value: unknown): z.infer<T> {
    return this.schema.parse(value ?? {})
  }
}
export const zp = <T extends z.ZodType>(s: T) => new ZodPipe(s)

const toOpenApi = (s: z.ZodType) => {
  const j = z.toJSONSchema(s, { target: 'openapi-3.0', unrepresentable: 'any' }) as Record<string, unknown>
  delete j.$schema
  return j
}

// Mô tả endpoint cho Swagger: tóm tắt + (tùy chọn) schema thân yêu cầu sinh từ zod.
export const Doc = (summary: string, body?: z.ZodType, description?: string) =>
  applyDecorators(ApiOperation({ summary, description }), ...(body ? [ApiBody({ schema: toOpenApi(body) as never })] : []))
