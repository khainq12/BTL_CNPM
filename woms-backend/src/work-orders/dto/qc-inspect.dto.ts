import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class QcInspectDto {
  @ApiProperty({ example: true, description: 'Kết quả kiểm định (true = PASS, false = FAIL)' })
  @IsBoolean()
  passed: boolean;

  @ApiPropertyOptional({ example: 'Đã kiểm tra đầy đủ các cổng kết nối và nhiệt độ tải nặng', description: 'Ghi chú của QC' })
  @IsString()
  @IsOptional()
  note?: string;
}