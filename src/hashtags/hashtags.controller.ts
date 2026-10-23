import {
  Controller,
  Get,
  Param,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser, OptionalAuth } from '../auth/decorators.js';
import { SearchEventsQueryDto } from '../events/dto/search-events.dto.js';
import { EventsService } from '../events/events.service.js';
import { HashtagsService } from './hashtags.service.js';

class HashtagQueryDto {
  @ApiPropertyOptional({ description: 'Tag prefix, with or without #' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 10;
}

@ApiTags('catalog')
@Controller('hashtags')
export class HashtagsController {
  constructor(
    private readonly hashtags: HashtagsService,
    private readonly events: EventsService,
  ) {}

  @Get()
  autocomplete(@Query() query: HashtagQueryDto) {
    return this.hashtags.autocomplete(query.q ?? '', query.limit);
  }

  // Declared before ':tag' so "trending" isn't captured as a tag name.
  @Get('trending')
  trending(@Query() query: HashtagQueryDto) {
    return this.hashtags.trending(query.limit);
  }

  /** Same filters as GET /events, scoped to one hashtag. */
  @Get(':tag/events')
  @OptionalAuth()
  eventsByTag(
    @CurrentUser() user: AuthUser | null,
    @Param('tag') tag: string,
    @Query() query: SearchEventsQueryDto,
  ) {
    if (query.friendsAttending && !user) {
      throw new UnauthorizedException('Log in to filter by friends');
    }
    query.hashtag = [tag];
    return this.events.search(query, user?.id ?? null);
  }
}
