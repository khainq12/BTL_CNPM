import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreatePartDto {
  @ApiProperty({ example: 'LCD-XPS15-OLED', description: 'Mã SKU linh kiện duy nhất' })
  @IsString()
  @IsNotEmpty()
  sku: string;

  @ApiProperty({ example: 'Cụm màn hình OLED Dell XPS 15 9530', description: 'Tên linh kiện' })
  @IsString()
  @IsNotEmpty()
  partName: string;

  @ApiPropertyOptional({ example: 'Cụm', default: 'Cái' })
  @IsString()
  @IsOptional()
  unit?: string;

  @ApiProperty({ example: 10, description: 'Số lượng nhập kho ban đầu' })
  @IsInt()
  @Min(0)
  stockQty: number;

  @ApiPropertyOptional({ example: 3, description: 'Mức tồn kho tối thiểu cảnh báo (PARAM-06)' })
  @IsInt()
  @Min(0)
  @IsOptional()
  minStock?: number;

  @ApiProperty({ example: 2200000, description: 'Đơn giá linh kiện (VND)' })
  @IsNumber()
  @Min(0)
  unitPrice: number;
}