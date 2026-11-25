import { Body, Controller, Get, HttpCode, Inject, Post } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import { commands as C, type User } from '@woms/domain'
import bcrypt from 'bcryptjs'
import { Me, Public, publicUser, type TokenPayload } from '../common/auth'
import { S } from '../common/schemas'
import { Doc, zp } from '../common/zod'
import { CONFIG, type AppConfig } from '../config'
import { StateStore } from '../store/state-store'

// Băm giả để so sánh khi không có tài khoản: thời gian phản hồi như nhau, không lộ tên đăng nhập tồn tại hay không.
const DUMMY_HASH = bcrypt.hashSync('woms-timing-guard', 10)

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    @Inject(StateStore) private readonly store: StateStore,
    @Inject(JwtService) private readonly jwt: JwtService,
    @Inject(CONFIG) private readonly config: AppConfig
  ) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @HttpCode(200)
  @Doc('Đăng nhập, nhận JWT (NFR-01)', S.login, 'Sai tên đăng nhập và sai mật khẩu trả cùng thông báo 401. Tài khoản khóa trả 403. Quá 10 lần/phút/IP trả 429.')
  async login(@Body(zp(S.login)) b: { username: string; password: string }) {
    const probe = await this.store.snapshotUser(b.username)
    const ok = await bcrypt.compare(b.password, probe?.password || DUMMY_HASH)
    const user = await this.store.execute({}, (db) => C.recordLogin(db, C.findLoginUser(db, b.username), ok && !!probe))
    const payload: TokenPayload = { sub: user.id, role: user.role, username: user.username }
    const accessToken = await this.jwt.signAsync(payload)
    return { accessToken, tokenType: 'Bearer', expiresAt: new Date(Date.now() + this.config.JWT_TTL_HOURS * 3600_000).toISOString(), user: publicUser(user) }
  }

  @ApiBearerAuth()
  @Get('me')
  @Doc('Tài khoản đang đăng nhập')
  me(@Me() me: User) {
    return publicUser(me)
  }

  @ApiBearerAuth()
  @Post('logout')
  @HttpCode(204)
  @Doc('Ghi nhật ký đăng xuất (JWT không lưu phía máy chủ; client tự xóa token)', S.logout)
  async logout(@Me() me: User, @Body(zp(S.logout)) b: { action: string }) {
    await this.store.execute({}, (db) => C.logAudit(db, me, b.action || 'Đăng xuất'))
  }

  @ApiBearerAuth()
  @Post('change-password')
  @HttpCode(204)
  @Doc('Đổi mật khẩu (tối thiểu 8 ký tự, có chữ và số)', S.changePassword)
  async changePassword(@Me() me: User, @Body(zp(S.changePassword)) b: { current: string; next: string }) {
    const ok = await bcrypt.compare(b.current, me.password)
    const hash = await bcrypt.hash(b.next, this.config.BCRYPT_ROUNDS)
    await this.store.execute({}, (db) => {
      C.changePassword(db, me, ok, b.next).password = hash
    })
  }
}
