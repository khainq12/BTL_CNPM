import { Body, Controller, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { QuotesService } from './quotes.service';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { RoleEnum, Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Quotes - Báo giá & Phê duyệt')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('quotes')
export class QuotesController {
  constructor(private readonly quotesService: QuotesService) {}

  @Post()
  @Roles(RoleEnum.TECHNICIAN, RoleEnum.CSKH, RoleEnum.MANAGER)
  @ApiOperation({ summary: 'Tạo báo giá sửa chữa (Tự động kiểm tra ngưỡng PARAM-03)' })
  create(@Body() dto: CreateQuoteDto, @CurrentUser() user: any) {
    return this.quotesService.createQuote(dto, user.userId);
  }

  @Patch(':id/approve')
  @Roles(RoleEnum.MANAGER, RoleEnum.CSKH, RoleEnum.CUSTOMER)
  @ApiOperation({ summary: 'Phê duyệt báo giá (Manager duyệt nội bộ hoặc Khách hàng chốt giá)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { customerProof: { type: 'string', example: 'OTP-889922' } },
    },
    required: false,
  })
  approve(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: any,
    @Body('customerProof') customerProof?: string,
  ) {
    return this.quotesService.approveQuote(id, user, customerProof);
  }
}