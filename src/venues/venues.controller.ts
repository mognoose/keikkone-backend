import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth-user.js';
import { Auth, CurrentUser, OptionalAuth } from '../auth/decorators.js';
import { CreateVenueDto, ListVenuesQueryDto } from './dto/venues.dto.js';
import { VenuesService } from './venues.service.js';

@ApiTags('catalog')
@Controller('venues')
export class VenuesController {
  constructor(private readonly venues: VenuesService) {}

  @Get()
  list(@Query() query: ListVenuesQueryDto) {
    return this.venues.list(query);
  }

  @Get(':slug')
  @OptionalAuth()
  findOne(@CurrentUser() user: AuthUser | null, @Param('slug') slug: string) {
    return this.venues.findBySlug(slug, user?.id ?? null);
  }

  @Post()
  @Auth()
  create(@Body() dto: CreateVenueDto) {
    return this.venues.create(dto);
  }
}
