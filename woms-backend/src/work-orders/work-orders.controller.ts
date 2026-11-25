import { Body, Controller, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { WorkOrdersService } from './work-orders.service';
import { CreateWorkOrderDto } from './dto/create-work-order.dto';
import { QcInspectDto } from './dto/qc-inspect.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { RoleEnum, Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('WorkOrders - Điều phối Kỹ thuật & QC')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('work-orders')
export class WorkOrdersController {
  constructor(private readonly workOrdersService: WorkOrdersService) {}

  @Post()
  @Roles(RoleEnum.COORDINATOR, RoleEnum.MANAGER)
  @ApiOperation({ summary: 'Điều phối viên tạo lệnh sửa chữa (WorkOrder) & gán Kỹ thuật viên' })
  assign(@Body() dto: CreateWorkOrderDto, @CurrentUser() user: any) {
    return this.workOrdersService.assignTechnician(dto, user.userId);
  }

  @Patch(':id/qc-inspect')
  @Roles(RoleEnum.QC, RoleEnum.MANAGER)
  @ApiOperation({ summary: 'QC nghiệm thu chất lượng (Tự động chuyển MANAGER_REVIEW nếu vượt PARAM-10)' })
  inspect(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: QcInspectDto,
    @CurrentUser() user: any,
  ) {
    return this.workOrdersService.inspectQuality(id, dto, user.userId);
  }
}