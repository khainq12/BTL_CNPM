import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PartsService } from './parts.service';
import { CreatePartDto } from './dto/create-part.dto';
import { ReservePartDto, ReturnPartDto } from './dto/part-transaction.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { RoleEnum, Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Parts - Quản lý Kho & Linh kiện')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('parts')
export class PartsController {
  constructor(private readonly partsService: PartsService) {}

  @Post()
  @Roles(RoleEnum.WAREHOUSE, RoleEnum.MANAGER)
  @ApiOperation({ summary: 'Thêm linh kiện mới và nhập tồn đầu kỳ' })
  create(@Body() dto: CreatePartDto) {
    return this.partsService.createPart(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Tra cứu danh sách linh kiện & tồn khả dụng (stockQty - reservedQty)' })
  findAll() {
    return this.partsService.findAllParts();
  }

  @Post('reserve')
  @Roles(RoleEnum.TECHNICIAN, RoleEnum.COORDINATOR, RoleEnum.WAREHOUSE, RoleEnum.MANAGER)
  @ApiOperation({ summary: 'Giữ chỗ linh kiện cho lệnh sửa chữa (C11)' })
  reserve(@Body() dto: ReservePartDto) {
    return this.partsService.reservePartForWorkOrder(dto);
  }

  @Patch('work-order-parts/:wopId/issue')
  @Roles(RoleEnum.WAREHOUSE, RoleEnum.MANAGER)
  @ApiOperation({ summary: 'Thủ kho xác nhận xuất kho linh kiện thực tế (ISSUE)' })
  issue(@Param('wopId', ParseIntPipe) wopId: number, @CurrentUser() user: any) {
    return this.partsService.issuePart(wopId, user.userId);
  }

  @Post('return')
  @Roles(RoleEnum.TECHNICIAN, RoleEnum.WAREHOUSE, RoleEnum.MANAGER)
  @ApiOperation({ summary: 'Hoàn trả linh kiện không sử dụng hết về kho (BR-16)' })
  returnPart(@Body() dto: ReturnPartDto) {
    return this.partsService.returnUnusedPart(dto);
  }
}