import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SlaService } from './sla.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { RoleEnum, Roles } from '../common/decorators/roles.decorator';

@ApiTags('SLA Engine - Giám sát Thời hạn Dịch vụ')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('sla')
export class SlaController {
  constructor(private readonly slaService: SlaService) {}

  @Get('instances')
  @Roles(RoleEnum.MANAGER, RoleEnum.COORDINATOR, RoleEnum.CSKH)
  @ApiOperation({ summary: 'Xem danh sách đồng hồ SLA đang chạy và trạng thái quá hạn' })
  findAll() {
    return this.slaService.getAllSlaInstances();
  }

  @Post('trigger-check')
  @Roles(RoleEnum.MANAGER)
  @ApiOperation({ summary: 'Kích hoạt quét kiểm tra SLA quá hạn ngay lập tức (Test)' })
  async triggerCheck() {
    await this.slaService.checkSlaDeadlines();
    return { message: 'Đã hoàn tất chu kỳ kiểm tra SLA' };
  }
}