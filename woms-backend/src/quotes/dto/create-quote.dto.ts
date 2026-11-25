import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateQuoteDto {
  @ApiProperty({ example: 1, description: 'ID ca bảo hành (caseId)' })
  @IsInt()
  caseId: number;

  @ApiProperty({ example: 2200000, description: 'Chi phí linh kiện (VND)' })
  @IsNumber()
  @Min(0)
  partsCost: number;

  @ApiProperty({ example: 300000, description: 'Chi phí nhân công sửa chữa (VND)' })
  @IsNumber()
  @Min(0)
  laborCost: number;

  @ApiPropertyOptional({ example: 'Thay cụm màn hình OLED chính hãng', description: 'Ghi chú báo giá' })
  @IsString()
  @IsOptional()
  managerNote?: string;
}