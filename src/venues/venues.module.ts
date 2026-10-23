import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module.js';
import { VenuesController } from './venues.controller.js';
import { VenuesService } from './venues.service.js';

@Module({
  imports: [EventsModule],
  controllers: [VenuesController],
  providers: [VenuesService],
})
export class VenuesModule {}
