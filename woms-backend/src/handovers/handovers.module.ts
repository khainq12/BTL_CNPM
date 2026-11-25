import { Module } from '@nestjs/common';
import { HandoversService } from './handovers.service';
import { HandoversController } from './handovers.controller';

@Module({
  controllers: [HandoversController],
  providers: [HandoversService],
})
export class HandoversModule {}
