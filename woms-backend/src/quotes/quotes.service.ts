import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CaseStatus, QuoteStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { RoleEnum } from '../common/decorators/roles.decorator';

@Injectable()
export class QuotesService {
  constructor(private readonly prisma: PrismaService) {}

  // 1. Tạo báo giá (Quotation) & tự động kiểm tra ngưỡng PARAM-03 (BR-07)
  async createQuote(dto: CreateQuoteDto, createdById: number) {
    const existingCase = await this.prisma.warrantyCase.findUnique({
      where: { caseId: dto.caseId },
    });
    if (!existingCase) {
      throw new NotFoundException(`Không tìm thấy ca bảo hành ID: ${dto.caseId}`);
    }

    // Tính tổng tiền và đếm version báo giá tiếp theo (AT-15)
    const totalAmount = dto.partsCost + dto.laborCost;
    const latestQuote = await this.prisma.quotation.findFirst({
      where: { caseId: dto.caseId },
      orderBy: { version: 'desc' },
    });
    const nextVersion = latestQuote ? latestQuote.version + 1 : 1;

    // Đọc ngưỡng báo giá cần Quản lý duyệt (PARAM-03) từ database
    const thresholdParam = await this.prisma.systemParameter.findUnique({
      where: { paramCode: 'PARAM-03' },
    });
    const approvalThreshold = thresholdParam ? Number(thresholdParam.paramValue) : 2000000;

    const requiresManagerApproval = totalAmount > approvalThreshold;
    const nextQuoteStatus = requiresManagerApproval
      ? QuoteStatus.PENDING_MANAGER_APPROVAL
      : QuoteStatus.SENT_TO_CUSTOMER;
    const nextCaseStatus = requiresManagerApproval
      ? CaseStatus.WAITING_APPROVAL
      : CaseStatus.QUOTED;

    return this.prisma.$transaction(async (tx) => {
      const quotation = await tx.quotation.create({
        data: {
          caseId: dto.caseId,
          version: nextVersion,
          partsCost: dto.partsCost,
          laborCost: dto.laborCost,
          totalAmount,
          status: nextQuoteStatus,
          managerNote: dto.managerNote || null,
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
          reason: `Lập báo giá v${nextVersion} tổng tiền ${totalAmount.toLocaleString()} VND`,
          changedBy: createdById,
        },
      });

      await tx.outboxEvent.create({
        data: {
          aggregateId: String(quotation.quotationId),
          eventType: requiresManagerApproval ? 'QuoteEscalatedToManager' : 'QuoteSentToCustomer',
          payload: {
            quotationId: quotation.quotationId,
            caseId: dto.caseId,
            totalAmount,
            threshold: approvalThreshold,
          },
        },
      });

      return {
        ...quotation,
        requiresManagerApproval,
        appliedThreshold: approvalThreshold,
      };
    });
  }

  // 2. Phê duyệt báo giá (Manager duyệt nội bộ hoặc CSKH/Khách hàng chốt giá)
  async approveQuote(quotationId: number, user: any, customerProof?: string) {
    const quote = await this.prisma.quotation.findUnique({
      where: { quotationId },
      include: { warrantyCase: true },
    });
    if (!quote) {
      throw new NotFoundException(`Không tìm thấy báo giá ID: ${quotationId}`);
    }

    if (
      quote.status === QuoteStatus.PENDING_MANAGER_APPROVAL &&
      !user.roles.includes(RoleEnum.MANAGER)
    ) {
      throw new ForbiddenException(
        'Báo giá vượt ngưỡng quy định (PARAM-03), chỉ MANAGER mới có quyền phê duyệt',
      );
    }

    const isManagerStep = quote.status === QuoteStatus.PENDING_MANAGER_APPROVAL;
    const nextQuoteStatus = isManagerStep
      ? QuoteStatus.SENT_TO_CUSTOMER
      : QuoteStatus.APPROVED;
    const nextCaseStatus = isManagerStep
      ? CaseStatus.QUOTED
      : CaseStatus.WO_CREATED;

    return this.prisma.$transaction(async (tx) => {
      const updatedQuote = await tx.quotation.update({
        where: { quotationId },
        data: {
          status: nextQuoteStatus,
          approvedAt: isManagerStep ? null : new Date(),
          customerProof: customerProof || quote.customerProof,
        },
      });

      await tx.warrantyCase.update({
        where: { caseId: quote.caseId },
        data: { status: nextCaseStatus },
      });

      await tx.caseStatusHistory.create({
        data: {
          caseId: quote.caseId,
          fromStatus: quote.warrantyCase.status,
          toStatus: nextCaseStatus,
          reason: isManagerStep ? 'Quản lý đã duyệt báo giá' : 'Khách hàng xác nhận đồng ý báo giá',
          changedBy: user.userId,
        },
      });

      await tx.outboxEvent.create({
        data: {
          aggregateId: String(quotationId),
          eventType: isManagerStep ? 'QuoteManagerApproved' : 'QuoteCustomerApproved',
          payload: { quotationId, caseId: quote.caseId, approvedBy: user.userId },
        },
      });

      return updatedQuote;
    });
  }
}