import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CaseStatus, InventoryTransType, WorkOrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePartDto } from './dto/create-part.dto';
import { ReservePartDto, ReturnPartDto } from './dto/part-transaction.dto';

@Injectable()
export class PartsService {
  constructor(private readonly prisma: PrismaService) {}

  // 1. Tạo danh mục linh kiện mới + Ghi giao dịch IMPORT nếu có tồn đầu
  async createPart(dto: CreatePartDto) {
    return this.prisma.$transaction(async (tx) => {
      const part = await tx.part.create({
        data: {
          sku: dto.sku,
          partName: dto.partName,
          unit: dto.unit || 'Cái',
          stockQty: dto.stockQty,
          reservedQty: 0,
          minStock: dto.minStock ?? 5,
          unitPrice: dto.unitPrice,
        },
      });

      if (dto.stockQty > 0) {
        await tx.inventoryTransaction.create({
          data: {
            partId: part.partId,
            transType: InventoryTransType.IMPORT,
            quantity: dto.stockQty,
            note: 'Nhập tồn kho ban đầu',
          },
        });
      }

      return part;
    });
  }

  // 2. Xem danh sách tồn kho (tính sẵn tồn khả dụng availableQty & cảnh báo dưới minStock)
  async findAllParts() {
    const parts = await this.prisma.part.findMany({
      orderBy: { partId: 'asc' },
    });

    return parts.map((p) => {
      const availableQty = p.stockQty - p.reservedQty;
      return {
        ...p,
        availableQty,
        isLowStock: availableQty <= p.minStock,
      };
    });
  }

  // 3. Giữ chỗ linh kiện cho WorkOrder (RESERVE - C11)
  async reservePartForWorkOrder(dto: ReservePartDto) {
    const [wo, part] = await Promise.all([
      this.prisma.workOrder.findUnique({ where: { workOrderId: dto.workOrderId } }),
      this.prisma.part.findUnique({ where: { partId: dto.partId } }),
    ]);

    if (!wo) throw new NotFoundException(`Không tìm thấy WorkOrder ID: ${dto.workOrderId}`);
    if (!part) throw new NotFoundException(`Không tìm thấy linh kiện ID: ${dto.partId}`);

    const availableQty = part.stockQty - part.reservedQty;
    if (availableQty < dto.quantity) {
      throw new BadRequestException(
        `Không đủ tồn khả dụng cho [${part.partName}]. Khả dụng: ${availableQty}, Yêu cầu: ${dto.quantity}`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.part.update({
        where: { partId: dto.partId },
        data: { reservedQty: { increment: dto.quantity } },
      });

      const wop = await tx.workOrderPart.create({
        data: {
          workOrderId: dto.workOrderId,
          partId: dto.partId,
          quantity: dto.quantity,
          unitPrice: part.unitPrice,
        },
      });

      await tx.inventoryTransaction.create({
        data: {
          partId: dto.partId,
          workOrderId: dto.workOrderId,
          transType: InventoryTransType.RESERVE,
          quantity: dto.quantity,
          note: dto.note || `Giữ chỗ linh kiện cho ${wo.woCode}`,
        },
      });

      await tx.outboxEvent.create({
        data: {
          aggregateId: String(dto.workOrderId),
          eventType: 'PartReserved',
          payload: {
            workOrderId: dto.workOrderId,
            partId: dto.partId,
            sku: part.sku,
            quantity: dto.quantity,
          },
        },
      });

      return wop;
    });
  }

  // 4. Thủ kho xác nhận xuất kho linh kiện đã giữ chỗ (ISSUE) -> Chuyển Case sang READY_TO_REPAIR
  async issuePart(wopId: number, warehouseUserId: number) {
    const wop = await this.prisma.workOrderPart.findUnique({
      where: { wopId },
      include: { part: true, workOrder: { include: { warrantyCase: true } } },
    });
    if (!wop) throw new NotFoundException(`Không tìm thấy phiếu linh kiện ID: ${wopId}`);

    if (wop.part.stockQty < wop.quantity || wop.part.reservedQty < wop.quantity) {
      throw new BadRequestException('Số lượng tồn thực tế hoặc tồn giữ chỗ không khớp để xuất kho');
    }

    return this.prisma.$transaction(async (tx) => {
      // Trừ đồng thời stockQty và reservedQty
      const updatedPart = await tx.part.update({
        where: { partId: wop.partId },
        data: {
          stockQty: { decrement: wop.quantity },
          reservedQty: { decrement: wop.quantity },
        },
      });

      await tx.inventoryTransaction.create({
        data: {
          partId: wop.partId,
          workOrderId: wop.workOrderId,
          transType: InventoryTransType.ISSUE,
          quantity: wop.quantity,
          note: `Xuất kho thực tế cho ${wop.workOrder.woCode}`,
        },
      });

      await tx.workOrder.update({
        where: { workOrderId: wop.workOrderId },
        data: { status: WorkOrderStatus.READY },
      });

      // Nếu ca đang chờ linh kiện -> chuyển sang sẵn sàng sửa chữa
      if (wop.workOrder.warrantyCase.status === CaseStatus.WAITING_PARTS) {
        await tx.warrantyCase.update({
          where: { caseId: wop.workOrder.caseId },
          data: { status: CaseStatus.READY_TO_REPAIR },
        });

        await tx.caseStatusHistory.create({
          data: {
            caseId: wop.workOrder.caseId,
            fromStatus: CaseStatus.WAITING_PARTS,
            toStatus: CaseStatus.READY_TO_REPAIR,
            reason: `Kho đã xuất đủ linh kiện (${wop.part.partName})`,
            changedBy: warehouseUserId,
          },
        });
      }

      // Kiểm tra cảnh báo tồn kho thấp (PARAM-06)
      const remainingAvailable = updatedPart.stockQty - updatedPart.reservedQty;
      if (remainingAvailable <= updatedPart.minStock) {
        await tx.outboxEvent.create({
          data: {
            aggregateId: String(updatedPart.partId),
            eventType: 'LowStockAlert',
            payload: {
              partId: updatedPart.partId,
              sku: updatedPart.sku,
              partName: updatedPart.partName,
              remainingAvailable,
              minStock: updatedPart.minStock,
            },
          },
        });
      }

      return { message: 'Xuất kho linh kiện thành công', part: updatedPart };
    });
  }

  // 5. Hoàn trả linh kiện dư về kho sau sửa chữa (BR-16)
  async returnUnusedPart(dto: ReturnPartDto) {
    const wop = await this.prisma.workOrderPart.findUnique({
      where: { wopId: dto.wopId },
      include: { part: true },
    });
    if (!wop) throw new NotFoundException(`Không tìm thấy phiếu linh kiện ID: ${dto.wopId}`);

    const maxReturnable = wop.quantity - wop.returnedQty;
    if (dto.returnQty > maxReturnable) {
      throw new BadRequestException(`Số lượng hoàn trả tối đa hợp lệ là ${maxReturnable}`);
    }

    return this.prisma.$transaction(async (tx) => {
      const updatedWop = await tx.workOrderPart.update({
        where: { wopId: dto.wopId },
        data: { returnedQty: { increment: dto.returnQty } },
      });

      await tx.part.update({
        where: { partId: wop.partId },
        data: { stockQty: { increment: dto.returnQty } },
      });

      await tx.inventoryTransaction.create({
        data: {
          partId: wop.partId,
          workOrderId: wop.workOrderId,
          transType: InventoryTransType.RETURN,
          quantity: dto.returnQty,
          note: dto.note || 'Hoàn trả linh kiện thừa sau sửa chữa (BR-16)',
        },
      });

      return updatedWop;
    });
  }
}