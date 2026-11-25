import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SlaService {
  private readonly logger = new Logger(SlaService.name);

  constructor(private readonly prisma: PrismaService) {}

  // 1. Khởi tạo SLA Instance khi tiếp nhận ca bảo hành mới
  async createSlaForCase(caseId: number, stage = 'OVERALL_CASE') {
    const existingCase = await this.prisma.warrantyCase.findUnique({
      where: { caseId },
    });
    if (!existingCase) return null;

    // Đọc thời hạn chuẩn từ PARAM-08 (mặc định 3 ngày = 72 giờ)
    const param08 = await this.prisma.systemParameter.findUnique({
      where: { paramCode: 'PARAM-08' },
    });
    const daysLimit = param08 ? Number(param08.paramValue) : 3;
    const hoursLimit = daysLimit * 24;

    const serviceType = existingCase.serviceType || 'WARRANTY_FREE';

    // Tìm hoặc tạo SlaPolicy mặc định
    let policy = await this.prisma.slaPolicy.findFirst({
      where: { serviceType, stage },
    });
    if (!policy) {
      policy = await this.prisma.slaPolicy.create({
        data: {
          serviceType,
          stage,
          timeLimit: hoursLimit,
          unit: 'HOURS',
        },
      });
    }

    const startTime = new Date();
    const deadline = new Date(startTime.getTime() + hoursLimit * 60 * 60 * 1000);

    return this.prisma.$transaction(async (tx) => {
      const sla = await tx.slaInstance.create({
        data: {
          caseId,
          slaPolicyId: policy.slaPolicyId,
          startTime,
          deadline,
          status: 'ACTIVE',
        },
      });

      await tx.slaEvent.create({
        data: {
          slaId: sla.slaId,
          eventType: 'CREATED',
          note: `Khởi tạo SLA (${hoursLimit} giờ), hạn chót: ${deadline.toISOString()}`,
        },
      });

      return sla;
    });
  }

  // 2. Job chạy định kỳ mỗi 60 giây để kiểm tra cảnh báo & vi phạm SLA
  @Interval(60000)
  async checkSlaDeadlines() {
    const activeSlas = await this.prisma.slaInstance.findMany({
      where: { status: 'ACTIVE' },
      include: { slaEvents: true },
    });

    if (activeSlas.length === 0) return;

    // Đọc ngưỡng cảnh báo sớm từ PARAM-09 (mặc định 4 giờ)
    const param09 = await this.prisma.systemParameter.findUnique({
      where: { paramCode: 'PARAM-09' },
    });
    const warningHours = param09 ? Number(param09.paramValue) : 4;
    const warningMs = warningHours * 60 * 60 * 1000;
    const now = new Date();

    for (const sla of activeSlas) {
      const remainingMs = sla.deadline.getTime() - now.getTime();

      // Trường hợp 1: Đã quá hạn -> Chuyển sang BREACHED
      if (remainingMs <= 0) {
        await this.prisma.$transaction(async (tx) => {
          await tx.slaInstance.update({
            where: { slaId: sla.slaId },
            data: { status: 'BREACHED' },
          });

          await tx.slaEvent.create({
            data: {
              slaId: sla.slaId,
              eventType: 'BREACHED',
              note: 'Ca bảo hành đã vượt quá thời hạn SLA cam kết',
            },
          });

          await tx.outboxEvent.create({
            data: {
              aggregateId: String(sla.caseId),
              eventType: 'SlaBreached',
              payload: {
                slaId: sla.slaId,
                caseId: sla.caseId,
                note: 'Đã vi phạm cam kết thời gian xử lý (BREACHED)',
              },
            },
          });
        });
        this.logger.warn(`SLA #${sla.slaId} (Case #${sla.caseId}) đã chuyển sang BREACHED`);
        continue;
      }

      // Trường hợp 2: Sắp hết hạn (<= PARAM-09) và chưa từng gửi cảnh báo
      const alreadyWarned = sla.slaEvents.some((e) => e.eventType === 'WARNING_4H');
      if (remainingMs <= warningMs && !alreadyWarned) {
        await this.prisma.$transaction(async (tx) => {
          await tx.slaEvent.create({
            data: {
              slaId: sla.slaId,
              eventType: 'WARNING_4H',
              note: `Cảnh báo: Còn dưới ${warningHours} giờ trước hạn chót SLA`,
            },
          });

          await tx.outboxEvent.create({
            data: {
              aggregateId: String(sla.caseId),
              eventType: 'SlaWarning',
              payload: {
                slaId: sla.slaId,
                caseId: sla.caseId,
                note: `Sắp quá hạn SLA (còn dưới ${warningHours} giờ)`,
              },
            },
          });
        });
        this.logger.log(`Đã phát cảnh báo WARNING_4H cho SLA #${sla.slaId} (Case #${sla.caseId})`);
      }
    }
  }

  // 3. Lấy danh sách giám sát SLA (phục vụ Dashboard Quản lý / Điều phối)
  async getAllSlaInstances() {
    return this.prisma.slaInstance.findMany({
      include: {
        warrantyCase: { select: { caseCode: true, status: true, priority: true } },
        slaPolicy: true,
        slaEvents: { orderBy: { eventTime: 'desc' } },
      },
      orderBy: { deadline: 'asc' },
    });
  }
}