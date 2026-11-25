import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Priority, ServiceType } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCaseDto {
  // Thông tin khách hàng (tự động tìm theo SĐT hoặc tạo mới)
  @ApiProperty({ example: 'Nguyễn Văn A', description: 'Tên khách hàng' })
  @IsString()
  @IsNotEmpty()
  customerName: string;

  @ApiProperty({ example: '0912345678', description: 'Số điện thoại khách hàng (Unique)' })
  @IsString()
  @IsNotEmpty()
  customerPhone: string;

  @ApiPropertyOptional({ example: 'khachhang@gmail.com' })
  @IsString()
  @IsOptional()
  customerEmail?: string;

  // Thông tin thiết bị (tự động tìm theo SerialNumber hoặc tạo mới)
  @ApiProperty({ example: 'SN-2026-998877', description: 'Số Serial thiết bị (Unique)' })
  @IsString()
  @IsNotEmpty()
  serialNumber: string;

  @ApiProperty({ example: 'Dell', description: 'Hãng sản xuất' })
  @IsString()
  @IsNotEmpty()
  brand: string;

  @ApiProperty({ example: 'XPS 15 9530', description: 'Model thiết bị' })
  @IsString()
  @IsNotEmpty()
  model: string;

  @ApiProperty({ example: 'Laptop', description: 'Loại thiết bị (Laptop, PC, Printer)' })
  @IsString()
  @IsNotEmpty()
  deviceType: string;

  // Thông tin ca bảo hành
  @ApiProperty({ example: 'Màn hình nhấp nháy, không nhận sạc', description: 'Mô tả lỗi ban đầu' })
  @IsString()
  @IsNotEmpty()
  issueDescription: string;

  @ApiPropertyOptional({ example: 'Sạc zin 130W, túi chống sốc', description: 'Phụ kiện đi kèm (BR-02)' })
  @IsString()
  @IsOptional()
  accessories?: string;

  @ApiPropertyOptional({ example: 'Vỏ nhôm xước nhẹ góc trái, tem nguyên vẹn', description: 'Tình trạng ngoại quan (BR-02)' })
  @IsString()
  @IsOptional()
  physicalState?: string;

  @ApiPropertyOptional({ enum: Priority, default: Priority.MEDIUM })
  @IsEnum(Priority)
  @IsOptional()
  priority?: Priority;

  @ApiPropertyOptional({ enum: ServiceType, example: ServiceType.WARRANTY_FREE })
  @IsEnum(ServiceType)
  @IsOptional()
  serviceType?: ServiceType;
}