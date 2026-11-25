import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CaseStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class TransitionCaseDto {
  @ApiProperty({ enum: CaseStatus, example: CaseStatus.PRECHECK, description: 'Trạng thái tiếp theo' })
  @IsEnum(CaseStatus, { message: 'Trạng thái không nằm trong 21 trạng thái hợp lệ' })
  nextStatus: CaseStatus;

  @ApiPropertyOptional({ example: 'Đã kiểm tra ngoại quan và tem bảo hành', description: 'Lý do chuyển trạng thái' })
  @IsString()
  @IsOptional()
  reason?: string;
}