import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class ReservePartDto {
  @ApiProperty({ example: 1, description: 'ID lệnh sửa chữa (workOrderId)' })
  @IsInt()
  workOrderId: number;

  @ApiProperty({ example: 1, description: 'ID linh kiện (partId)' })
  @IsInt()
  partId: number;

  @ApiProperty({ example: 1, description: 'Số lượng cần giữ chỗ / xuất kho' })
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiPropertyOptional({ example: 'Giữ chỗ màn hình thay thế cho WO-01' })
  @IsString()
  @IsOptional()
  note?: string;
}

export class ReturnPartDto {
  @ApiProperty({ example: 1, description: 'ID bản ghi WorkOrderPart (wopId)' })
  @IsInt()
  wopId: number;

  @ApiProperty({ example: 1, description: 'Số lượng linh kiện hoàn trả lại kho (BR-16)' })
  @IsInt()
  @Min(1)
  returnQty: number;

  @ApiPropertyOptional({ example: 'Linh kiện còn nguyên seal, không cần thay' })
  @IsString()
  @IsOptional()
  note?: string;
}