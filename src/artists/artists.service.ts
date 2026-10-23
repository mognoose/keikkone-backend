import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { cursorArgs, toPage } from '../common/pagination.js';
import { slugify } from '../common/slug.js';
import { EventsService } from '../events/events.service.js';
import { SearchEventsQueryDto } from '../events/dto/search-events.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  CreateArtistDto,
  ListArtistsQueryDto,
} from './dto/artists.dto.js';

const artistInclude = {
  genres: { include: { genre: { select: { name: true, slug: true } } } },
} as const;

@Injectable()
export class ArtistsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
  ) {}

  async list(query: ListArtistsQueryDto) {
    const rows = await this.prisma.artist.findMany({
      where: {
        ...(query.q
          ? { name: { contains: query.q, mode: 'insensitive' } }
          : {}),
        ...(query.genre
          ? { genres: { some: { genre: { slug: slugify(query.genre) } } } }
          : {}),
      },
      include: artistInclude,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      ...cursorArgs(query),
    });
    const page = toPage(rows, query.limit);
    return { ...page, items: page.items.map(present) };
  }

  async findBySlug(slug: string, viewerId: string | null) {
    const artist = await this.prisma.artist.findUnique({
      where: { slug: slugify(slug) },
      include: artistInclude,
    });
    if (!artist) throw new NotFoundException('Artist not found');
    const upcoming = await this.events.search(
      Object.assign(new SearchEventsQueryDto(), { artist: [artist.slug] }),
      viewerId,
    );
    return { ...present(artist), upcomingEvents: upcoming };
  }

  async create(dto: CreateArtistDto) {
    const slug = slugify(dto.name);
    if (!slug)
      throw new BadRequestException('Name must contain letters or digits');
    const existing = await this.prisma.artist.findUnique({ where: { slug } });
    if (existing) {
      // Tell the client which artist already holds this name so it can link to it.
      throw new ConflictException({
        message: 'Artist already exists',
        slug,
        id: existing.id,
      });
    }
    const genreSlugs = [...new Set((dto.genres ?? []).map(slugify))];
    const genres = await this.prisma.genre.findMany({
      where: { slug: { in: genreSlugs } },
    });
    if (genres.length !== genreSlugs.length)
      throw new BadRequestException('Unknown genre');

    const artist = await this.prisma.artist.create({
      data: {
        name: dto.name.trim(),
        slug,
        description: dto.description,
        imageUrl: dto.imageUrl,
        genres: { create: genres.map((g) => ({ genreId: g.id })) },
      },
      include: artistInclude,
    });
    return present(artist);
  }
}

function present<
  T extends { genres: { genre: { name: string; slug: string } }[] },
>(artist: T) {
  return { ...artist, genres: artist.genres.map((g) => g.genre) };
}
