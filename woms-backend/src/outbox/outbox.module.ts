import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { OutboxService } from './outbox.service';
import { OutboxProcessor } from './outbox.processor';
import { SlaModule } from '../sla/sla.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'woms-events',
    }),
    SlaModule,
  ],
  providers: [OutboxService, OutboxProcessor],
})
export class OutboxModule {}