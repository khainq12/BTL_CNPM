import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: {
        userRoles: {
          include: { role: true },
        },
      },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Tài khoản không tồn tại hoặc đã bị khóa');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Mật khẩu không chính xác');
    }

    const roles = user.userRoles.map((ur) => ur.role.roleName);
    const payload = {
      sub: user.userId,
      email: user.email,
      fullName: user.fullName,
      roles,
    };

    return {
      accessToken: await this.jwtService.signAsync(payload),
      user: {
        userId: user.userId,
        fullName: user.fullName,
        email: user.email,
        roles,
      },
    };
  }
}