import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OutboxService {
  private readonly logger = new Logger(OutboxService.name);
  private isPolling = false;

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('woms-events') private readonly eventsQueue: Queue,
  ) {}

  @Interval(5000)
  async relayOutboxEvents() {
    if (this.isPolling) return;
    this.isPolling = true;

    try {
      const pendingEvents = await this.prisma.outboxEvent.findMany({
        where: { processed: false },
        orderBy: { createdAt: 'asc' },
        take: 20,
      });

      for (const event of pendingEvents) {
        // Đẩy job vào Redis BullMQ với cơ chế tự thử lại 3 lần nếu lỗi
        await this.eventsQueue.add(
          event.eventType,
          {
            outboxId: event.id,
            aggregateId: event.aggregateId,
            eventType: event.eventType,
            payload: event.payload,
          },
          {
            attempts: 3,
            backoff: { type: 'exponential', delay: 2000 },
            removeOnComplete: true,
          },
        );

        await this.prisma.outboxEvent.update({
          where: { id: event.id },
          data: {
            processed: true,
            processedAt: new Date(),
          },
        });
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Lỗi Outbox Poller: ${msg}`);
    } finally {
      this.isPolling = false;
    }
  }
}