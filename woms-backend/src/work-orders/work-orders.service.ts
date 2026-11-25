import { Injectable, NotFoundException } from '@nestjs/common';
import { CaseStatus, WorkOrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWorkOrderDto } from './dto/create-work-order.dto';
import { QcInspectDto } from './dto/qc-inspect.dto';

@Injectable()
export class WorkOrdersService {
  constructor(private readonly prisma: PrismaService) {}

  // 1. Tạo lệnh sửa chữa (WorkOrder) & phân công Kỹ thuật viên
  async assignTechnician(dto: CreateWorkOrderDto, coordinatorId: number) {
    const existingCase = await this.prisma.warrantyCase.findUnique({
      where: { caseId: dto.caseId },
    });
    if (!existingCase) {
      throw new NotFoundException(`Không tìm thấy ca bảo hành ID: ${dto.caseId}`);
    }

    const woCode = `WO-${Date.now()}`;
    const nextCaseStatus = dto.assignedTo ? CaseStatus.ASSIGNED : CaseStatus.WO_CREATED;
    const nextWoStatus = dto.assignedTo ? WorkOrderStatus.ASSIGNED : WorkOrderStatus.PENDING;

    return this.prisma.$transaction(async (tx) => {
      const workOrder = await tx.workOrder.create({
        data: {
          woCode,
          caseId: dto.caseId,
          assignedTo: dto.assignedTo || null,
          status: nextWoStatus,
        },
      });

      await tx.warrantyCase.update({
        where: { caseId: dto.caseId },
        data: { status: nextCaseStatus },
      });

      await tx.caseStatusHistory.create({
        data: {
          caseId: dto.caseId,
          fromStatus: existingCase.status,
          toStatus: nextCaseStatus,
          reason: `Tạo lệnh sửa chữa ${woCode}`,
          changedBy: coordinatorId,
        },
      });

      await tx.outboxEvent.create({
        data: {
          aggregateId: String(workOrder.workOrderId),
          eventType: 'WorkOrderCreated',
          payload: {
            workOrderId: workOrder.workOrderId,
            woCode,
            caseId: dto.caseId,
            assignedTo: dto.assignedTo || null,
          },
        },
      });

      return workOrder;
    });
  }

  // 2. QC nghiệm thu chất lượng -> Tạo biên bản Inspection + Kiểm tra giới hạn reworkCount (PARAM-10)
  async inspectQuality(workOrderId: number, dto: QcInspectDto, qcUserId: number) {
    const wo = await this.prisma.workOrder.findUnique({
      where: { workOrderId },
      include: { warrantyCase: true },
    });
    if (!wo) {
      throw new NotFoundException(`Không tìm thấy lệnh sửa chữa ID: ${workOrderId}`);
    }

    // Trường hợp 1: QC ĐẠT (PASS)
    if (dto.passed) {
      return this.prisma.$transaction(async (tx) => {
        const inspection = await tx.inspection.create({
          data: {
            workOrderId,
            result: 'PASS',
            note: dto.note || null,
            inspectedBy: qcUserId,
          },
        });

        const updatedWo = await tx.workOrder.update({
          where: { workOrderId },
          data: {
            status: WorkOrderStatus.COMPLETED,
            endTime: new Date(),
          },
        });

        await tx.warrantyCase.update({
          where: { caseId: wo.caseId },
          data: { status: CaseStatus.READY_FOR_DELIVERY },
        });

        await tx.caseStatusHistory.create({
          data: {
            caseId: wo.caseId,
            fromStatus: wo.warrantyCase.status,
            toStatus: CaseStatus.READY_FOR_DELIVERY,
            reason: 'QC kiểm định đạt chuẩn (PASS)',
            changedBy: qcUserId,
          },
        });

        await tx.outboxEvent.create({
          data: {
            aggregateId: String(workOrderId),
            eventType: 'InspectionPassed',
            payload: { workOrderId, caseId: wo.caseId, inspectionId: inspection.inspectionId },
          },
        });

        return { workOrder: updatedWo, inspection };
      });
    }

    // Trường hợp 2: QC KHÔNG ĐẠT (FAIL) -> Tăng reworkCount trên WarrantyCase & so với PARAM-10
    const maxReworkParam = await this.prisma.systemParameter.findUnique({
      where: { paramCode: 'PARAM-10' },
    });
    const maxReworkLimit = maxReworkParam ? Number(maxReworkParam.paramValue) : 2;
    const newReworkCount = wo.warrantyCase.reworkCount + 1;

    const isExceededLimit = newReworkCount > maxReworkLimit;
    const nextCaseStatus = isExceededLimit ? CaseStatus.MANAGER_REVIEW : CaseStatus.REWORK;

    return this.prisma.$transaction(async (tx) => {
      const inspection = await tx.inspection.create({
        data: {
          workOrderId,
          result: 'FAIL',
          note: dto.note || null,
          inspectedBy: qcUserId,
        },
      });

      const updatedWo = await tx.workOrder.update({
        where: { workOrderId },
        data: { status: WorkOrderStatus.IN_PROGRESS },
      });

      await tx.warrantyCase.update({
        where: { caseId: wo.caseId },
        data: {
          status: nextCaseStatus,
          reworkCount: newReworkCount,
        },
      });

      await tx.caseStatusHistory.create({
        data: {
          caseId: wo.caseId,
          fromStatus: wo.warrantyCase.status,
          toStatus: nextCaseStatus,
          reason: isExceededLimit
            ? `Vượt quá số lần sửa lại tối đa (${newReworkCount}/${maxReworkLimit}) - Chuyển Quản lý`
            : `QC không đạt (Lần sửa lại ${newReworkCount}/${maxReworkLimit})`,
          changedBy: qcUserId,
        },
      });

      await tx.outboxEvent.create({
        data: {
          aggregateId: String(workOrderId),
          eventType: isExceededLimit ? 'ReworkLimitExceeded' : 'InspectionFailed',
          payload: {
            workOrderId,
            caseId: wo.caseId,
            reworkCount: newReworkCount,
            maxReworkLimit,
          },
        },
      });

      return {
        workOrder: updatedWo,
        inspection,
        reworkCount: newReworkCount,
        escalatedToManager: isExceededLimit,
      };
    });
  }
}