import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth-user.js';
import { Auth, CurrentUser, OptionalAuth } from '../auth/decorators.js';
import { SetAttendanceDto } from './dto/attendance.dto.js';
import { CreateEventDto } from './dto/create-event.dto.js';
import { FeedQueryDto } from './dto/feed.dto.js';
import { SearchEventsQueryDto } from './dto/search-events.dto.js';
import { UpdateEventDto } from './dto/update-event.dto.js';
import { EventsService } from './events.service.js';

@ApiTags('events')
@Controller()
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Get('events')
  @OptionalAuth()
  search(
    @CurrentUser() user: AuthUser | null,
    @Query() query: SearchEventsQueryDto,
  ) {
    if (query.friendsAttending && !user) {
      throw new UnauthorizedException('Log in to filter by friends');
    }
    return this.events.search(query, user?.id ?? null);
  }

  @Get('events/:id')
  @OptionalAuth()
  findOne(
    @CurrentUser() user: AuthUser | null,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.events.findOne(id, user?.id ?? null);
  }

  @Post('events')
  @Auth()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateEventDto) {
    return this.events.create(user, dto);
  }

  @Patch('events/:id')
  @Auth()
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEventDto,
  ) {
    return this.events.update(user, id, dto);
  }

  @Delete('events/:id')
  @Auth()
  @HttpCode(204)
  cancel(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.events.cancel(user, id);
  }

  @Put('events/:id/attendance')
  @Auth()
  setAttendance(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetAttendanceDto,
  ) {
    return this.events.setAttendance(user.id, id, dto.status);
  }

  @Delete('events/:id/attendance')
  @Auth()
  @HttpCode(204)
  removeAttendance(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.events.removeAttendance(user.id, id);
  }

  @Get('me/feed')
  @Auth()
  feed(@CurrentUser() user: AuthUser, @Query() query: FeedQueryDto) {
    return this.events.feed(user.id, query.limit, query.offset);
  }
}
