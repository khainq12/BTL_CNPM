import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional } from 'class-validator';

export class CreateWorkOrderDto {
  @ApiProperty({ example: 1, description: 'ID ca bảo hành (caseId)' })
  @IsInt()
  caseId: number;

  @ApiPropertyOptional({ example: 2, description: 'ID kỹ thuật viên được phân công (assignedTo)' })
  @IsInt()
  @IsOptional()
  assignedTo?: number;
}