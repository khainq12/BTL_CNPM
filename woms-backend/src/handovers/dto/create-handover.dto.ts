import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateHandoverDto {
  @ApiProperty({ example: 1, description: 'ID ca bảo hành cần bàn giao (caseId)' })
  @IsInt()
  caseId: number;

  @ApiProperty({ example: 'Nguyễn Văn A', description: 'Tên người nhận lại thiết bị' })
  @IsString()
  @IsNotEmpty()
  receiverName: string;

  @ApiProperty({ example: '0912345678', description: 'SĐT người nhận máy' })
  @IsString()
  @IsNotEmpty()
  receiverPhone: string;

  @ApiPropertyOptional({ example: 5, description: 'Đánh giá mức độ hài lòng 1-5 sao (FR-12)' })
  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  customerRating?: number;

  @ApiPropertyOptional({ example: 'Sửa nhanh, nhân viên tư vấn nhiệt tình' })
  @IsString()
  @IsOptional()
  feedback?: string;
}