import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { SlaService } from '../sla/sla.service';

@Processor('woms-events')
export class OutboxProcessor extends WorkerHost {
  private readonly logger = new Logger(OutboxProcessor.name);

  constructor(private readonly slaService: SlaService) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    const { eventType, payload } = job.data;
    this.logger.log(`[BullMQ Worker] Đang xử lý sự kiện: ${eventType} | Payload: ${JSON.stringify(payload)}`);

    switch (eventType) {
      case 'CaseCreated':
        // Tự động khởi tạo đồng hồ SLA ngay khi tiếp nhận ca bảo hành mới
        await this.slaService.createSlaForCase(payload.caseId, 'OVERALL_CASE');
        this.logger.log(`[Notification] Đã gửi SMS/Zalo xác nhận tiếp nhận cho SĐT ${payload.customerPhone}`);
        break;

      case 'QuoteEscalatedToManager':
        this.logger.warn(`[Alert Manager] Báo giá #${payload.quotationId} vượt ngưỡng ${payload.threshold} VND cần duyệt!`);
        break;

      case 'ReworkLimitExceeded':
        this.logger.error(`[Escalation] WorkOrder #${payload.workOrderId} sửa lại quá ${payload.maxReworkLimit} lần!`);
        break;

      case 'SlaWarning':
      case 'SlaBreached':
        this.logger.warn(`[SLA Alert] ${eventType} cho Case #${payload.caseId}: ${payload.note}`);
        break;

      default:
        this.logger.log(`[Outbox] Đã phát sự kiện ${eventType} thành công.`);
        break;
    }

    return { handled: true, eventType };
  }
}