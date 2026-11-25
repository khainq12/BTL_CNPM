import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CaseStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCaseDto } from './dto/create-case.dto';
import { TransitionCaseDto } from './dto/transition-case.dto';
import { ALLOWED_TRANSITIONS } from '../common/constants/workflow.constant';

@Injectable()
export class CasesService {
  constructor(private readonly prisma: PrismaService) {}

  // 1. Tiếp nhận ca bảo hành: Upsert Customer -> Upsert Device -> Create WarrantyCase + History + OutboxEvent
  async createCase(dto: CreateCaseDto, createdByUserId: number) {
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const caseCode = `CAS-${todayStr}-${randomSuffix}`;

    return this.prisma.$transaction(async (tx) => {
      // Tìm hoặc tạo mới khách hàng theo SĐT
      const customer = await tx.customer.upsert({
        where: { phone: dto.customerPhone },
        update: {
          fullName: dto.customerName,
          ...(dto.customerEmail ? { email: dto.customerEmail } : {}),
        },
        create: {
          fullName: dto.customerName,
          phone: dto.customerPhone,
          email: dto.customerEmail || null,
        },
      });

      // Tìm hoặc tạo mới thiết bị theo SerialNumber
      const device = await tx.device.upsert({
        where: { serialNumber: dto.serialNumber },
        update: {
          customerId: customer.customerId,
          brand: dto.brand,
          model: dto.model,
          deviceType: dto.deviceType,
        },
        create: {
          customerId: customer.customerId,
          serialNumber: dto.serialNumber,
          brand: dto.brand,
          model: dto.model,
          deviceType: dto.deviceType,
        },
      });

      // Tạo hồ sơ WarrantyCase
      const newCase = await tx.warrantyCase.create({
        data: {
          caseCode,
          deviceId: device.deviceId,
          createdBy: createdByUserId,
          issueDescription: dto.issueDescription,
          accessories: dto.accessories || null,
          physicalState: dto.physicalState || null,
          priority: dto.priority,
          serviceType: dto.serviceType,
          status: CaseStatus.RECEIVED,
        },
        include: {
          device: { include: { customer: true } },
        },
      });

      // Ghi lịch sử trạng thái đầu tiên
      await tx.caseStatusHistory.create({
        data: {
          caseId: newCase.caseId,
          fromStatus: CaseStatus.DRAFT,
          toStatus: CaseStatus.RECEIVED,
          reason: 'Tiếp nhận thiết bị tại quầy',
          changedBy: createdByUserId,
        },
      });

      // Ghi sự kiện Transactional Outbox
      await tx.outboxEvent.create({
        data: {
          aggregateId: String(newCase.caseId),
          eventType: 'CaseCreated',
          payload: {
            caseId: newCase.caseId,
            caseCode: newCase.caseCode,
            customerPhone: customer.phone,
            serialNumber: device.serialNumber,
            status: newCase.status,
          },
        },
      });

      return newCase;
    });
  }

  // 2. Lấy danh sách ca bảo hành (lọc theo status nếu có)
  async findAll(status?: CaseStatus) {
    return this.prisma.warrantyCase.findMany({
      where: status ? { status } : undefined,
      include: {
        device: { include: { customer: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // 3. Xem chi tiết ca bảo hành kèm báo giá, lệnh sửa chữa & lịch sử trạng thái
  async findOne(caseId: number) {
    const found = await this.prisma.warrantyCase.findUnique({
      where: { caseId },
      include: {
        device: { include: { customer: true, policy: true } },
        quotations: true,
        workOrders: { include: { inspections: true } },
        statusHistories: { orderBy: { changedAt: 'asc' } },
        slaInstances: true,
      },
    });
    if (!found) {
      throw new NotFoundException(`Không tìm thấy ca bảo hành ID: ${caseId}`);
    }
    return found;
  }

  // 4. Chuyển trạng thái theo State Machine + Ghi CaseStatusHistory + OutboxEvent
  async transitionStatus(caseId: number, dto: TransitionCaseDto, actorId: number) {
    const existing = await this.findOne(caseId);
    const currentStatus = existing.status;
    const allowedNext = ALLOWED_TRANSITIONS[currentStatus] || [];

    if (!allowedNext.includes(dto.nextStatus)) {
      throw new BadRequestException(
        `Không thể chuyển trạng thái từ [${currentStatus}] sang [${dto.nextStatus}]. Các bước hợp lệ: [${allowedNext.join(', ') || 'Không có'}]`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.warrantyCase.update({
        where: { caseId },
        data: { status: dto.nextStatus },
      });

      await tx.caseStatusHistory.create({
        data: {
          caseId,
          fromStatus: currentStatus,
          toStatus: dto.nextStatus,
          reason: dto.reason || null,
          changedBy: actorId,
        },
      });

      await tx.outboxEvent.create({
        data: {
          aggregateId: String(caseId),
          eventType: 'CaseStatusChanged',
          payload: {
            caseId,
            caseCode: existing.caseCode,
            fromStatus: currentStatus,
            toStatus: dto.nextStatus,
            reason: dto.reason || null,
            actorId,
          },
        },
      });

      return updated;
    });
  }
}