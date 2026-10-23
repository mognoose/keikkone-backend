import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module.js';
import { HashtagsController } from './hashtags.controller.js';
import { HashtagsService } from './hashtags.service.js';

@Module({
  imports: [EventsModule],
  controllers: [HashtagsController],
  providers: [HashtagsService],
})
export class HashtagsModule {}
