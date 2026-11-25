import { createParamDecorator, SetMetadata, type ExecutionContext, Inject, Injectable, type CanActivate } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import { ApiError, type Role, type User } from '@woms/domain'
import type { Request } from 'express'
import { PrismaService } from '../prisma.service'
import { userFromRow } from '../store/mappers'

// Xác thực JWT + phân quyền theo vai trò (RBAC, ma trận 5.3). Mặc định mọi endpoint cần đăng nhập; @Public() để mở.
export const IS_PUBLIC = 'woms:public'
export const ROLES = 'woms:roles'
export const Public = () => SetMetadata(IS_PUBLIC, true)
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles)

export type AuthedRequest = Request & { user?: User }

export const Me = createParamDecorator((_: unknown, ctx: ExecutionContext): User => {
  const u = ctx.switchToHttp().getRequest<AuthedRequest>().user
  if (!u) throw new ApiError(401, 'Chưa đăng nhập.')
  return u
})

export type TokenPayload = { sub: string; role: Role; username: string }

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(JwtService) private readonly jwt: JwtService,
    @Inject(PrismaService) private readonly prisma: PrismaService
  ) {}

  async canActivate(ctx: ExecutionContext) {
    const targets = [ctx.getHandler(), ctx.getClass()]
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true
    const req = ctx.switchToHttp().getRequest<AuthedRequest>()
    const header = req.headers.authorization ?? ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : ''
    if (!token) throw new ApiError(401, 'Phiên đăng nhập đã hết hạn. Đăng nhập lại để tiếp tục.')
    let payload: TokenPayload
    try {
      payload = await this.jwt.verifyAsync<TokenPayload>(token)
    } catch {
      throw new ApiError(401, 'Phiên đăng nhập đã hết hạn. Đăng nhập lại để tiếp tục.')
    }
    // Đọc lại tài khoản mỗi lần gọi: tài khoản bị khóa hoặc đổi vai trò có hiệu lực ngay, không chờ token hết hạn.
    const row = await this.prisma.user.findUnique({ where: { id: payload.sub } })
    if (!row || !row.active) throw new ApiError(401, 'Tài khoản không còn hiệu lực. Liên hệ quản lý.')
    req.user = userFromRow(row)
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES, targets)
    if (roles && !roles.includes(req.user.role)) throw new ApiError(403, 'Tài khoản của bạn không có quyền thực hiện thao tác này.')
    return true
  }
}

// Bỏ băm mật khẩu khỏi mọi tài khoản trả ra ngoài.
export const publicUser = (u: User): User => ({ ...u, password: '' })
