// Lỗi nghiệp vụ mang mã HTTP tương ứng. Dùng chung cho bản chạy thử (frontend) và backend (NestJS map sang HTTP).
export type ApiErrorStatus = 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500 | 503

export class ApiError extends Error {
  constructor(
    public status: ApiErrorStatus,
    message: string,
    public code?: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export const isApiError = (e: unknown): e is ApiError =>
  e instanceof ApiError || (typeof e === 'object' && e !== null && (e as { name?: string }).name === 'ApiError')
