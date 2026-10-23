import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service.js';

/** Genres are a curated list (see prisma/seed.ts), so this module is read-only. */
@ApiTags('catalog')
@Controller('genres')
export class GenresController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list() {
    return this.prisma.genre.findMany({
      select: { id: true, name: true, slug: true },
      orderBy: { name: 'asc' },
    });
  }
}
