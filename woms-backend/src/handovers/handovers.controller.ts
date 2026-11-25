import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HandoversService } from './handovers.service';
import { CreateHandoverDto } from './dto/create-handover.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { RoleEnum, Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Handovers - Bàn giao & Đóng ca')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('handovers')
export class HandoversController {
  constructor(private readonly handoversService: HandoversService) {}

  @Post()
  @Roles(RoleEnum.RECEPTIONIST, RoleEnum.CSKH, RoleEnum.MANAGER)
  @ApiOperation({ summary: 'Lập biên bản bàn giao trả máy, dừng SLA & đóng ca (COMPLETED)' })
  create(@Body() dto: CreateHandoverDto, @CurrentUser() user: any) {
    return this.handoversService.completeHandover(dto, user.userId);
  }
}