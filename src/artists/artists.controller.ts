import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth-user.js';
import { Auth, CurrentUser, OptionalAuth } from '../auth/decorators.js';
import { ArtistsService } from './artists.service.js';
import { CreateArtistDto, ListArtistsQueryDto } from './dto/artists.dto.js';

@ApiTags('catalog')
@Controller('artists')
export class ArtistsController {
  constructor(private readonly artists: ArtistsService) {}

  @Get()
  list(@Query() query: ListArtistsQueryDto) {
    return this.artists.list(query);
  }

  @Get(':slug')
  @OptionalAuth()
  findOne(@CurrentUser() user: AuthUser | null, @Param('slug') slug: string) {
    return this.artists.findBySlug(slug, user?.id ?? null);
  }

  @Post()
  @Auth()
  create(@Body() dto: CreateArtistDto) {
    return this.artists.create(dto);
  }
}
