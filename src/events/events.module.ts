import { Module } from '@nestjs/common';
import { EventsController } from './events.controller.js';
import { EventsService } from './events.service.js';

@Module({
  controllers: [EventsController],
  providers: [EventsService],
  // Artists, venues and hashtags reuse event search for their "upcoming events".
  exports: [EventsService],
})
export class EventsModule {}
