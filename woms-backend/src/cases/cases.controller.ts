import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CaseStatus } from '@prisma/client';
import { CasesService } from './cases.service';
import { CreateCaseDto } from './dto/create-case.dto';
import { TransitionCaseDto } from './dto/transition-case.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { RoleEnum, Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Cases - Quản lý Ca Bảo Hành')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('cases')
export class CasesController {
  constructor(private readonly casesService: CasesService) {}

  @Post()
  @Roles(RoleEnum.RECEPTIONIST, RoleEnum.CSKH, RoleEnum.MANAGER)
  @ApiOperation({ summary: 'Tiếp nhận máy và tạo ca bảo hành mới (Tự động upsert Customer & Device)' })
  create(@Body() dto: CreateCaseDto, @CurrentUser() user: any) {
    return this.casesService.createCase(dto, user.userId);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách tất cả ca bảo hành' })
  @ApiQuery({ name: 'status', required: false, enum: CaseStatus })
  findAll(@Query('status') status?: CaseStatus) {
    return this.casesService.findAll(status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Xem chi tiết hồ sơ ca bảo hành kèm báo giá, WO & lịch sử' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.casesService.findOne(id);
  }

  @Patch(':id/transition')
  @Roles(
    RoleEnum.RECEPTIONIST,
    RoleEnum.CSKH,
    RoleEnum.COORDINATOR,
    RoleEnum.TECHNICIAN,
    RoleEnum.WAREHOUSE,
    RoleEnum.QC,
    RoleEnum.MANAGER,
  )
  @ApiOperation({ summary: 'Chuyển trạng thái ca bảo hành theo State Machine 21 bước' })
  transition(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: TransitionCaseDto,
    @CurrentUser() user: any,
  ) {
    return this.casesService.transitionStatus(id, dto, user.userId);
  }
}