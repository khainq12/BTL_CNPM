import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CaseStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateHandoverDto } from './dto/create-handover.dto';

@Injectable()
export class HandoversService {
  constructor(private readonly prisma: PrismaService) {}

  // Bàn giao máy cho khách -> Đóng ca COMPLETED + Dừng đồng hồ SLA + OutboxEvent
  async completeHandover(dto: CreateHandoverDto, staffUserId: number) {
    const existingCase = await this.prisma.warrantyCase.findUnique({
      where: { caseId: dto.caseId },
      include: { handover: true },
    });

    if (!existingCase) {
      throw new NotFoundException(`Không tìm thấy ca bảo hành ID: ${dto.caseId}`);
    }
    if (existingCase.handover) {
      throw new BadRequestException('Ca bảo hành này đã được lập biên bản bàn giao trước đó');
    }

    const validDeliveryStatuses: CaseStatus[] = [
      CaseStatus.READY_FOR_DELIVERY,
      CaseStatus.RETURN_PENDING,
    ];
    if (!validDeliveryStatuses.includes(existingCase.status)) {
      throw new BadRequestException(
        `Chỉ có thể bàn giao khi ca ở trạng thái READY_FOR_DELIVERY hoặc RETURN_PENDING (Hiện tại: ${existingCase.status})`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const handover = await tx.handover.create({
        data: {
          caseId: dto.caseId,
          handedBy: staffUserId,
          receiverName: dto.receiverName,
          receiverPhone: dto.receiverPhone,
          customerRating: dto.customerRating ?? null,
          feedback: dto.feedback || null,
        },
      });

      await tx.warrantyCase.update({
        where: { caseId: dto.caseId },
        data: { status: CaseStatus.COMPLETED },
      });

      // Hoàn tất tất cả đồng hồ SLA đang chạy của ca này
      await tx.slaInstance.updateMany({
        where: {
          caseId: dto.caseId,
          status: { in: ['ACTIVE', 'PAUSED'] },
        },
        data: { status: 'COMPLETED' },
      });

      await tx.caseStatusHistory.create({
        data: {
          caseId: dto.caseId,
          fromStatus: existingCase.status,
          toStatus: CaseStatus.COMPLETED,
          reason: `Đã bàn giao thiết bị cho ${dto.receiverName} (${dto.receiverPhone})`,
          changedBy: staffUserId,
        },
      });

      await tx.outboxEvent.create({
        data: {
          aggregateId: String(dto.caseId),
          eventType: 'CaseHandedOver',
          payload: {
            caseId: dto.caseId,
            caseCode: existingCase.caseCode,
            handoverId: handover.handoverId,
            receiverPhone: dto.receiverPhone,
            customerRating: dto.customerRating ?? null,
          },
        },
      });

      return handover;
    });
  }
}